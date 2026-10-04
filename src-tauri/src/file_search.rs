//! Go to File (Search Everywhere for files): an in-memory index of
//! the workspace folders' files, built off the main thread by the ripgrep
//! walker, and fuzzy matching over it with nucleo-matcher.
//!
//! The index is a list of immutable chunks that walker threads append while
//! they run, so a query matches whatever is indexed so far and never waits
//! for a build. A rebuild runs next to the current index and replaces it only
//! when complete. The index lives while the popup is used and is dropped
//! after a short idle time, so it costs no memory the rest of the time.
//!
//! The same file list feeds the symbol index (`crate::symbols`) and Find in
//! Files (`crate::text_search`), so all three follow one set of walker rules;
//! both read chunks as they arrive (`Index::wait_chunk`). The symbol index
//! shares this session's lifecycle.

use std::cmp::Ordering as CmpOrdering;
use std::collections::HashMap;
use std::ops::Range;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex, MutexGuard, Weak};
use std::time::{Duration, Instant};

use ignore::{DirEntry, ParallelVisitor, ParallelVisitorBuilder, WalkBuilder, WalkState};
use nucleo_matcher::{Config, Matcher, Utf32Str};
use serde::Serialize;

use crate::git::workspace::SKIPPED_DIRS;
use crate::symbols::{SymbolIndex, SymbolScope, SymbolSearchProgress, SymbolSearchResults, MAX_SYMBOLS};
use crate::text_search::replace::{ReplaceOutcome, ReplaceRequest};
use crate::text_search::{TextSearchBatch, TextSearchOptions};

/// Hard cap on indexed files; the results say when it was hit.
pub const MAX_FILES: usize = 500_000;
pub const DEFAULT_LIMIT: usize = 50;
const MAX_LIMIT: usize = 500;
/// A walker thread hands its files over after this many, or after `CHUNK_INTERVAL`,
/// so the first results show up while a big folder is still being indexed.
const CHUNK_FILES: usize = 1024;
const CHUNK_INTERVAL: Duration = Duration::from_millis(40);
const PROGRESS_INTERVAL_MS: u64 = 100;
/// The index is dropped this long after the popup closed...
const IDLE_DROP: Duration = Duration::from_secs(120);
/// ...or after this long without any use, in case the popup never said it closed.
const ABANDONED_DROP: Duration = Duration::from_secs(30 * 60);
const REAP_INTERVAL: Duration = Duration::from_secs(10);
/// Below this many files one thread matches faster than starting more.
const PARALLEL_THRESHOLD: usize = 16_384;
const MAX_THREADS: usize = 8;

/// Score tiers, best last: a path match ("srccart" in src/cart.ts), a fuzzy
/// file name match, a name prefix, and the whole name (or its stem).
const TIER_PATH: u32 = 0;
const TIER_FUZZY: u32 = 1;
const TIER_PREFIX: u32 = 2;
const TIER_EXACT: u32 = 3;
const TIER_SHIFT: u32 = 24;
const RAW_MAX: u32 = (1 << TIER_SHIFT) - 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchProgress {
    pub indexed: usize,
    pub done: bool,
    /// The index stopped at `MAX_FILES`.
    pub truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchItem {
    /// Absolute path: the workspace folder joined with `relative_path`.
    pub path: String,
    /// The workspace folder the file was found in.
    pub root: String,
    /// `/`-separated path below `root`.
    pub relative_path: String,
    /// Matched characters of `relative_path`, as code point indices, ascending.
    pub indices: Vec<u32>,
    pub score: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchResults {
    pub items: Vec<FileSearchItem>,
    /// Every file that matched; `items` holds the best of them.
    pub matched: usize,
    pub indexed: usize,
    pub done: bool,
    pub truncated: bool,
    /// 1-based line and column from a "name:LINE:COL" query.
    pub line: Option<u32>,
    pub column: Option<u32>,
}

pub type ProgressSink = Box<dyn Fn(FileSearchProgress) + Send + Sync>;
pub type SymbolProgressSink = Box<dyn Fn(SymbolSearchProgress) + Send + Sync>;

// ---------------------------------------------------------------------------
// Index

/// Files of one workspace folder, packed into one string.
pub struct Chunk {
    root: usize,
    text: String,
    /// End offset in `text` of each path.
    ends: Vec<u32>,
}

impl Chunk {
    /// Index of the workspace folder in `Index::roots`.
    pub fn root(&self) -> usize {
        self.root
    }

    pub fn len(&self) -> usize {
        self.ends.len()
    }

    /// `/`-separated path below the workspace folder.
    pub fn path(&self, entry: usize) -> &str {
        let start = if entry == 0 { 0 } else { self.ends[entry - 1] as usize };
        &self.text[start..self.ends[entry] as usize]
    }

    fn truncate(&mut self, files: usize) {
        self.ends.truncate(files);
        self.text.truncate(self.ends.last().map(|end| *end as usize).unwrap_or(0));
    }
}

pub struct Index {
    roots: Vec<String>,
    max_files: usize,
    chunks: Mutex<Vec<Arc<Chunk>>>,
    /// Signalled when a chunk is added and when the build ends.
    chunk_added: Condvar,
    indexed: AtomicUsize,
    done: AtomicBool,
    truncated: AtomicBool,
    cancelled: AtomicBool,
    started: Instant,
    /// Milliseconds after `started` (plus one) of the last progress report; 0 before the first.
    last_report: AtomicU64,
}

pub fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl Index {
    fn new(roots: Vec<String>, max_files: usize) -> Index {
        Index {
            roots,
            max_files,
            chunks: Mutex::new(Vec::new()),
            chunk_added: Condvar::new(),
            indexed: AtomicUsize::new(0),
            done: AtomicBool::new(false),
            truncated: AtomicBool::new(false),
            cancelled: AtomicBool::new(false),
            started: Instant::now(),
            last_report: AtomicU64::new(0),
        }
    }

    fn stopped(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed) || self.truncated.load(Ordering::Relaxed)
    }

    pub fn is_done(&self) -> bool {
        self.done.load(Ordering::Acquire)
    }

    pub fn roots(&self) -> &[String] {
        &self.roots
    }

    /// Marks the build complete and wakes every `wait_chunk`.
    fn finish(&self) {
        let _chunks = lock(&self.chunks);
        self.done.store(true, Ordering::Release);
        self.chunk_added.notify_all();
    }

    /// Chunk `number` in arrival order, waiting while the build may still add
    /// it; None once the build ended without it or when `stop` says so.
    pub fn wait_chunk(&self, number: usize, stop: &dyn Fn() -> bool) -> Option<Arc<Chunk>> {
        let mut chunks = lock(&self.chunks);
        loop {
            if let Some(chunk) = chunks.get(number) {
                return Some(chunk.clone());
            }
            if self.is_done() || stop() {
                return None;
            }
            // The timeout rechecks `stop`, which nothing signals.
            chunks = self
                .chunk_added
                .wait_timeout(chunks, Duration::from_millis(20))
                .map(|(guard, _)| guard)
                .unwrap_or_else(|poisoned| poisoned.into_inner().0);
        }
    }

    fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }

    fn progress(&self) -> FileSearchProgress {
        FileSearchProgress {
            indexed: self.indexed.load(Ordering::Relaxed),
            done: self.is_done(),
            truncated: self.truncated.load(Ordering::Relaxed),
        }
    }

    /// Appends a chunk, cutting it at the file cap.
    fn add_chunk(&self, mut chunk: Chunk) {
        let mut chunks = lock(&self.chunks);
        let indexed = self.indexed.load(Ordering::Relaxed);
        let room = self.max_files.saturating_sub(indexed);
        if chunk.len() > room {
            chunk.truncate(room);
            self.truncated.store(true, Ordering::Relaxed);
        }
        if chunk.len() == 0 {
            return;
        }
        chunk.text.shrink_to_fit();
        chunk.ends.shrink_to_fit();
        self.indexed.store(indexed + chunk.len(), Ordering::Relaxed);
        chunks.push(Arc::new(chunk));
        self.chunk_added.notify_all();
    }

    /// What a query sees: `done` is read first, so a done snapshot holds every chunk.
    fn snapshot(&self) -> (Vec<Arc<Chunk>>, bool, bool) {
        let done = self.is_done();
        let truncated = self.truncated.load(Ordering::Relaxed);
        (lock(&self.chunks).clone(), done, truncated)
    }

    /// Reports at most every `PROGRESS_INTERVAL_MS`, and right away the first time.
    fn maybe_report(&self, report: &(dyn Fn(&Index) + Sync)) {
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

pub fn walker_threads() -> usize {
    std::thread::available_parallelism()
        .map(|threads| threads.get())
        .unwrap_or(4)
        .min(MAX_THREADS)
}

/// Walks every root in turn, then marks the index done and reports once more.
fn build_index(index: &Index, report: &(dyn Fn(&Index) + Sync)) {
    for root_index in 0..index.roots.len() {
        if index.stopped() {
            break;
        }
        walk_root(index, root_index, report);
    }
    index.finish();
    report(index);
}

fn walk_root(index: &Index, root_index: usize, report: &(dyn Fn(&Index) + Sync)) {
    let root = Path::new(&index.roots[root_index]);
    if !root.is_dir() {
        return;
    }
    // A workspace folder inside another one is listed under its own name only.
    let nested: Vec<PathBuf> = index
        .roots
        .iter()
        .filter(|other| Path::new(other.as_str()) != root && Path::new(other.as_str()).starts_with(root))
        .map(PathBuf::from)
        .collect();
    let mut builder = WalkBuilder::new(root);
    builder
        .hidden(false)
        .follow_links(false)
        .threads(walker_threads())
        .filter_entry(move |entry| keep_entry(entry, &nested));
    let mut visitors = CollectorBuilder {
        index,
        root_index,
        root,
        report,
    };
    builder.build_parallel().visit(&mut visitors);
}

/// Skips `.git`, the dependency and build folders, and nested workspace folders.
fn keep_entry(entry: &DirEntry, nested: &[PathBuf]) -> bool {
    if entry.depth() == 0 {
        return true;
    }
    let name = entry.file_name();
    if name == ".git" {
        return false;
    }
    let is_dir = entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false);
    if !is_dir {
        return true;
    }
    let skipped = name.to_str().map(|name| SKIPPED_DIRS.contains(&name)).unwrap_or(false);
    !skipped && !nested.iter().any(|folder| folder == entry.path())
}

/// Regular files, and symlinks to files; symlinked folders are never followed.
fn is_file(entry: &DirEntry) -> bool {
    match entry.file_type() {
        Some(kind) if kind.is_file() => true,
        Some(kind) if kind.is_symlink() => std::fs::metadata(entry.path())
            .map(|metadata| metadata.is_file())
            .unwrap_or(false),
        _ => false,
    }
}

struct CollectorBuilder<'s> {
    index: &'s Index,
    root_index: usize,
    root: &'s Path,
    report: &'s (dyn Fn(&Index) + Sync),
}

impl<'s> ParallelVisitorBuilder<'s> for CollectorBuilder<'s> {
    fn build(&mut self) -> Box<dyn ParallelVisitor + 's> {
        Box::new(Collector {
            index: self.index,
            root_index: self.root_index,
            root: self.root,
            report: self.report,
            text: String::new(),
            ends: Vec::new(),
            last_flush: Instant::now(),
        })
    }
}

/// One walker thread's files, handed to the index in chunks.
struct Collector<'s> {
    index: &'s Index,
    root_index: usize,
    root: &'s Path,
    report: &'s (dyn Fn(&Index) + Sync),
    text: String,
    ends: Vec<u32>,
    last_flush: Instant,
}

impl Collector<'_> {
    fn flush(&mut self) {
        self.last_flush = Instant::now();
        if self.ends.is_empty() {
            return;
        }
        self.index.add_chunk(Chunk {
            root: self.root_index,
            text: std::mem::take(&mut self.text),
            ends: std::mem::take(&mut self.ends),
        });
        self.index.maybe_report(self.report);
    }
}

impl ParallelVisitor for Collector<'_> {
    fn visit(&mut self, entry: Result<DirEntry, ignore::Error>) -> WalkState {
        if self.index.stopped() {
            return WalkState::Quit;
        }
        let Ok(entry) = entry else {
            return WalkState::Continue;
        };
        if entry.depth() == 0 || !is_file(&entry) {
            return WalkState::Continue;
        }
        // Paths that are not UTF-8 could not be opened from the UI anyway.
        let Some(relative) = entry.path().strip_prefix(self.root).ok().and_then(Path::to_str) else {
            return WalkState::Continue;
        };
        if cfg!(windows) {
            self.text.push_str(&relative.replace('\\', "/"));
        } else {
            self.text.push_str(relative);
        }
        self.ends.push(self.text.len() as u32);
        if self.ends.len() >= CHUNK_FILES || self.last_flush.elapsed() >= CHUNK_INTERVAL {
            self.flush();
        }
        WalkState::Continue
    }
}

impl Drop for Collector<'_> {
    fn drop(&mut self) {
        self.flush();
    }
}

// ---------------------------------------------------------------------------
// Query parsing

/// Splits a trailing ":LINE" or ":LINE:COL" (1-based) off a query. An
/// unfinished trailing ":" is dropped so results stay while typing.
pub fn split_location(query: &str) -> (&str, Option<u32>, Option<u32>) {
    let mut text = query.trim();
    if let Some(stripped) = text.strip_suffix(':') {
        text = stripped;
    }
    let mut numbers = Vec::new();
    while numbers.len() < 2 {
        match text.rsplit_once(':') {
            Some((head, tail)) if !tail.is_empty() && tail.bytes().all(|byte| byte.is_ascii_digit()) => {
                numbers.push(tail.parse::<u32>().ok());
                text = head;
            }
            _ => break,
        }
    }
    numbers.reverse();
    let line = numbers.first().copied().flatten();
    let column = numbers.get(1).copied().flatten();
    (text.trim(), line, column)
}

pub fn lower(character: char) -> char {
    if character.is_ascii() {
        character.to_ascii_lowercase()
    } else {
        character.to_lowercase().next().unwrap_or(character)
    }
}

/// One lowercased query segment, without whitespace.
#[derive(Debug, Clone)]
pub struct Needle {
    text: String,
    chars: Vec<char>,
}

impl Needle {
    pub fn new(segment: &str) -> Option<Needle> {
        let text: String = segment.chars().filter(|character| !character.is_whitespace()).map(lower).collect();
        if text.is_empty() {
            return None;
        }
        let chars = text.chars().collect();
        Some(Needle { text, chars })
    }

    pub fn len(&self) -> usize {
        self.chars.len()
    }

    /// The lowercased text.
    pub fn text(&self) -> &str {
        &self.text
    }

    fn slice(&self, range: Range<usize>) -> Utf32Str<'_> {
        if self.text.is_ascii() {
            Utf32Str::Ascii(&self.text.as_bytes()[range])
        } else {
            Utf32Str::Unicode(&self.chars[range])
        }
    }

    pub fn all(&self) -> Utf32Str<'_> {
        self.slice(0..self.len())
    }
}

#[derive(Debug, Clone)]
pub struct SearchQuery {
    /// Folder segments in order: "views/Log" has "views".
    dirs: Vec<Needle>,
    /// The file name segment; none matches any name ("src/").
    name: Option<Needle>,
    /// A leading "/": the first segment matches the first path component, and
    /// a plain "/name" only files directly in a workspace folder.
    anchored: bool,
    /// No "/" at all: the query may also spread over folders ("srccart").
    plain: bool,
    pub line: Option<u32>,
    pub column: Option<u32>,
}

/// Parses a query; None when there is nothing to match.
pub fn parse_query(raw: &str) -> Option<SearchQuery> {
    let (text, line, column) = split_location(raw);
    let text = text.replace('\\', "/");
    let anchored = text.starts_with('/');
    let body = text.trim_start_matches('/');
    let mut segments: Vec<&str> = body.split('/').collect();
    let last = segments.pop().unwrap_or_default();
    let dirs: Vec<Needle> = segments.into_iter().filter_map(Needle::new).collect();
    let name = Needle::new(last);
    if dirs.is_empty() && name.is_none() && !anchored {
        return None;
    }
    Some(SearchQuery {
        plain: !text.contains('/'),
        dirs,
        name,
        anchored,
        line,
        column,
    })
}

// ---------------------------------------------------------------------------
// Matching

fn pack(tier: u32, raw: u32) -> u32 {
    (tier << TIER_SHIFT) | raw.min(RAW_MAX)
}

/// The haystack as code points, so match indices are code point indices.
pub fn haystack<'a>(text: &'a str, buf: &'a mut Vec<char>) -> Utf32Str<'a> {
    if text.is_ascii() {
        Utf32Str::Ascii(text.as_bytes())
    } else {
        buf.clear();
        buf.extend(text.chars());
        Utf32Str::Unicode(buf)
    }
}

fn char_offset(text: &str, byte_offset: usize) -> u32 {
    if text.is_ascii() {
        byte_offset as u32
    } else {
        text[..byte_offset].chars().count() as u32
    }
}

/// Whole name or stem ("cart" in cart.ts and cart.test.ts), then prefix, then fuzzy.
fn name_tier(name: &str, needle: &Needle) -> u32 {
    let mut name_chars = name.chars().map(lower);
    for expected in &needle.chars {
        if name_chars.next() != Some(*expected) {
            return TIER_FUZZY;
        }
    }
    match name_chars.next() {
        None | Some('.') => TIER_EXACT,
        _ => TIER_PREFIX,
    }
}

/// How many trailing characters of `needle` appear in order in `name`.
fn suffix_in(name: &str, needle: &Needle) -> usize {
    let mut remaining = needle.len();
    for character in name.chars().rev() {
        if remaining == 0 {
            break;
        }
        if lower(character) == needle.chars[remaining - 1] {
            remaining -= 1;
        }
    }
    needle.len() - remaining
}

/// A relative path split into its folder (without the last "/") and name.
fn split_path(path: &str) -> (&str, &str, usize) {
    match path.rfind('/') {
        Some(slash) => (&path[..slash], &path[slash + 1..], slash + 1),
        None => ("", path, 0),
    }
}

/// Matches paths against a query; owns the matcher's scratch memory, so one per thread.
struct Scorer {
    matcher: Matcher,
    buf: Vec<char>,
    scratch: Vec<u32>,
}

impl Scorer {
    fn new() -> Scorer {
        let mut config = Config::DEFAULT.match_paths();
        config.ignore_case = true;
        config.normalize = false;
        config.prefer_prefix = true;
        Scorer {
            matcher: Matcher::new(config),
            buf: Vec::new(),
            scratch: Vec::new(),
        }
    }

    /// Fuzzy score of `needle` in `text`; with `indices`, appends the matched
    /// positions shifted by `offset` (the code point offset of `text` in the path).
    fn fuzzy(&mut self, text: &str, needle: Utf32Str<'_>, indices: Option<(&mut Vec<u32>, u32)>) -> Option<u32> {
        let Scorer { matcher, buf, scratch } = self;
        let hay = haystack(text, buf);
        match indices {
            None => matcher.fuzzy_match(hay, needle).map(u32::from),
            Some((out, offset)) => {
                scratch.clear();
                let score = matcher.fuzzy_indices(hay, needle, scratch)?;
                out.extend(scratch.iter().map(|index| index + offset));
                Some(u32::from(score))
            }
        }
    }

    /// Each folder segment matches a later folder component than the one before.
    fn match_dirs(&mut self, query: &SearchQuery, dir: &str, mut indices: Option<&mut Vec<u32>>) -> Option<u32> {
        let mut total = 0;
        let mut components = dir
            .split('/')
            .scan(0usize, |start, component| {
                let begin = *start;
                *start += component.len() + 1;
                Some((begin, component))
            })
            .enumerate();
        for (segment, needle) in query.dirs.iter().enumerate() {
            loop {
                let (position, (begin, component)) = components.next()?;
                if query.anchored && segment == 0 && position != 0 {
                    return None;
                }
                let target = indices.as_deref_mut().map(|out| (out, char_offset(dir, begin)));
                if let Some(score) = self.fuzzy(component, needle.all(), target) {
                    total += score;
                    break;
                }
            }
        }
        Some(total)
    }

    /// "srccart" in src/cart.ts: the longest tail of the needle found in the
    /// name matches there, the rest in the folders.
    fn split_match(&mut self, needle: &Needle, dir: &str, name: &str, name_offset: u32, mut indices: Option<&mut Vec<u32>>) -> Option<u32> {
        let tail = suffix_in(name, needle);
        if tail == 0 || tail >= needle.len() {
            return None;
        }
        let split = needle.len() - tail;
        let dir_score = self.fuzzy(dir, needle.slice(0..split), indices.as_deref_mut().map(|out| (out, 0)))?;
        let name_score = self.fuzzy(name, needle.slice(split..needle.len()), indices.map(|out| (out, name_offset)))?;
        Some(dir_score + name_score)
    }

    /// The score of `path`, or None when it does not match; with `indices`,
    /// also collects the matched code points.
    fn score(&mut self, query: &SearchQuery, path: &str, mut indices: Option<&mut Vec<u32>>) -> Option<u32> {
        let (dir, name, name_start) = split_path(path);
        if query.anchored && query.dirs.is_empty() && !dir.is_empty() {
            return None;
        }
        let dir_score = if query.dirs.is_empty() {
            0
        } else {
            self.match_dirs(query, dir, indices.as_deref_mut())?
        };
        let Some(needle) = &query.name else {
            return Some(pack(TIER_FUZZY, dir_score));
        };
        let name_offset = if indices.is_some() { char_offset(path, name_start) } else { 0 };
        let target = indices.as_deref_mut().map(|out| (out, name_offset));
        if let Some(name_score) = self.fuzzy(name, needle.all(), target) {
            return Some(pack(name_tier(name, needle), name_score * 4 + dir_score));
        }
        // Short needles would match nearly every path this way.
        if query.plain && !dir.is_empty() && needle.len() >= 3 {
            return self
                .split_match(needle, dir, name, name_offset, indices)
                .map(|score| pack(TIER_PATH, score));
        }
        None
    }

    fn indices(&mut self, query: &SearchQuery, path: &str) -> Vec<u32> {
        let mut indices = Vec::new();
        self.score(query, path, Some(&mut indices));
        indices.sort_unstable();
        indices.dedup();
        indices
    }
}

#[derive(Debug, Clone, Copy)]
struct Hit {
    score: u32,
    chunk: u32,
    entry: u32,
}

fn hit_path<'a>(chunks: &'a [Arc<Chunk>], hit: &Hit) -> &'a str {
    chunks[hit.chunk as usize].path(hit.entry as usize)
}

/// Best score first, then the shorter path, then alphabetical.
fn compare_hits(chunks: &[Arc<Chunk>], a: &Hit, b: &Hit) -> CmpOrdering {
    b.score.cmp(&a.score).then_with(|| {
        let (path_a, path_b) = (hit_path(chunks, a), hit_path(chunks, b));
        path_a.len().cmp(&path_b.len()).then_with(|| path_a.cmp(path_b))
    })
}

fn keep_best(hits: &mut Vec<Hit>, limit: usize, chunks: &[Arc<Chunk>]) {
    if hits.len() > limit {
        hits.select_nth_unstable_by(limit, |a, b| compare_hits(chunks, a, b));
        hits.truncate(limit);
    }
}

/// The best `limit` hits over all chunks and how many matched; None when
/// `superseded` says a newer query made this one pointless.
fn search_chunks(
    chunks: &[Arc<Chunk>],
    query: &SearchQuery,
    limit: usize,
    superseded: &(dyn Fn() -> bool + Sync),
) -> Option<(Vec<Hit>, usize)> {
    let total: usize = chunks.iter().map(|chunk| chunk.len()).sum();
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
            for entry in 0..chunk.len() {
                if let Some(score) = scorer.score(query, chunk.path(entry), None) {
                    matched += 1;
                    hits.push(Hit {
                        score,
                        chunk: chunk_index as u32,
                        entry: entry as u32,
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

pub fn join_root(root: &str, relative_path: &str) -> String {
    if root.ends_with('/') {
        format!("{root}{relative_path}")
    } else {
        format!("{root}/{relative_path}")
    }
}

fn empty_results(progress: FileSearchProgress, line: Option<u32>, column: Option<u32>) -> FileSearchResults {
    FileSearchResults {
        items: Vec::new(),
        matched: 0,
        indexed: progress.indexed,
        done: progress.done,
        truncated: progress.truncated,
        line,
        column,
    }
}

/// Matches `raw_query` against what `index` holds right now.
fn search_index(index: &Index, raw_query: &str, limit: usize, superseded: &(dyn Fn() -> bool + Sync)) -> FileSearchResults {
    let (chunks, done, truncated) = index.snapshot();
    let indexed = chunks.iter().map(|chunk| chunk.len()).sum();
    let progress = FileSearchProgress { indexed, done, truncated };
    let Some(query) = parse_query(raw_query) else {
        let (_, line, column) = split_location(raw_query);
        return empty_results(progress, line, column);
    };
    let limit = limit.clamp(1, MAX_LIMIT);
    let Some((hits, matched)) = search_chunks(&chunks, &query, limit, superseded) else {
        return empty_results(progress, query.line, query.column);
    };
    let mut scorer = Scorer::new();
    let items = hits
        .iter()
        .map(|hit| {
            let chunk = &chunks[hit.chunk as usize];
            let relative_path = chunk.path(hit.entry as usize);
            let root = index.roots.get(chunk.root).cloned().unwrap_or_default();
            FileSearchItem {
                path: join_root(&root, relative_path),
                root,
                relative_path: relative_path.to_string(),
                indices: scorer.indices(&query, relative_path),
                score: hit.score,
            }
        })
        .collect();
    FileSearchResults {
        items,
        matched,
        indexed,
        done,
        truncated,
        line: query.line,
        column: query.column,
    }
}

// ---------------------------------------------------------------------------
// Lifecycle

struct Session {
    roots: Vec<String>,
    /// What queries use; may still be building the first time.
    current: Arc<Index>,
    /// A rebuild, swapped in once complete.
    pending: Option<Arc<Index>>,
    /// Files were created, deleted or renamed since `current` started.
    stale: bool,
    /// The popup is showing.
    open: bool,
    last_used: Instant,
    sink: Option<ProgressSink>,
    /// Classes and Symbols: built on first use from this session's files.
    symbols: Option<SymbolSlot>,
}

/// The symbol index and its rebuild, like `Session` does for files.
struct SymbolSlot {
    current: Arc<SymbolIndex>,
    pending: Option<Arc<SymbolIndex>>,
    /// Source files changed since `current` started.
    stale: bool,
    sink: Option<SymbolProgressSink>,
}

impl SymbolSlot {
    fn promote(&mut self) -> bool {
        if self.pending.as_ref().is_some_and(|pending| pending.is_done()) {
            if let Some(pending) = self.pending.take() {
                self.current = pending;
                return true;
            }
        }
        false
    }

    fn report(&self) {
        if let Some(sink) = &self.sink {
            sink(self.current.progress());
        }
    }
}

impl Session {
    fn cancel(&self) {
        self.current.cancel();
        if let Some(pending) = &self.pending {
            pending.cancel();
        }
        if let Some(symbols) = &self.symbols {
            symbols.current.cancel();
            if let Some(pending) = &symbols.pending {
                pending.cancel();
            }
        }
    }

    /// The file list a new symbol build should read: a running rebuild is newer.
    fn newest_files(&self) -> Arc<Index> {
        self.pending.clone().unwrap_or_else(|| self.current.clone())
    }

    /// Swaps in a finished rebuild.
    fn promote(&mut self) -> bool {
        if self.pending.as_ref().is_some_and(|pending| pending.is_done()) {
            if let Some(pending) = self.pending.take() {
                self.current = pending;
                return true;
            }
        }
        false
    }

    fn report(&self) {
        if let Some(sink) = &self.sink {
            sink(self.current.progress());
        }
    }
}

struct Shared {
    session: Mutex<Option<Session>>,
    /// Bumped by every query; a running query stops when it is no longer the latest.
    query_seq: AtomicU64,
    /// Like `query_seq`, one per symbol scope: the All tab asks for Classes and Members at
    /// once, and neither may stop the other.
    symbol_seq: [AtomicU64; SymbolScope::COUNT],
    /// The newest text search id (from the UI) or cancel; a running search
    /// stops when it changes, and an older one arriving late never starts.
    text_seq: AtomicU64,
    /// The newest Replace in Files id or cancel, like `text_seq`.
    replace_seq: AtomicU64,
    reaper_running: AtomicBool,
    max_files: usize,
    max_symbols: usize,
    idle_drop: Duration,
}

impl Shared {
    fn start_build(self: &Arc<Self>, roots: &[String]) -> Arc<Index> {
        let index = Arc::new(Index::new(roots.to_vec(), self.max_files));
        let worker = index.clone();
        let shared = Arc::downgrade(self);
        let spawned = std::thread::Builder::new().name("file-search-index".into()).spawn(move || {
            build_index(&worker, &|built: &Index| {
                if let Some(shared) = shared.upgrade() {
                    shared.on_build_progress(built);
                }
            });
        });
        if spawned.is_err() {
            index.finish();
        }
        index
    }

    fn start_symbol_build(self: &Arc<Self>, files: Arc<Index>) -> Arc<SymbolIndex> {
        let index = Arc::new(SymbolIndex::new(files, self.max_symbols));
        let worker = index.clone();
        let shared = Arc::downgrade(self);
        let spawned = std::thread::Builder::new().name("symbol-index".into()).spawn(move || {
            crate::symbols::build(&worker, &|built: &SymbolIndex| {
                if let Some(shared) = shared.upgrade() {
                    shared.on_symbol_progress(built);
                }
            });
        });
        if spawned.is_err() {
            index.finish();
        }
        index
    }

    /// Starts the symbol index on first use.
    fn ensure_symbols(self: &Arc<Self>, session: &mut Session) {
        if session.symbols.is_none() {
            session.symbols = Some(SymbolSlot {
                current: self.start_symbol_build(session.newest_files()),
                pending: None,
                stale: false,
                sink: None,
            });
        }
    }

    fn start_symbol_rebuild(self: &Arc<Self>, session: &mut Session) {
        let files = session.newest_files();
        let Some(symbols) = session.symbols.as_mut() else {
            return;
        };
        if symbols.pending.is_some() || !symbols.current.is_done() {
            return;
        }
        symbols.stale = false;
        symbols.pending = Some(self.start_symbol_build(files));
    }

    fn on_symbol_progress(self: &Arc<Self>, index: &SymbolIndex) {
        let mut slot = lock(&self.session);
        let Some(session) = slot.as_mut() else {
            return;
        };
        let Some(symbols) = session.symbols.as_mut() else {
            return;
        };
        let rebuild = if std::ptr::eq(Arc::as_ptr(&symbols.current), index) {
            symbols.report();
            index.is_done() && symbols.stale
        } else {
            let is_pending = symbols
                .pending
                .as_ref()
                .is_some_and(|pending| std::ptr::eq(Arc::as_ptr(pending), index));
            if is_pending && symbols.promote() {
                symbols.report();
                symbols.stale
            } else {
                false
            }
        };
        if rebuild && session.open {
            self.start_symbol_rebuild(session);
        }
    }

    /// The session for `roots`, replacing (and stopping) one for other folders.
    fn session_for<'a>(self: &Arc<Self>, slot: &'a mut Option<Session>, roots: &[String]) -> &'a mut Session {
        let mut unique: Vec<String> = Vec::new();
        for root in roots {
            if !unique.contains(root) {
                unique.push(root.clone());
            }
        }
        if slot.as_ref().is_some_and(|session| session.roots != unique) {
            if let Some(previous) = slot.take() {
                previous.cancel();
            }
        }
        slot.get_or_insert_with(|| Session {
            current: self.start_build(&unique),
            roots: unique,
            pending: None,
            stale: false,
            open: false,
            last_used: Instant::now(),
            sink: None,
            symbols: None,
        })
    }

    fn start_rebuild(self: &Arc<Self>, session: &mut Session) {
        if session.pending.is_some() || !session.current.is_done() {
            return;
        }
        session.stale = false;
        session.pending = Some(self.start_build(&session.roots));
    }

    fn on_build_progress(self: &Arc<Self>, index: &Index) {
        let mut slot = lock(&self.session);
        let Some(session) = slot.as_mut() else {
            return;
        };
        if std::ptr::eq(Arc::as_ptr(&session.current), index) {
            session.report();
            // Files changed while the first build ran.
            if index.is_done() && session.stale && session.open {
                self.start_rebuild(session);
            }
            return;
        }
        let is_pending = session
            .pending
            .as_ref()
            .is_some_and(|pending| std::ptr::eq(Arc::as_ptr(pending), index));
        if is_pending && session.promote() {
            session.report();
            if session.stale && session.open {
                self.start_rebuild(session);
            }
        }
    }

    /// Called with the session lock held, so it never races the reaper's exit.
    fn ensure_reaper(self: &Arc<Self>) {
        if self.reaper_running.swap(true, Ordering::SeqCst) {
            return;
        }
        let shared: Weak<Shared> = Arc::downgrade(self);
        let spawned = std::thread::Builder::new().name("file-search-reaper".into()).spawn(move || loop {
            std::thread::sleep(REAP_INTERVAL);
            let Some(shared) = shared.upgrade() else {
                return;
            };
            if !shared.reap() {
                return;
            }
        });
        if spawned.is_err() {
            self.reaper_running.store(false, Ordering::SeqCst);
        }
    }

    /// Drops an idle index; returns whether the reaper should keep running.
    fn reap(&self) -> bool {
        let mut slot = lock(&self.session);
        let expired = match slot.as_ref() {
            None => true,
            Some(session) => {
                let idle = session.last_used.elapsed();
                (!session.open && idle >= self.idle_drop) || idle >= ABANDONED_DROP
            }
        };
        if !expired {
            return true;
        }
        if let Some(session) = slot.take() {
            session.cancel();
        }
        self.reaper_running.store(false, Ordering::SeqCst);
        false
    }
}

/// The app's one Search Everywhere session: the file index, the symbol index
/// and Find in Files (see the module docs).
#[derive(Clone)]
pub struct FileSearch {
    shared: Arc<Shared>,
}

impl Default for FileSearch {
    fn default() -> Self {
        FileSearch::with_limits(MAX_FILES, IDLE_DROP)
    }
}

impl FileSearch {
    fn with_limits(max_files: usize, idle_drop: Duration) -> FileSearch {
        FileSearch {
            shared: Arc::new(Shared {
                session: Mutex::new(None),
                query_seq: AtomicU64::new(0),
                symbol_seq: Default::default(),
                text_seq: AtomicU64::new(0),
                replace_seq: AtomicU64::new(0),
                reaper_running: AtomicBool::new(false),
                max_files,
                max_symbols: MAX_SYMBOLS,
                idle_drop,
            }),
        }
    }

    /// The popup opened: starts (or reuses) the index of `roots` and reports
    /// its progress to `sink` until the popup closes. Returns quickly.
    pub fn open(&self, roots: &[String], sink: ProgressSink) -> FileSearchProgress {
        let mut slot = lock(&self.shared.session);
        let session = self.shared.session_for(&mut slot, roots);
        session.open = true;
        session.last_used = Instant::now();
        session.sink = Some(sink);
        session.promote();
        if session.stale {
            self.shared.start_rebuild(session);
        }
        let progress = session.current.progress();
        self.shared.ensure_reaper();
        progress
    }

    /// Matches `query` against what is indexed for `roots` so far.
    pub fn query(&self, roots: &[String], query: &str, limit: usize) -> FileSearchResults {
        let seq = self.shared.query_seq.fetch_add(1, Ordering::SeqCst) + 1;
        let index = {
            let mut slot = lock(&self.shared.session);
            let session = self.shared.session_for(&mut slot, roots);
            session.last_used = Instant::now();
            session.promote();
            let index = session.current.clone();
            self.shared.ensure_reaper();
            index
        };
        let shared = &self.shared;
        search_index(&index, query, limit, &|| shared.query_seq.load(Ordering::Relaxed) != seq)
    }

    /// A symbol tab showed: starts (or reuses) the symbol index of `roots`
    /// and reports its progress to `sink` until the popup closes.
    pub fn open_symbols(&self, roots: &[String], sink: SymbolProgressSink) -> SymbolSearchProgress {
        let mut slot = lock(&self.shared.session);
        let session = self.shared.session_for(&mut slot, roots);
        session.last_used = Instant::now();
        session.promote();
        self.shared.ensure_symbols(session);
        let stale = session.symbols.as_ref().is_some_and(|symbols| symbols.stale);
        if stale {
            self.shared.start_symbol_rebuild(session);
        }
        let progress = session.symbols.as_mut().map(|symbols| {
            symbols.sink = Some(sink);
            symbols.promote();
            symbols.current.progress()
        });
        self.shared.ensure_reaper();
        progress.unwrap_or_default()
    }

    /// Matches `query` against the symbols found in `roots` so far.
    pub fn query_symbols(&self, roots: &[String], query: &str, scope: SymbolScope, limit: usize) -> SymbolSearchResults {
        let latest = &self.shared.symbol_seq[scope.index()];
        let seq = latest.fetch_add(1, Ordering::SeqCst) + 1;
        let index = {
            let mut slot = lock(&self.shared.session);
            let session = self.shared.session_for(&mut slot, roots);
            session.last_used = Instant::now();
            session.promote();
            self.shared.ensure_symbols(session);
            self.shared.ensure_reaper();
            session.symbols.as_mut().map(|symbols| {
                symbols.promote();
                symbols.current.clone()
            })
        };
        let Some(index) = index else {
            return SymbolSearchResults::default();
        };
        crate::symbols::search(&index, query, scope, limit, &|| latest.load(Ordering::Relaxed) != seq)
    }

    /// Find in Files over the indexed files of `roots`, streaming batches to
    /// `sink`. Returns when done, or soon after a newer search or a cancel.
    /// `search_id` grows with every search the UI starts.
    pub fn search_text(
        &self,
        roots: &[String],
        search_id: u64,
        query: &str,
        options: &TextSearchOptions,
        sink: &(dyn Fn(TextSearchBatch) + Sync),
    ) {
        let newest = self.shared.text_seq.fetch_max(search_id, Ordering::SeqCst);
        if newest > search_id {
            sink(TextSearchBatch {
                done: true,
                ..TextSearchBatch::default()
            });
            return;
        }
        let seq = search_id;
        let files = {
            let mut slot = lock(&self.shared.session);
            let session = self.shared.session_for(&mut slot, roots);
            session.last_used = Instant::now();
            session.promote();
            self.shared.ensure_reaper();
            session.current.clone()
        };
        let shared = &self.shared;
        crate::text_search::search(&files, query, options, &|| shared.text_seq.load(Ordering::Relaxed) != seq, sink);
    }

    /// Stops the running text search and every older one still on its way.
    pub fn cancel_text_search(&self, search_id: u64) {
        self.shared.text_seq.fetch_max(search_id, Ordering::SeqCst);
    }

    /// Replace in Files over the indexed files of `roots` (or a preview count).
    /// A newer `replace_id` or a cancel stops it between files.
    pub fn replace_text(&self, roots: &[String], replace_id: u64, request: &ReplaceRequest) -> ReplaceOutcome {
        let newest = self.shared.replace_seq.fetch_max(replace_id, Ordering::SeqCst);
        if newest > replace_id {
            return ReplaceOutcome {
                cancelled: true,
                preview: request.preview,
                ..ReplaceOutcome::default()
            };
        }
        let files = {
            let mut slot = lock(&self.shared.session);
            let session = self.shared.session_for(&mut slot, roots);
            session.last_used = Instant::now();
            session.promote();
            self.shared.ensure_reaper();
            session.current.clone()
        };
        let shared = &self.shared;
        crate::text_search::replace::replace(&files, request, &|| {
            shared.replace_seq.load(Ordering::Relaxed) != replace_id
        })
    }

    /// Stops the running replace (after the file it is on) and every older one.
    pub fn cancel_replace(&self, replace_id: u64) {
        self.shared.replace_seq.fetch_max(replace_id, Ordering::SeqCst);
    }

    /// The popup closed: the index stays for `IDLE_DROP`, so reopening is instant.
    pub fn close(&self) {
        self.shared.text_seq.fetch_add(1, Ordering::SeqCst);
        let mut slot = lock(&self.shared.session);
        if let Some(session) = slot.as_mut() {
            session.open = false;
            session.sink = None;
            session.last_used = Instant::now();
            if let Some(symbols) = session.symbols.as_mut() {
                symbols.sink = None;
            }
        }
    }

    /// Drops the indexes now, stopping any build (the window closed).
    pub fn shutdown(&self) {
        self.shared.text_seq.fetch_add(1, Ordering::SeqCst);
        self.shared.replace_seq.fetch_add(1, Ordering::SeqCst);
        let session = lock(&self.shared.session).take();
        if let Some(session) = session {
            session.cancel();
        }
    }

    /// Files were created, deleted or renamed: rebuild now while the popup
    /// shows, otherwise when it opens next.
    pub fn mark_stale(&self) {
        let mut slot = lock(&self.shared.session);
        if let Some(session) = slot.as_mut() {
            session.stale = true;
            if session.open {
                self.shared.start_rebuild(session);
            }
            if let Some(symbols) = session.symbols.as_mut() {
                symbols.stale = true;
            }
            if session.open {
                self.shared.start_symbol_rebuild(session);
            }
        }
    }

    /// Source files were edited: only the symbols are out of date. Rebuilt
    /// now while the popup shows, otherwise when a symbol tab shows next.
    pub fn mark_contents_changed(&self) {
        let mut slot = lock(&self.shared.session);
        if let Some(session) = slot.as_mut() {
            let Some(symbols) = session.symbols.as_mut() else {
                return;
            };
            symbols.stale = true;
            if session.open {
                self.shared.start_symbol_rebuild(session);
            }
        }
    }
}

/// One `FileSearch` per window: their query and search ids are counted by each page, so a
/// window must never cancel or refuse another window's search, and two windows on different
/// folders must not take turns rebuilding one index.
#[derive(Clone, Default)]
pub struct WindowSearches(Arc<Mutex<HashMap<String, FileSearch>>>);

impl WindowSearches {
    /// The window's search, made on first use.
    pub fn window(&self, window_label: &str) -> FileSearch {
        lock(&self.0).entry(window_label.to_string()).or_default().clone()
    }

    /// The window's search when it has one; the watcher only marks indexes that exist.
    pub fn existing(&self, window_label: &str) -> Option<FileSearch> {
        lock(&self.0).get(window_label).cloned()
    }

    /// The window closed: its indexes stop building and go.
    pub fn remove(&self, window_label: &str) {
        let removed = lock(&self.0).remove(window_label);
        if let Some(search) = removed {
            search.shutdown();
        }
    }

    #[cfg(test)]
    pub fn count(&self) -> usize {
        lock(&self.0).len()
    }
}

/// A file list for one search outside the popup (the MCP tools): walked now, on this
/// thread, and dropped with the last reference, so nothing stays in memory.
pub fn build_once(roots: &[String]) -> Arc<Index> {
    let index = Arc::new(Index::new(roots.to_vec(), MAX_FILES));
    build_index(&index, &|_| {});
    index
}

/// Go to File matching over a finished `build_once` list.
pub fn query_once(index: &Index, query: &str, limit: usize) -> FileSearchResults {
    search_index(index, query, limit, &|| false)
}

/// File lists for the tests of the index's consumers (symbols, text search).
#[cfg(test)]
impl Index {
    /// Walks `roots` on this thread.
    pub fn built_for_test(roots: &[String]) -> Arc<Index> {
        build_once(roots)
    }

    /// An index still building, fed by `add_paths_for_test`.
    pub fn building_for_test(roots: &[String]) -> Arc<Index> {
        Arc::new(Index::new(roots.to_vec(), MAX_FILES))
    }

    pub fn add_paths_for_test(&self, root: usize, paths: &[&str]) {
        let mut text = String::new();
        let mut ends = Vec::new();
        for path in paths {
            text.push_str(path);
            ends.push(text.len() as u32);
        }
        self.add_chunk(Chunk { root, text, ends });
    }

    pub fn finish_for_test(&self) {
        self.finish();
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;
    use crate::test_support::TestDir;

    fn built(roots: &[String], max_files: usize) -> Index {
        let index = Index::new(roots.to_vec(), max_files);
        build_index(&index, &|_| {});
        index
    }

    fn indexed_paths(index: &Index) -> Vec<String> {
        let (chunks, _, _) = index.snapshot();
        let mut paths: Vec<String> = chunks
            .iter()
            .flat_map(|chunk| (0..chunk.len()).map(|entry| chunk.path(entry).to_string()).collect::<Vec<_>>())
            .collect();
        paths.sort();
        paths
    }

    fn chunk_of(paths: &[&str]) -> Chunk {
        let mut text = String::new();
        let mut ends = Vec::new();
        for path in paths {
            text.push_str(path);
            ends.push(text.len() as u32);
        }
        Chunk { root: 0, text, ends }
    }

    fn index_of(paths: &[&str]) -> Index {
        let index = Index::new(vec!["/w".to_string()], MAX_FILES);
        index.add_chunk(chunk_of(paths));
        index.done.store(true, Ordering::Release);
        index
    }

    fn search(index: &Index, query: &str) -> FileSearchResults {
        search_index(index, query, DEFAULT_LIMIT, &|| false)
    }

    fn ranked(paths: &[&str], query: &str) -> Vec<String> {
        search(&index_of(paths), query)
            .items
            .into_iter()
            .map(|item| item.relative_path)
            .collect()
    }

    fn wait_until(mut condition: impl FnMut() -> bool) {
        let started = Instant::now();
        while !condition() {
            assert!(started.elapsed() < Duration::from_secs(10), "timed out");
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    #[test]
    fn walker_respects_gitignore_and_skips_tool_folders() {
        let dir = TestDir::new();
        dir.init_repo("app");
        dir.write("app/.gitignore", "*.log\nsecret/\n");
        dir.write("app/src/main.ts", "");
        dir.write("app/debug.log", "");
        dir.write("app/secret/key.txt", "");
        dir.write("app/node_modules/pkg/index.js", "");
        dir.write("app/target/debug/out.rs", "");
        dir.write("app/.github/workflows/ci.yml", "");
        dir.write("notes.txt", "");
        dir.write("plain/vendor/lib.php", "");
        let index = built(&[dir.path_string()], MAX_FILES);
        assert!(index.is_done());
        assert_eq!(
            indexed_paths(&index),
            ["app/.github/workflows/ci.yml", "app/.gitignore", "app/src/main.ts", "notes.txt"]
        );
        assert!(!index.progress().truncated);
    }

    #[test]
    fn nested_workspace_folders_list_their_files_once() {
        let dir = TestDir::new();
        dir.write("top.txt", "");
        dir.write("inner/file.txt", "");
        let roots = [dir.path_string(), dir.file_string("inner")];
        let index = built(&roots, MAX_FILES);
        let results = search(&index, "file");
        assert_eq!(results.items.len(), 1);
        assert_eq!(results.items[0].root, roots[1]);
        assert_eq!(results.items[0].relative_path, "file.txt");
        assert_eq!(results.items[0].path, dir.file_string("inner/file.txt"));
        assert_eq!(indexed_paths(&index), ["file.txt", "top.txt"]);
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_folders_are_not_followed() {
        let dir = TestDir::new();
        dir.write("real/a.txt", "");
        std::os::unix::fs::symlink(dir.file("real"), dir.file("link")).unwrap();
        std::os::unix::fs::symlink(dir.file("real/a.txt"), dir.file("alias.txt")).unwrap();
        let index = built(&[dir.path_string()], MAX_FILES);
        assert_eq!(indexed_paths(&index), ["alias.txt", "real/a.txt"]);
    }

    #[test]
    fn the_cap_stops_indexing_and_says_so() {
        let dir = TestDir::new();
        for number in 0..10 {
            dir.write(&format!("f{number}.txt"), "");
        }
        let index = built(&[dir.path_string()], 3);
        let progress = index.progress();
        assert_eq!(progress.indexed, 3);
        assert!(progress.truncated);
        assert!(progress.done);
        assert!(search(&index, "f").truncated);

        let exact = built(&[dir.path_string()], 10);
        assert!(!exact.progress().truncated);
        assert_eq!(exact.progress().indexed, 10);
    }

    #[test]
    fn an_exact_file_name_beats_a_deep_partial_match() {
        let paths = [
            "src/cartography/cartesian_artifact.ts",
            "docs/c-a-r-t.md",
            "src/components/deep/nested/folder/cart.ts",
            "src/carts.ts",
        ];
        assert_eq!(
            ranked(&paths, "cart"),
            [
                "src/components/deep/nested/folder/cart.ts",
                "src/carts.ts",
                "src/cartography/cartesian_artifact.ts",
                "docs/c-a-r-t.md",
            ]
        );
        // Ties go to the shorter path.
        assert_eq!(ranked(&["a/b/c/index.ts", "a/index.ts"], "index"), ["a/index.ts", "a/b/c/index.ts"]);
    }

    #[test]
    fn fuzzy_camel_snake_and_folder_matches() {
        assert_eq!(ranked(&["src/core/routing/table.ts", "src/cart.ts"], "crt")[0], "src/cart.ts");
        assert_eq!(ranked(&["lib/src/x.ts", "src/cart.ts"], "srccart"), ["src/cart.ts"]);
        assert_eq!(ranked(&["src/fooverlay.ts", "src/FileView.svelte"], "fv")[0], "src/FileView.svelte");
        assert_eq!(ranked(&["src/mischief.ts", "src/shopping_cart_helper.ts"], "sch")[0], "src/shopping_cart_helper.ts");
        // Short needles only match file names, not spread over folders.
        assert!(ranked(&["ab/c.ts"], "ac").is_empty());
    }

    #[test]
    fn folder_segments_and_a_leading_slash() {
        let paths = [
            "src/lib/views/LogView.svelte",
            "src/lib/log/LogTab.svelte",
            "views/Login.ts",
            "README.md",
            "docs/README.md",
        ];
        assert_eq!(ranked(&paths, "views/Log"), ["views/Login.ts", "src/lib/views/LogView.svelte"]);
        assert_eq!(ranked(&paths, "lib/log/"), ["src/lib/log/LogTab.svelte"]);
        assert_eq!(ranked(&paths, "/README"), ["README.md"]);
        assert_eq!(ranked(&paths, "/views/log"), ["views/Login.ts"]);
        assert_eq!(ranked(&paths, "/src/views/log"), ["src/lib/views/LogView.svelte"]);
        assert!(ranked(&paths, "/lib/log").is_empty());
    }

    #[test]
    fn match_indices_point_at_the_matched_characters() {
        let index = index_of(&["src/lib/views/LogView.svelte", "src/cart.ts", "dé/café.txt"]);
        let indices = |query: &str| search(&index, query).items[0].indices.clone();
        assert_eq!(indices("views/Log"), [8, 9, 10, 11, 12, 14, 15, 16]);
        assert_eq!(indices("srccart"), [0, 1, 2, 4, 5, 6, 7]);
        assert_eq!(indices("cart"), [4, 5, 6, 7]);
        // Code point indices, not bytes.
        assert_eq!(indices("café"), [3, 4, 5, 6]);
    }

    #[test]
    fn line_and_column_suffixes() {
        assert_eq!(split_location("cart.ts:42"), ("cart.ts", Some(42), None));
        assert_eq!(split_location("cart.ts:42:7"), ("cart.ts", Some(42), Some(7)));
        assert_eq!(split_location(" cart.ts:42: "), ("cart.ts", Some(42), None));
        assert_eq!(split_location("cart.ts:"), ("cart.ts", None, None));
        assert_eq!(split_location("cart.ts"), ("cart.ts", None, None));
        assert_eq!(split_location("a:b"), ("a:b", None, None));

        let index = index_of(&["src/cart.ts"]);
        let results = search(&index, "cart:12:3");
        assert_eq!(results.items.len(), 1);
        assert_eq!((results.line, results.column), (Some(12), Some(3)));
    }

    #[test]
    fn empty_queries_match_nothing() {
        let index = index_of(&["a.ts"]);
        assert!(search(&index, "").items.is_empty());
        assert!(search(&index, "   ").items.is_empty());
        assert!(parse_query(":12").is_none());
        assert_eq!(search(&index, "/").items.len(), 1);
    }

    #[test]
    fn a_partly_built_index_answers_queries() {
        let index = Index::new(vec!["/w".to_string()], MAX_FILES);
        index.add_chunk(chunk_of(&["src/cart.ts"]));
        let first = search(&index, "cart");
        assert!(!first.done);
        assert_eq!(first.indexed, 1);
        assert_eq!(first.items[0].path, "/w/src/cart.ts");

        index.add_chunk(chunk_of(&["cart.ts"]));
        let second = search(&index, "cart");
        assert_eq!(second.indexed, 2);
        assert_eq!(second.matched, 2);
        assert_eq!(second.items[0].relative_path, "cart.ts");
    }

    #[test]
    fn a_superseded_query_stops_early() {
        let index = index_of(&["a.ts", "b.ts"]);
        let results = search_index(&index, "ts", DEFAULT_LIMIT, &|| true);
        assert!(results.items.is_empty());
        assert_eq!(results.indexed, 2);
    }

    #[test]
    fn results_are_capped_at_the_limit_with_the_full_count() {
        let paths: Vec<String> = (0..300).map(|number| format!("dir/file{number}.ts")).collect();
        let refs: Vec<&str> = paths.iter().map(String::as_str).collect();
        let index = index_of(&refs);
        let results = search_index(&index, "file", 20, &|| false);
        assert_eq!(results.items.len(), 20);
        assert_eq!(results.matched, 300);
        assert_eq!(results.items[0].relative_path, "dir/file0.ts");
    }

    #[test]
    fn many_chunks_are_matched_in_parallel() {
        let index = Index::new(vec!["/w".to_string()], MAX_FILES);
        for chunk_number in 0..40 {
            let paths: Vec<String> = (0..1000).map(|number| format!("pkg{chunk_number}/mod{number}.rs")).collect();
            let refs: Vec<&str> = paths.iter().map(String::as_str).collect();
            index.add_chunk(chunk_of(&refs));
        }
        index.add_chunk(chunk_of(&["special/needle_file.rs"]));
        let results = search(&index, "needlefile");
        assert_eq!(results.items[0].relative_path, "special/needle_file.rs");
        assert_eq!(search(&index, "mod").matched, 40_000);
    }

    #[test]
    fn the_session_builds_reuses_refreshes_and_drops_the_index() {
        let dir = TestDir::new();
        dir.write("src/cart.ts", "");
        let roots = vec![dir.path_string()];
        let search = FileSearch::with_limits(MAX_FILES, Duration::ZERO);
        let reports = Arc::new(Mutex::new(Vec::new()));
        let sink_reports = reports.clone();
        search.open(&roots, Box::new(move |progress| lock(&sink_reports).push(progress)));
        wait_until(|| search.query(&roots, "cart", 10).done);
        wait_until(|| lock(&reports).last().is_some_and(|progress| progress.done));
        assert_eq!(search.query(&roots, "cart", 10).items[0].relative_path, "src/cart.ts");

        // A created file shows up after the rebuild, while the old index keeps answering.
        dir.write("src/checkout.ts", "");
        search.mark_stale();
        wait_until(|| !search.query(&roots, "checkout", 10).items.is_empty());

        // Reopening reuses the index.
        search.close();
        assert!(search.open(&roots, Box::new(|_| {})).done);

        // Once closed and idle, the reaper drops it.
        search.close();
        assert!(!search.shared.reap());
        assert!(lock(&search.shared.session).is_none());
    }

    #[test]
    fn other_folders_replace_the_session() {
        let first = TestDir::new();
        first.write("one.txt", "");
        let second = TestDir::new();
        second.write("two.txt", "");
        let search = FileSearch::with_limits(MAX_FILES, IDLE_DROP);
        let first_roots = vec![first.path_string()];
        let second_roots = vec![second.path_string()];
        wait_until(|| search.query(&first_roots, "one", 10).done);
        wait_until(|| search.query(&second_roots, "two", 10).done);
        assert_eq!(search.query(&second_roots, "two", 10).items.len(), 1);
        assert!(search.query(&second_roots, "one", 10).items.is_empty());
        // An open popup keeps the index past the idle time.
        search.open(&second_roots, Box::new(|_| {}));
        assert!(search.shared.reap());
    }
}
