//! Classes and Symbols (Go to Class / Go to Symbol): definitions
//! found by `extract` in the source files of the Go to File index, stored
//! compactly and matched with nucleo-matcher.
//!
//! Worker threads take the file index's chunks as they arrive and append one
//! symbol chunk per file chunk, so queries answer from a partly built index.
//! Each chunk keeps its names in one string and fixed-size records beside
//! it. The index lives in the Go to File session and shares its lifecycle.

mod extract;
pub mod outline;

use std::cmp::Ordering as CmpOrdering;
use std::io::Read;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use nucleo_matcher::{Config, Matcher, Utf32Str};
use serde::{Deserialize, Serialize};

pub use extract::{language_for, SymbolKind};

use crate::file_search::{haystack, join_root, lock, lower, walker_threads, Chunk, Index, Needle};

/// Hard cap on stored symbols; the results say when it was hit.
pub const MAX_SYMBOLS: usize = 2_000_000;
pub const DEFAULT_LIMIT: usize = 50;
const MAX_LIMIT: usize = 500;
/// Bigger files are generated or data, not code worth listing.
pub const MAX_FILE_BYTES: u64 = 1024 * 1024;
/// A file this big whose lines average more than `MINIFIED_LINE` bytes is minified.
const MINIFIED_MIN_BYTES: usize = 4096;
const MINIFIED_LINE: usize = 300;
/// Names and containers longer than this are not real code.
const MAX_NAME: usize = 255;
const PROGRESS_INTERVAL_MS: u64 = 100;
/// Below this many symbols one thread matches faster than starting more.
const PARALLEL_THRESHOLD: usize = 65_536;

const TIER_FUZZY: u32 = 1;
const TIER_PREFIX: u32 = 2;
const TIER_EXACT: u32 = 3;
/// The exact name in the same case.
const TIER_EXACT_CASE: u32 = 4;
const TIER_SHIFT: u32 = 24;
const RAW_MAX: u32 = (1 << TIER_SHIFT) - 1;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolSearchProgress {
    /// Files looked at so far.
    pub files: usize,
    pub symbols: usize,
    pub done: bool,
    /// The index stopped at `MAX_SYMBOLS`.
    pub truncated: bool,
}

/// Which definitions a query lists.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SymbolScope {
    /// Classes, interfaces, structs and the like.
    Classes,
    /// Everything.
    All,
    /// Everything but classes (the Symbols section of the All tab).
    Members,
}

impl SymbolScope {
    pub const COUNT: usize = 3;

    /// A slot per scope, for state kept per scope.
    pub fn index(self) -> usize {
        match self {
            SymbolScope::Classes => 0,
            SymbolScope::All => 1,
            SymbolScope::Members => 2,
        }
    }

    fn accepts(self, kind: SymbolKind) -> bool {
        match self {
            SymbolScope::Classes => kind.is_class_like(),
            SymbolScope::All => true,
            SymbolScope::Members => !kind.is_class_like(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolSearchItem {
    pub name: String,
    pub kind: SymbolKind,
    pub container: Option<String>,
    /// Absolute path of the file.
    pub path: String,
    pub root: String,
    pub relative_path: String,
    /// 1-based.
    pub line: u32,
    /// 1-based, in UTF-16 code units.
    pub column: u32,
    /// Matched code points of `name`, ascending.
    pub indices: Vec<u32>,
    /// Matched code points of `container` ("Cart.add" queries).
    pub container_indices: Vec<u32>,
    pub score: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolSearchResults {
    pub items: Vec<SymbolSearchItem>,
    /// Every symbol that matched; `items` holds the best of them.
    pub matched: usize,
    pub files: usize,
    pub symbols: usize,
    pub done: bool,
    pub truncated: bool,
}

// ---------------------------------------------------------------------------
// Storage

/// One definition, 20 bytes; the strings live in the chunk's `names`.
#[derive(Debug, Clone, Copy)]
struct Symbol {
    name: u32,
    container: u32,
    line: u32,
    /// Entry in the file chunk.
    file: u16,
    /// 0-based UTF-16 column, saturated.
    column: u16,
    name_len: u8,
    container_len: u8,
    kind: u8,
}

/// The symbols of one file chunk.
struct SymbolChunk {
    files: Arc<Chunk>,
    names: String,
    symbols: Vec<Symbol>,
}

impl SymbolChunk {
    fn name(&self, symbol: &Symbol) -> &str {
        let start = symbol.name as usize;
        &self.names[start..start + symbol.name_len as usize]
    }

    fn container(&self, symbol: &Symbol) -> &str {
        let start = symbol.container as usize;
        &self.names[start..start + symbol.container_len as usize]
    }

    fn path(&self, symbol: &Symbol) -> &str {
        self.files.path(symbol.file as usize)
    }

    #[cfg(test)]
    fn heap_bytes(&self) -> usize {
        self.names.capacity() + self.symbols.capacity() * std::mem::size_of::<Symbol>()
    }
}

pub struct SymbolIndex {
    files: Arc<Index>,
    max_symbols: usize,
    chunks: Mutex<Vec<Arc<SymbolChunk>>>,
    symbols: AtomicUsize,
    scanned: AtomicUsize,
    done: AtomicBool,
    truncated: AtomicBool,
    cancelled: AtomicBool,
    started: Instant,
    last_report: AtomicU64,
}

impl SymbolIndex {
    pub fn new(files: Arc<Index>, max_symbols: usize) -> SymbolIndex {
        SymbolIndex {
            files,
            max_symbols,
            chunks: Mutex::new(Vec::new()),
            symbols: AtomicUsize::new(0),
            scanned: AtomicUsize::new(0),
            done: AtomicBool::new(false),
            truncated: AtomicBool::new(false),
            cancelled: AtomicBool::new(false),
            started: Instant::now(),
            last_report: AtomicU64::new(0),
        }
    }

    pub fn is_done(&self) -> bool {
        self.done.load(Ordering::Acquire)
    }

    pub fn finish(&self) {
        self.done.store(true, Ordering::Release);
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }

    fn stopped(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed) || self.truncated.load(Ordering::Relaxed)
    }

    pub fn progress(&self) -> SymbolSearchProgress {
        SymbolSearchProgress {
            files: self.scanned.load(Ordering::Relaxed),
            symbols: self.symbols.load(Ordering::Relaxed),
            done: self.is_done(),
            truncated: self.truncated.load(Ordering::Relaxed),
        }
    }

    /// Memory held by the symbols (not the file list they point into).
    #[cfg(test)]
    pub fn heap_bytes(&self) -> usize {
        let chunks = lock(&self.chunks);
        chunks.iter().map(|chunk| chunk.heap_bytes()).sum::<usize>() + chunks.capacity() * std::mem::size_of::<usize>()
    }

    fn add_chunk(&self, mut chunk: SymbolChunk, files: usize) {
        let mut chunks = lock(&self.chunks);
        self.scanned.fetch_add(files, Ordering::Relaxed);
        let stored = self.symbols.load(Ordering::Relaxed);
        let room = self.max_symbols.saturating_sub(stored);
        if chunk.symbols.len() > room {
            chunk.symbols.truncate(room);
            self.truncated.store(true, Ordering::Relaxed);
        }
        if chunk.symbols.is_empty() {
            return;
        }
        chunk.names.shrink_to_fit();
        chunk.symbols.shrink_to_fit();
        self.symbols.store(stored + chunk.symbols.len(), Ordering::Relaxed);
        chunks.push(Arc::new(chunk));
    }

    fn snapshot(&self) -> (Vec<Arc<SymbolChunk>>, SymbolSearchProgress) {
        let done = self.is_done();
        let chunks = lock(&self.chunks).clone();
        let mut progress = self.progress();
        progress.done = done;
        (chunks, progress)
    }

    fn maybe_report(&self, report: &(dyn Fn(&SymbolIndex) + Sync)) {
        let now = self.started.elapsed().as_millis() as u64 + 1;
        let last = self.last_report.load(Ordering::Relaxed);
        if last != 0 && now < last + PROGRESS_INTERVAL_MS {
            return;
        }
        if self
            .last_report
            .compare_exchange(last, now, Ordering::Relaxed, Ordering::Relaxed)
            .is_ok()
        {
            report(self);
        }
    }
}

// ---------------------------------------------------------------------------
// Building

/// Scans every file chunk as it arrives, on a few threads, then marks the
/// index done and reports once more.
pub fn build(index: &SymbolIndex, report: &(dyn Fn(&SymbolIndex) + Sync)) {
    let next = AtomicUsize::new(0);
    let work = || {
        let mut scanner = FileScanner::default();
        loop {
            if index.stopped() {
                return;
            }
            let number = next.fetch_add(1, Ordering::Relaxed);
            let Some(files) = index.files.wait_chunk(number, &|| index.stopped()) else {
                return;
            };
            let count = files.len();
            let chunk = scanner.scan_chunk(index.files.roots(), files, &|| index.stopped());
            index.add_chunk(chunk, count);
            index.maybe_report(report);
        }
    };
    let threads = walker_threads();
    std::thread::scope(|scope| {
        for _ in 1..threads {
            scope.spawn(work);
        }
        work();
    });
    index.finish();
    report(index);
}

/// One thread's reusable buffers.
#[derive(Default)]
struct FileScanner {
    bytes: Vec<u8>,
    path: String,
}

impl FileScanner {
    fn scan_chunk(&mut self, roots: &[String], files: Arc<Chunk>, stop: &dyn Fn() -> bool) -> SymbolChunk {
        let mut chunk = SymbolChunk {
            files: files.clone(),
            names: String::new(),
            symbols: Vec::new(),
        };
        let root = roots.get(files.root()).map(String::as_str).unwrap_or_default();
        // Symbols point at their file with 16 bits; chunks hold 1024 files.
        for entry in 0..files.len().min(u16::MAX as usize) {
            if stop() {
                break;
            }
            let relative_path = files.path(entry);
            let Some(language) = language_for(relative_path) else {
                continue;
            };
            self.path.clear();
            self.path.push_str(root);
            if !root.ends_with('/') {
                self.path.push('/');
            }
            self.path.push_str(relative_path);
            if !read_source(&self.path, &mut self.bytes) {
                continue;
            }
            let Ok(text) = std::str::from_utf8(&self.bytes) else {
                continue;
            };
            if is_minified(text.as_bytes()) {
                continue;
            }
            add_definitions(&mut chunk, entry as u16, language, text);
        }
        chunk
    }
}

/// Reads a file of at most `MAX_FILE_BYTES` into `buffer`.
fn read_source(file_path: &str, buffer: &mut Vec<u8>) -> bool {
    let Ok(mut file) = std::fs::File::open(file_path) else {
        return false;
    };
    let size = file.metadata().map(|metadata| metadata.len()).unwrap_or(u64::MAX);
    if size > MAX_FILE_BYTES {
        return false;
    }
    buffer.clear();
    file.by_ref().take(MAX_FILE_BYTES).read_to_end(buffer).is_ok()
}

fn is_minified(bytes: &[u8]) -> bool {
    if bytes.len() < MINIFIED_MIN_BYTES {
        return false;
    }
    let lines = memchr::memchr_iter(b'\n', bytes).count() + 1;
    bytes.len() / lines > MINIFIED_LINE
}

/// Appends `text` to `names` and returns where it starts.
fn push_name(names: &mut String, text: &str) -> u32 {
    let start = names.len() as u32;
    names.push_str(text);
    start
}

fn add_definitions(chunk: &mut SymbolChunk, file: u16, language: extract::Language, text: &str) {
    let SymbolChunk { names, symbols, .. } = chunk;
    // Consecutive methods share their class name.
    let mut last_container: Option<(&str, u32)> = None;
    extract::extract(language, text, &mut |definition| {
        if definition.name.len() > MAX_NAME || definition.name == "_" {
            return;
        }
        let (container, container_len) = match definition.container.filter(|container| container.len() <= MAX_NAME) {
            Some(container) => match last_container {
                Some((previous, offset)) if previous == container => (offset, container.len()),
                _ => {
                    let offset = push_name(names, container);
                    last_container = Some((container, offset));
                    (offset, container.len())
                }
            },
            None => (0, 0),
        };
        let name = push_name(names, definition.name);
        symbols.push(Symbol {
            name,
            container,
            line: definition.line,
            file,
            column: definition.column.min(u16::MAX as u32) as u16,
            name_len: definition.name.len() as u8,
            container_len: container_len as u8,
            kind: definition.kind.code(),
        });
    });
}

// ---------------------------------------------------------------------------
// Querying

/// A query: the name, and the container before a "." or "::" ("Cart.add").
struct SymbolQuery {
    name: Option<Needle>,
    container: Option<Needle>,
    /// The name as typed, for the same-case bonus.
    exact: String,
}

fn parse_query(raw: &str) -> Option<SymbolQuery> {
    let text: String = raw.chars().filter(|character| !character.is_whitespace()).collect();
    let text = text.replace("::", ".").replace('#', ".");
    let (container, name) = match text.rsplit_once('.') {
        Some((container, name)) => (Needle::new(container), name),
        None => (None, text.as_str()),
    };
    let needle = Needle::new(name);
    if needle.is_none() && container.is_none() {
        return None;
    }
    Some(SymbolQuery {
        exact: name.to_string(),
        name: needle,
        container,
    })
}

fn pack(tier: u32, raw: u32) -> u32 {
    (tier << TIER_SHIFT) | raw.min(RAW_MAX)
}

/// Exact name (same case first), then prefix, then fuzzy.
fn name_tier(name: &str, needle: &Needle, exact: &str) -> u32 {
    if name == exact {
        return TIER_EXACT_CASE;
    }
    let mut name_chars = name.chars().map(lower);
    for expected in needle.text().chars() {
        if name_chars.next() != Some(expected) {
            return TIER_FUZZY;
        }
    }
    if name_chars.next().is_none() {
        TIER_EXACT
    } else {
        TIER_PREFIX
    }
}

struct Scorer {
    matcher: Matcher,
    buf: Vec<char>,
}

impl Scorer {
    fn new() -> Scorer {
        let mut config = Config::DEFAULT;
        config.ignore_case = true;
        config.normalize = false;
        config.prefer_prefix = true;
        Scorer {
            matcher: Matcher::new(config),
            buf: Vec::new(),
        }
    }

    fn fuzzy(&mut self, text: &str, needle: Utf32Str<'_>, indices: Option<&mut Vec<u32>>) -> Option<u32> {
        let hay = haystack(text, &mut self.buf);
        match indices {
            None => self.matcher.fuzzy_match(hay, needle).map(u32::from),
            Some(out) => self.matcher.fuzzy_indices(hay, needle, out).map(u32::from),
        }
    }

    fn score(&mut self, query: &SymbolQuery, name: &str, container: &str) -> Option<u32> {
        let container_score = match &query.container {
            Some(needle) => self.fuzzy(container, needle.all(), None)?,
            None => 0,
        };
        let Some(needle) = &query.name else {
            return Some(pack(TIER_FUZZY, container_score));
        };
        let name_score = self.fuzzy(name, needle.all(), None)?;
        Some(pack(name_tier(name, needle, &query.exact), name_score * 4 + container_score))
    }

    fn indices(&mut self, query: &SymbolQuery, name: &str, container: &str) -> (Vec<u32>, Vec<u32>) {
        let mut name_indices = Vec::new();
        let mut container_indices = Vec::new();
        if let Some(needle) = &query.name {
            self.fuzzy(name, needle.all(), Some(&mut name_indices));
        }
        if let Some(needle) = &query.container {
            self.fuzzy(container, needle.all(), Some(&mut container_indices));
        }
        for indices in [&mut name_indices, &mut container_indices] {
            indices.sort_unstable();
            indices.dedup();
        }
        (name_indices, container_indices)
    }
}

#[derive(Debug, Clone, Copy)]
struct Hit {
    score: u32,
    chunk: u32,
    symbol: u32,
}

/// Best score first, then the shorter name, then the path and line.
fn compare_hits(chunks: &[Arc<SymbolChunk>], a: &Hit, b: &Hit) -> CmpOrdering {
    b.score.cmp(&a.score).then_with(|| {
        let (chunk_a, chunk_b) = (&chunks[a.chunk as usize], &chunks[b.chunk as usize]);
        let (symbol_a, symbol_b) = (&chunk_a.symbols[a.symbol as usize], &chunk_b.symbols[b.symbol as usize]);
        symbol_a
            .name_len
            .cmp(&symbol_b.name_len)
            .then_with(|| {
                let (path_a, path_b) = (chunk_a.path(symbol_a), chunk_b.path(symbol_b));
                path_a.len().cmp(&path_b.len()).then_with(|| path_a.cmp(path_b))
            })
            .then_with(|| symbol_a.line.cmp(&symbol_b.line))
    })
}

fn keep_best(hits: &mut Vec<Hit>, limit: usize, chunks: &[Arc<SymbolChunk>]) {
    if hits.len() > limit {
        hits.select_nth_unstable_by(limit, |a, b| compare_hits(chunks, a, b));
        hits.truncate(limit);
    }
}

fn search_chunks(
    chunks: &[Arc<SymbolChunk>],
    query: &SymbolQuery,
    scope: SymbolScope,
    limit: usize,
    superseded: &(dyn Fn() -> bool + Sync),
) -> Option<(Vec<Hit>, usize)> {
    let total: usize = chunks.iter().map(|chunk| chunk.symbols.len()).sum();
    let next = AtomicUsize::new(0);
    let work = || -> Option<(Vec<Hit>, usize)> {
        let mut scorer = Scorer::new();
        let mut hits = Vec::new();
        let mut matched = 0;
        loop {
            let chunk_index = next.fetch_add(1, Ordering::Relaxed);
            let Some(chunk) = chunks.get(chunk_index) else {
                break;
            };
            if superseded() {
                return None;
            }
            for (symbol_index, symbol) in chunk.symbols.iter().enumerate() {
                if !scope.accepts(SymbolKind::from_code(symbol.kind)) {
                    continue;
                }
                if query.container.is_some() && symbol.container_len == 0 {
                    continue;
                }
                if let Some(score) = scorer.score(query, chunk.name(symbol), chunk.container(symbol)) {
                    matched += 1;
                    hits.push(Hit {
                        score,
                        chunk: chunk_index as u32,
                        symbol: symbol_index as u32,
                    });
                }
            }
            if hits.len() > limit * 8 + 1024 {
                keep_best(&mut hits, limit, chunks);
            }
        }
        keep_best(&mut hits, limit, chunks);
        Some((hits, matched))
    };
    let threads = if total < PARALLEL_THRESHOLD { 1 } else { walker_threads() };
    let parts: Vec<Option<(Vec<Hit>, usize)>> = if threads == 1 {
        vec![work()]
    } else {
        std::thread::scope(|scope| {
            let helpers: Vec<_> = (1..threads).map(|_| scope.spawn(work)).collect();
            let mut parts = vec![work()];
            parts.extend(helpers.into_iter().map(|helper| helper.join().unwrap_or(None)));
            parts
        })
    };
    let mut hits = Vec::new();
    let mut matched = 0;
    for part in parts {
        let (part_hits, part_matched) = part?;
        hits.extend(part_hits);
        matched += part_matched;
    }
    hits.sort_unstable_by(|a, b| compare_hits(chunks, a, b));
    hits.truncate(limit);
    Some((hits, matched))
}

fn empty_results(progress: SymbolSearchProgress) -> SymbolSearchResults {
    SymbolSearchResults {
        items: Vec::new(),
        matched: 0,
        files: progress.files,
        symbols: progress.symbols,
        done: progress.done,
        truncated: progress.truncated,
    }
}

/// Matches `raw_query` against what `index` holds right now.
pub fn search(
    index: &SymbolIndex,
    raw_query: &str,
    scope: SymbolScope,
    limit: usize,
    superseded: &(dyn Fn() -> bool + Sync),
) -> SymbolSearchResults {
    let (chunks, progress) = index.snapshot();
    let Some(query) = parse_query(raw_query) else {
        return empty_results(progress);
    };
    let limit = limit.clamp(1, MAX_LIMIT);
    let Some((hits, matched)) = search_chunks(&chunks, &query, scope, limit, superseded) else {
        return empty_results(progress);
    };
    let roots = index.files.roots();
    let mut scorer = Scorer::new();
    let items = hits
        .iter()
        .map(|hit| {
            let chunk = &chunks[hit.chunk as usize];
            let symbol = &chunk.symbols[hit.symbol as usize];
            let name = chunk.name(symbol);
            let container = chunk.container(symbol);
            let relative_path = chunk.path(symbol);
            let root = roots.get(chunk.files.root()).cloned().unwrap_or_default();
            let (indices, container_indices) = scorer.indices(&query, name, container);
            SymbolSearchItem {
                name: name.to_string(),
                kind: SymbolKind::from_code(symbol.kind),
                container: (!container.is_empty()).then(|| container.to_string()),
                path: join_root(&root, relative_path),
                root,
                relative_path: relative_path.to_string(),
                line: symbol.line,
                column: symbol.column as u32 + 1,
                indices,
                container_indices,
                score: hit.score,
            }
        })
        .collect();
    SymbolSearchResults {
        items,
        matched,
        files: progress.files,
        symbols: progress.symbols,
        done: progress.done,
        truncated: progress.truncated,
    }
}

#[cfg(test)]
mod tests;
