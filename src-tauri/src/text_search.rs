//! Find in Files (the Text tab): ripgrep's searcher and regex matcher
//! over the Go to File index's files, on a few threads, streaming results in
//! small batches as they are found.
//!
//! Results stop at `MAX_MATCHES` lines or `MAX_FILES` files (the last batch
//! says there were more), so nothing beyond the cap is ever held. A newer
//! search makes `stop` true, which is checked between files and inside the
//! sink, so typing never waits for an old search.

use std::borrow::Cow;
use std::io::Read;
use std::ops::Range;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use grep_matcher::Matcher;
use grep_regex::{RegexMatcher, RegexMatcherBuilder};
use grep_searcher::{BinaryDetection, Searcher, SearcherBuilder, Sink, SinkMatch};
use serde::{Deserialize, Serialize};

use crate::file_search::{join_root, lock, walker_threads, Index};

pub mod replace;

pub const MAX_MATCHES: usize = 2_000;
pub const MAX_FILES: usize = 300;
/// Bigger files are skipped: logs, dumps and data, rarely what is looked for.
pub const MAX_FILE_BYTES: u64 = 5 * 1024 * 1024;
/// Shorter queries match nearly every line.
pub const MIN_QUERY_CHARS: usize = 2;
/// Characters of a line shown, around its first match.
const MAX_TEXT: usize = 240;
/// Characters kept before the first match when a long line is cut.
const LEAD: usize = 48;
/// Highlighted matches per line.
const MAX_RANGES: usize = 32;
/// A batch goes out after this many lines or this long after the last one.
const BATCH_LINES: usize = 64;
const BATCH_INTERVAL: Duration = Duration::from_millis(40);

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TextSearchOptions {
    pub match_case: bool,
    pub whole_words: bool,
    pub regex: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextLineMatch {
    /// 1-based.
    pub line: u32,
    /// 1-based column of the first match, in UTF-16 code units.
    pub column: u32,
    /// The line, trimmed around the first match.
    pub text: String,
    /// Matches in `text` as UTF-16 `[start, end)` offsets.
    pub ranges: Vec<[u32; 2]>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextFileMatches {
    /// Absolute path.
    pub path: String,
    pub root: String,
    pub relative_path: String,
    pub lines: Vec<TextLineMatch>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextSearchBatch {
    /// Files found since the previous batch, each with all its lines.
    pub files: Vec<TextFileMatches>,
    /// The last batch of this search.
    pub done: bool,
    /// Matching lines so far.
    pub matches: usize,
    pub files_matched: usize,
    pub files_searched: usize,
    /// The caps were hit: there are more results than sent.
    pub more: bool,
    pub error: Option<String>,
}

fn build_matcher(query: &str, options: &TextSearchOptions) -> Result<RegexMatcher, String> {
    let mut builder = RegexMatcherBuilder::new();
    builder
        .case_insensitive(!options.match_case)
        .word(options.whole_words)
        .fixed_strings(!options.regex)
        .line_terminator(Some(b'\n'));
    builder.build(query).map_err(|err| {
        // Regex errors span several lines; the last one says what is wrong.
        let message = err.to_string();
        let reason = message
            .lines()
            .rev()
            .find(|line| !line.trim().is_empty())
            .unwrap_or("invalid pattern")
            .trim()
            .trim_start_matches("error: ")
            .to_string();
        format!("Invalid regular expression: {reason}")
    })
}

struct Outbox {
    files: Vec<TextFileMatches>,
    lines: usize,
    last_flush: Instant,
    sent: bool,
    /// Reserved results, so the caps hold across threads.
    matches: usize,
    files_matched: usize,
}

struct Run<'a> {
    files: &'a Index,
    matcher: RegexMatcher,
    stop: &'a (dyn Fn() -> bool + Sync),
    sink: &'a (dyn Fn(TextSearchBatch) + Sync),
    outbox: Mutex<Outbox>,
    pending: AtomicBool,
    searched: AtomicUsize,
    more: AtomicBool,
}

impl Run<'_> {
    fn stopped(&self) -> bool {
        self.more.load(Ordering::Relaxed) || (self.stop)()
    }

    fn batch(&self, outbox: &mut Outbox, done: bool) -> TextSearchBatch {
        let mut files = std::mem::take(&mut outbox.files);
        files.sort_by(|a, b| a.path.cmp(&b.path));
        outbox.lines = 0;
        outbox.last_flush = Instant::now();
        outbox.sent = true;
        self.pending.store(false, Ordering::Relaxed);
        TextSearchBatch {
            files,
            done,
            matches: outbox.matches,
            files_matched: outbox.files_matched,
            files_searched: self.searched.load(Ordering::Relaxed),
            more: self.more.load(Ordering::Relaxed),
            error: None,
        }
    }

    /// Takes a file's results within the caps; the first ones go out at once.
    fn add(&self, mut found: TextFileMatches, hit_line_cap: bool) {
        let mut outbox = lock(&self.outbox);
        if outbox.files_matched >= MAX_FILES || outbox.matches >= MAX_MATCHES {
            self.more.store(true, Ordering::Relaxed);
            return;
        }
        let room = MAX_MATCHES - outbox.matches;
        if found.lines.len() > room {
            found.lines.truncate(room);
            self.more.store(true, Ordering::Relaxed);
        }
        if hit_line_cap {
            self.more.store(true, Ordering::Relaxed);
        }
        outbox.matches += found.lines.len();
        outbox.files_matched += 1;
        outbox.lines += found.lines.len();
        outbox.files.push(found);
        self.pending.store(true, Ordering::Relaxed);
        if !outbox.sent || outbox.lines >= BATCH_LINES || outbox.last_flush.elapsed() >= BATCH_INTERVAL {
            let batch = self.batch(&mut outbox, false);
            (self.sink)(batch);
        }
    }

    /// Sends waiting results that have waited long enough.
    fn flush_if_due(&self) {
        if !self.pending.load(Ordering::Relaxed) {
            return;
        }
        let mut outbox = lock(&self.outbox);
        if !outbox.files.is_empty() && outbox.last_flush.elapsed() >= BATCH_INTERVAL {
            let batch = self.batch(&mut outbox, false);
            (self.sink)(batch);
        }
    }

    fn worker(&self, next: &AtomicUsize) {
        let mut searcher = SearcherBuilder::new()
            .line_number(true)
            .binary_detection(BinaryDetection::none())
            .build();
        let mut buffer = Vec::new();
        let mut path = String::new();
        let roots = self.files.roots();
        loop {
            let number = next.fetch_add(1, Ordering::Relaxed);
            let Some(chunk) = self.files.wait_chunk(number, &|| self.stopped()) else {
                return;
            };
            let root = roots.get(chunk.root()).map(String::as_str).unwrap_or_default();
            for entry in 0..chunk.len() {
                if self.stopped() {
                    return;
                }
                let relative_path = chunk.path(entry);
                path.clear();
                path.push_str(root);
                if !root.ends_with('/') {
                    path.push('/');
                }
                path.push_str(relative_path);
                let found = search_file(&mut searcher, &self.matcher, &path, &mut buffer, &|| self.stopped());
                self.searched.fetch_add(1, Ordering::Relaxed);
                if let Some((lines, hit_line_cap)) = found.filter(|(lines, _)| !lines.is_empty()) {
                    self.add(
                        TextFileMatches {
                            path: join_root(root, relative_path),
                            root: root.to_string(),
                            relative_path: relative_path.to_string(),
                            lines,
                        },
                        hit_line_cap,
                    );
                } else {
                    self.flush_if_due();
                }
            }
        }
    }
}

/// Searches `files` for `query`, sending batches to `sink`; the last one has `done`.
pub fn search(
    files: &Index,
    query: &str,
    options: &TextSearchOptions,
    stop: &(dyn Fn() -> bool + Sync),
    sink: &(dyn Fn(TextSearchBatch) + Sync),
) {
    if query.chars().count() < MIN_QUERY_CHARS {
        sink(TextSearchBatch {
            done: true,
            ..TextSearchBatch::default()
        });
        return;
    }
    let matcher = match build_matcher(query, options) {
        Ok(matcher) => matcher,
        Err(message) => {
            sink(TextSearchBatch {
                done: true,
                error: Some(message),
                ..TextSearchBatch::default()
            });
            return;
        }
    };
    let run = Run {
        files,
        matcher,
        stop,
        sink,
        outbox: Mutex::new(Outbox {
            files: Vec::new(),
            lines: 0,
            last_flush: Instant::now(),
            sent: false,
            matches: 0,
            files_matched: 0,
        }),
        pending: AtomicBool::new(false),
        searched: AtomicUsize::new(0),
        more: AtomicBool::new(false),
    };
    let next = AtomicUsize::new(0);
    std::thread::scope(|scope| {
        for _ in 1..walker_threads() {
            scope.spawn(|| run.worker(&next));
        }
        run.worker(&next);
    });
    let mut outbox = lock(&run.outbox);
    let batch = run.batch(&mut outbox, true);
    sink(batch);
}

/// The matching lines of one file, and whether it had more than the cap;
/// None for binary, unreadable and too big files.
fn search_file(
    searcher: &mut Searcher,
    matcher: &RegexMatcher,
    file_path: &str,
    buffer: &mut Vec<u8>,
    stop: &dyn Fn() -> bool,
) -> Option<(Vec<TextLineMatch>, bool)> {
    let mut file = std::fs::File::open(file_path).ok()?;
    let metadata = file.metadata().ok()?;
    if !metadata.is_file() || metadata.len() > MAX_FILE_BYTES {
        return None;
    }
    buffer.clear();
    file.by_ref().take(MAX_FILE_BYTES).read_to_end(buffer).ok()?;
    // Like ripgrep: a NUL byte means binary.
    if memchr::memchr(0, buffer).is_some() {
        return None;
    }
    let mut sink = LineSink {
        matcher,
        stop,
        lines: Vec::new(),
        capped: false,
    };
    searcher.search_slice(matcher, buffer, &mut sink).ok()?;
    Some((sink.lines, sink.capped))
}

struct LineSink<'a> {
    matcher: &'a RegexMatcher,
    stop: &'a dyn Fn() -> bool,
    lines: Vec<TextLineMatch>,
    capped: bool,
}

impl Sink for LineSink<'_> {
    type Error = std::io::Error;

    fn matched(&mut self, _searcher: &Searcher, found: &SinkMatch<'_>) -> Result<bool, Self::Error> {
        if (self.stop)() {
            return Ok(false);
        }
        if self.lines.len() >= MAX_MATCHES {
            self.capped = true;
            return Ok(false);
        }
        let mut bytes = found.bytes();
        while let Some((last, rest)) = bytes.split_last() {
            if *last != b'\n' && *last != b'\r' {
                break;
            }
            bytes = rest;
        }
        let mut ranges: Vec<Range<usize>> = Vec::new();
        self.matcher
            .find_iter(bytes, |found| {
                if found.start() < found.end() {
                    ranges.push(found.start()..found.end());
                }
                ranges.len() < MAX_RANGES
            })
            .map_err(|err| std::io::Error::other(err.to_string()))?;
        if ranges.is_empty() {
            return Ok(true);
        }
        let line = found.line_number().unwrap_or(0) as u32;
        self.lines.push(line_match(line, bytes, &ranges));
        Ok(true)
    }
}

/// UTF-16 length of `text[..byte]`, or of its lossy decoding for invalid UTF-8.
fn utf16_at(text: &str, ascii: bool, bytes: &[u8], byte: usize) -> usize {
    if ascii {
        byte
    } else if text.len() == bytes.len() && text.is_char_boundary(byte) {
        text[..byte].encode_utf16().count()
    } else {
        String::from_utf8_lossy(&bytes[..byte.min(bytes.len())]).encode_utf16().count()
    }
}

/// The shown part of a matching line and its match ranges.
fn line_match(line: u32, bytes: &[u8], ranges: &[Range<usize>]) -> TextLineMatch {
    let text: Cow<'_, str> = String::from_utf8_lossy(bytes);
    let ascii = bytes.is_ascii();
    let units: Vec<[usize; 2]> = ranges
        .iter()
        .map(|range| [utf16_at(&text, ascii, bytes, range.start), utf16_at(&text, ascii, bytes, range.end)])
        .collect();
    let first = units[0][0];
    let full: Vec<u16> = text.encode_utf16().collect();
    // Drop the indentation, unless the match is in it.
    let indent = text.chars().take_while(|character| *character == ' ' || *character == '\t').count();
    let mut start = indent.min(first);
    let mut prefix = "";
    if full.len() - start > MAX_TEXT && first > start + LEAD {
        start = first - LEAD;
        prefix = "\u{2026}";
    }
    // Never cut a surrogate pair in half.
    if start > 0 && start < full.len() && (0xDC00..0xE000).contains(&full[start]) {
        start += 1;
    }
    let mut end = (start + MAX_TEXT).min(full.len());
    if end < full.len() && end > start && (0xD800..0xDC00).contains(&full[end - 1]) {
        end -= 1;
    }
    let mut shown = String::from(prefix);
    shown.push_str(&String::from_utf16_lossy(&full[start..end]));
    if end < full.len() {
        shown.push('\u{2026}');
    }
    let offset = prefix.encode_utf16().count();
    let ranges = units
        .iter()
        .filter(|[range_start, range_end]| *range_end > start && *range_start < end)
        .map(|[range_start, range_end]| {
            [
                ((*range_start).max(start) - start + offset) as u32,
                ((*range_end).min(end) - start + offset) as u32,
            ]
        })
        .collect();
    TextLineMatch {
        line,
        column: first as u32 + 1,
        text: shown,
        ranges,
    }
}

#[cfg(test)]
mod tests;
