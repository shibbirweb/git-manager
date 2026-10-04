//! Replace in Files (Shift+Cmd+R): the Text tab's matching (same
//! matcher, same lines, same options) with each match replaced, written back
//! to disk atomically (a temporary file renamed over the original).
//!
//! A preview run only counts, for the confirmation. Files the UI has open with
//! unsaved edits, symbolic links and read-only files are never written; they
//! are reported when they have matches. Binary and too big files are skipped
//! like the search skips them. A newer replace or a cancel stops between files,
//! so every file is either fully replaced or untouched.

use std::collections::HashSet;
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Mutex;

use grep_matcher::{Captures, Matcher};
use grep_regex::RegexMatcher;
use grep_searcher::{BinaryDetection, Searcher, SearcherBuilder, Sink, SinkMatch};
use serde::{Deserialize, Serialize};

use super::{build_matcher, TextSearchOptions, MAX_FILE_BYTES, MIN_QUERY_CHARS};
use crate::file_search::{join_root, lock, walker_threads, Index};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ReplaceRequest {
    pub query: String,
    pub options: TextSearchOptions,
    /// Literal text, or with Regex on: `$1` groups, `$&` the match, `$$` a dollar,
    /// and `\n`, `\t`, `\r`, `\\` escapes (the editor find bar's rules).
    pub replacement: String,
    /// Absolute paths to limit the replace to (one file's Replace); None replaces everywhere.
    pub file_paths: Option<Vec<String>>,
    /// Absolute paths never written: files open with unsaved edits.
    pub skip_paths: Vec<String>,
    /// Only count what would be replaced.
    pub preview: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplacedFile {
    /// Absolute path.
    pub path: String,
    pub root: String,
    pub relative_path: String,
    pub replacements: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SkipReason {
    /// Open in a tab with unsaved edits.
    Unsaved,
    /// A symbolic link: renaming over it would replace the link with a file.
    Link,
    ReadOnly,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedFile {
    pub path: String,
    pub relative_path: String,
    pub reason: SkipReason,
    pub matches: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FailedFile {
    pub path: String,
    pub relative_path: String,
    pub message: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceOutcome {
    /// Files replaced (or that would be, in a preview), sorted by path.
    pub files: Vec<ReplacedFile>,
    /// Matches replaced in `files`.
    pub replacements: usize,
    pub skipped: Vec<SkippedFile>,
    pub failed: Vec<FailedFile>,
    /// A newer replace or a cancel stopped it; `files` holds what was done.
    pub cancelled: bool,
    pub preview: bool,
    /// The query could not be used (an invalid regex).
    pub error: Option<String>,
}

/// One part of a compiled replacement.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Piece {
    Text(Vec<u8>),
    /// The whole match (`$&`).
    Whole,
    Group(usize),
}

/// A replacement compiled once for the matcher's capture groups.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Template {
    pieces: Vec<Piece>,
}

impl Template {
    /// `group_count` includes group 0, the whole match.
    fn compile(replacement: &str, regex: bool, group_count: usize) -> Template {
        if !regex {
            return Template {
                pieces: vec![Piece::Text(replacement.as_bytes().to_vec())],
            };
        }
        let text = unquote(replacement);
        let chars: Vec<char> = text.chars().collect();
        let mut pieces = Vec::new();
        let mut literal = String::new();
        let mut index = 0;
        while index < chars.len() {
            let character = chars[index];
            let next = chars.get(index + 1).copied();
            if character != '$' {
                literal.push(character);
                index += 1;
                continue;
            }
            match next {
                Some('$') => {
                    literal.push('$');
                    index += 2;
                }
                Some('&') => {
                    flush(&mut pieces, &mut literal);
                    pieces.push(Piece::Whole);
                    index += 2;
                }
                Some(digit) if digit.is_ascii_digit() => {
                    let digits: String = chars[index + 1..].iter().take_while(|c| c.is_ascii_digit()).collect();
                    index += 1 + digits.len();
                    // Like JavaScript: the longest leading number naming an existing group.
                    let group = (1..=digits.len()).rev().find_map(|length| {
                        let number = digits[..length].parse::<usize>().ok()?;
                        (number > 0 && number < group_count).then_some((number, length))
                    });
                    match group {
                        Some((number, length)) => {
                            flush(&mut pieces, &mut literal);
                            pieces.push(Piece::Group(number));
                            literal.push_str(&digits[length..]);
                        }
                        None => {
                            literal.push('$');
                            literal.push_str(&digits);
                        }
                    }
                }
                _ => {
                    literal.push('$');
                    index += 1;
                }
            }
        }
        flush(&mut pieces, &mut literal);
        Template { pieces }
    }

    fn uses_groups(&self) -> bool {
        self.pieces.iter().any(|piece| matches!(piece, Piece::Group(_)))
    }

    fn expand(&self, haystack: &[u8], whole: (usize, usize), group: &dyn Fn(usize) -> Option<(usize, usize)>, out: &mut Vec<u8>) {
        for piece in &self.pieces {
            match piece {
                Piece::Text(bytes) => out.extend_from_slice(bytes),
                Piece::Whole => out.extend_from_slice(&haystack[whole.0..whole.1]),
                Piece::Group(number) => {
                    if let Some((start, end)) = group(*number) {
                        out.extend_from_slice(&haystack[start..end]);
                    }
                }
            }
        }
    }
}

fn flush(pieces: &mut Vec<Piece>, literal: &mut String) {
    if !literal.is_empty() {
        pieces.push(Piece::Text(std::mem::take(literal).into_bytes()));
    }
}

/// `\n`, `\r`, `\t` and `\\` in a regex replacement, as CodeMirror reads them.
fn unquote(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(character) = chars.next() {
        if character != '\\' {
            out.push(character);
            continue;
        }
        let mapped = match chars.peek() {
            Some('n') => Some('\n'),
            Some('r') => Some('\r'),
            Some('t') => Some('\t'),
            Some('\\') => Some('\\'),
            _ => None,
        };
        match mapped {
            Some(mapped) => {
                out.push(mapped);
                chars.next();
            }
            None => out.push('\\'),
        }
    }
    out
}

/// Replaces the non-empty matches in one line (without its terminator),
/// appending the result to `out`; returns how many were replaced.
fn replace_line(
    matcher: &RegexMatcher,
    template: &Template,
    captures: &mut <RegexMatcher as Matcher>::Captures,
    line: &[u8],
    out: &mut Vec<u8>,
) -> usize {
    let mut last = 0;
    let mut count = 0;
    let mut take = |start: usize, end: usize, group: &dyn Fn(usize) -> Option<(usize, usize)>| {
        // Empty matches are not shown as results, so they are not replaced either.
        if start == end {
            return;
        }
        out.extend_from_slice(&line[last..start]);
        template.expand(line, (start, end), group, out);
        last = end;
        count += 1;
    };
    if template.uses_groups() {
        let _ = matcher.captures_iter(line, captures, |found| {
            if let Some(whole) = found.get(0) {
                take(whole.start(), whole.end(), &|number| found.get(number).map(|span| (span.start(), span.end())));
            }
            true
        });
    } else {
        let _ = matcher.find_iter(line, |found| {
            take(found.start(), found.end(), &|_| None);
            true
        });
    }
    out.extend_from_slice(&line[last..]);
    count
}

/// Byte ranges (with their terminators) of the lines the searcher matches.
struct LineSpans {
    spans: Vec<(usize, usize)>,
}

impl Sink for LineSpans {
    type Error = std::io::Error;

    fn matched(&mut self, _searcher: &Searcher, found: &SinkMatch<'_>) -> Result<bool, Self::Error> {
        let mut start = found.absolute_byte_offset() as usize;
        let bytes = found.bytes();
        let mut rest = bytes;
        while !rest.is_empty() {
            let length = memchr::memchr(b'\n', rest).map(|end| end + 1).unwrap_or(rest.len());
            self.spans.push((start, start + length));
            start += length;
            rest = &rest[length..];
        }
        Ok(true)
    }
}

/// The new content and the number of replacements, or None without a match.
fn rewrite(searcher: &mut Searcher, matcher: &RegexMatcher, template: &Template, buffer: &[u8]) -> Option<(Vec<u8>, usize)> {
    let mut sink = LineSpans { spans: Vec::new() };
    searcher.search_slice(matcher, buffer, &mut sink).ok()?;
    if sink.spans.is_empty() {
        return None;
    }
    let mut captures = matcher.new_captures().ok()?;
    let mut out = Vec::with_capacity(buffer.len());
    let mut position = 0;
    let mut total = 0;
    for (start, end) in sink.spans {
        if start < position || end > buffer.len() {
            continue;
        }
        // The search highlights matches in the line without its terminator; so does this.
        let mut content_end = end;
        while content_end > start && matches!(buffer[content_end - 1], b'\n' | b'\r') {
            content_end -= 1;
        }
        out.extend_from_slice(&buffer[position..start]);
        total += replace_line(matcher, template, &mut captures, &buffer[start..content_end], &mut out);
        position = content_end;
    }
    out.extend_from_slice(&buffer[position..]);
    (total > 0).then_some((out, total))
}

static TEMP_COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Writes `content` to a temporary file beside `path` with the original's
/// permissions, then renames it over `path`, so readers see the old file or
/// the new one, never half of it. Refuses when the file changed since it was read.
pub(crate) fn write_atomic(path: &Path, content: &[u8], original: &fs::Metadata) -> std::io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| std::io::Error::other("The file has no parent folder"))?;
    let name = path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
    let temp = parent.join(format!(
        ".{name}.{}-{}.replace~",
        std::process::id(),
        TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let result = (|| {
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temp)?;
        file.write_all(content)?;
        file.set_permissions(original.permissions())?;
        file.sync_all()?;
        drop(file);
        let current = fs::metadata(path)?;
        if current.len() != original.len() || current.modified().ok() != original.modified().ok() {
            return Err(std::io::Error::other("The file changed on disk while replacing"));
        }
        fs::rename(&temp, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

struct Run<'a> {
    files: &'a Index,
    matcher: RegexMatcher,
    template: Template,
    only: Option<HashSet<&'a str>>,
    skip: HashSet<&'a str>,
    preview: bool,
    stop: &'a (dyn Fn() -> bool + Sync),
    /// A worker saw `stop` before it ran out of files.
    interrupted: AtomicBool,
    outcome: Mutex<ReplaceOutcome>,
}

impl Run<'_> {
    fn stopped(&self) -> bool {
        let stopped = (self.stop)();
        if stopped {
            self.interrupted.store(true, Ordering::Relaxed);
        }
        stopped
    }

    fn worker(&self, next: &AtomicUsize) {
        let mut searcher = SearcherBuilder::new()
            .line_number(false)
            .binary_detection(BinaryDetection::none())
            .build();
        let mut buffer = Vec::new();
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
                let path = join_root(root, relative_path);
                if self.only.as_ref().is_some_and(|only| !only.contains(path.as_str())) {
                    continue;
                }
                self.file(&mut searcher, &mut buffer, root, relative_path, path);
            }
        }
    }

    fn file(&self, searcher: &mut Searcher, buffer: &mut Vec<u8>, root: &str, relative_path: &str, path: String) {
        let link = fs::symlink_metadata(&path)
            .map(|metadata| metadata.file_type().is_symlink())
            .unwrap_or(false);
        let Ok(mut file) = fs::File::open(&path) else {
            return;
        };
        let Ok(metadata) = file.metadata() else {
            return;
        };
        if !metadata.is_file() || metadata.len() > MAX_FILE_BYTES {
            return;
        }
        buffer.clear();
        if Read::by_ref(&mut file).take(MAX_FILE_BYTES).read_to_end(buffer).is_err() {
            return;
        }
        drop(file);
        // Like the search: a NUL byte means binary.
        if memchr::memchr(0, buffer).is_some() {
            return;
        }
        let Some((content, count)) = rewrite(searcher, &self.matcher, &self.template, buffer) else {
            return;
        };
        let reason = if self.skip.contains(path.as_str()) {
            Some(SkipReason::Unsaved)
        } else if link {
            Some(SkipReason::Link)
        } else if metadata.permissions().readonly() {
            Some(SkipReason::ReadOnly)
        } else {
            None
        };
        if let Some(reason) = reason {
            lock(&self.outcome).skipped.push(SkippedFile {
                path,
                relative_path: relative_path.to_string(),
                reason,
                matches: count,
            });
            return;
        }
        if !self.preview {
            if let Err(err) = write_atomic(Path::new(&path), &content, &metadata) {
                lock(&self.outcome).failed.push(FailedFile {
                    path,
                    relative_path: relative_path.to_string(),
                    message: err.to_string(),
                });
                return;
            }
        }
        let mut outcome = lock(&self.outcome);
        outcome.replacements += count;
        outcome.files.push(ReplacedFile {
            path,
            root: root.to_string(),
            relative_path: relative_path.to_string(),
            replacements: count,
        });
    }
}

/// Replaces `request.query` in `files` (or counts, for a preview).
pub fn replace(files: &Index, request: &ReplaceRequest, stop: &(dyn Fn() -> bool + Sync)) -> ReplaceOutcome {
    let mut outcome = ReplaceOutcome {
        preview: request.preview,
        ..ReplaceOutcome::default()
    };
    if request.query.chars().count() < MIN_QUERY_CHARS {
        return outcome;
    }
    let matcher = match build_matcher(&request.query, &request.options) {
        Ok(matcher) => matcher,
        Err(message) => {
            outcome.error = Some(message);
            return outcome;
        }
    };
    let template = Template::compile(&request.replacement, request.options.regex, matcher.capture_count());
    let run = Run {
        files,
        matcher,
        template,
        only: request
            .file_paths
            .as_ref()
            .map(|paths| paths.iter().map(String::as_str).collect()),
        skip: request.skip_paths.iter().map(String::as_str).collect(),
        preview: request.preview,
        stop,
        interrupted: AtomicBool::new(false),
        outcome: Mutex::new(outcome),
    };
    let next = AtomicUsize::new(0);
    std::thread::scope(|scope| {
        for _ in 1..walker_threads() {
            scope.spawn(|| run.worker(&next));
        }
        run.worker(&next);
    });
    let interrupted = run.interrupted.load(Ordering::Relaxed);
    let mut outcome = run.outcome.into_inner().unwrap_or_else(|poisoned| poisoned.into_inner());
    outcome.cancelled = interrupted;
    outcome.files.sort_by(|a, b| a.path.cmp(&b.path));
    outcome.skipped.sort_by(|a, b| a.path.cmp(&b.path));
    outcome.failed.sort_by(|a, b| a.path.cmp(&b.path));
    outcome
}

#[cfg(test)]
mod tests;
