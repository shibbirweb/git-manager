//! File and line history through `git log`: libgit2 can neither follow a file
//! across renames (`--follow`) nor trace a range of lines (`-L`).

use std::path::Path;

use serde::Serialize;

use super::cli;
use super::log::{parse_cli_commit, CommitSummary, CLI_COMMIT_FORMAT};
use crate::error::{AppError, AppResult};

pub const MAX_FILE_HISTORY: usize = 500;
pub const MAX_LINE_HISTORY: usize = 200;
/// Longer line-history diffs are cut here, so one huge commit cannot flood the UI.
const MAX_PATCH_BYTES: usize = 200 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHistoryEntry {
    pub commit: CommitSummary,
    /// The file's path in this commit.
    pub path: String,
    pub orig_path: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LineHistoryEntry {
    pub commit: CommitSummary,
    pub patch: String,
    pub truncated: bool,
}

fn status_word(code: &str) -> &'static str {
    match code.chars().next() {
        Some('A') => "added",
        Some('D') => "deleted",
        Some('R') => "renamed",
        Some('C') => "copied",
        Some('T') => "typechange",
        _ => "modified",
    }
}

/// `git log --follow` of one file, newest first, `limit` commits after skipping `offset`.
pub fn file_history(root: &Path, file_path: &str, offset: usize, limit: usize) -> AppResult<Vec<FileHistoryEntry>> {
    if file_path.trim().is_empty() {
        return Err(AppError::invalid("Choose a file to show its history"));
    }
    let limit = limit.min(MAX_FILE_HISTORY);
    if limit == 0 {
        return Ok(Vec::new());
    }
    let format = format!("--format=%x1e{CLI_COMMIT_FORMAT}");
    let skip = format!("--skip={offset}");
    let count = format!("-n{limit}");
    let args = [
        "-c",
        "core.quotePath=false",
        "log",
        "--no-color",
        "--follow",
        "-M",
        &format,
        "--name-status",
        "-z",
        &skip,
        &count,
        "--",
        file_path,
    ];
    let output = cli::run(root, &args)?;
    Ok(parse_file_history(&output.stdout, file_path))
}

/// Parses `--format=%x1e... --name-status -z`: each record is the header, NUL,
/// then NUL-separated tokens (a status, one path, or two for a rename or copy).
pub fn parse_file_history(stdout: &str, file_path: &str) -> Vec<FileHistoryEntry> {
    let mut entries = Vec::new();
    // A commit without a listed change (a merge) keeps the newer entry's path.
    let mut known_path = file_path.to_string();
    for record in stdout.split('\u{1e}') {
        let (header, rest) = record.split_once('\0').unwrap_or((record, ""));
        let Some(commit) = parse_cli_commit(header) else {
            continue;
        };
        let mut tokens = rest
            .split('\0')
            .map(|token| token.trim_start_matches('\n'))
            .filter(|token| !token.is_empty());
        let code = tokens.next().unwrap_or("M");
        let status = status_word(code);
        let (path, orig_path) = if status == "renamed" || status == "copied" {
            let old = tokens.next().map(str::to_string);
            let new = tokens.next().map(str::to_string);
            match (old, new) {
                (Some(old), Some(new)) => (new, Some(old)),
                (Some(only), None) => (only, None),
                _ => (known_path.clone(), None),
            }
        } else {
            (tokens.next().map(str::to_string).unwrap_or_else(|| known_path.clone()), None)
        };
        known_path = orig_path.clone().unwrap_or_else(|| path.clone());
        entries.push(FileHistoryEntry {
            commit,
            path,
            orig_path,
            status: status.to_string(),
        });
    }
    entries
}

/// `git log -L START,END:PATH` (1-based, inclusive): the commits that changed those lines, with their diffs.
pub fn line_history(
    root: &Path,
    file_path: &str,
    start_line: usize,
    end_line: usize,
    limit: usize,
) -> AppResult<Vec<LineHistoryEntry>> {
    if file_path.trim().is_empty() {
        return Err(AppError::invalid("Choose a file to show its history"));
    }
    if start_line == 0 || end_line < start_line {
        return Err(AppError::invalid(format!("Invalid line range: {start_line} to {end_line}")));
    }
    let limit = limit.min(MAX_LINE_HISTORY);
    if limit == 0 {
        return Ok(Vec::new());
    }
    let range = format!("-L{start_line},{end_line}:{file_path}");
    let format = format!("--format=%x1e{CLI_COMMIT_FORMAT}");
    let count = format!("-n{limit}");
    let output = cli::run(root, &["log", "--no-color", &range, &format, &count])?;
    Ok(parse_line_history(&output.stdout))
}

/// Each record is the header line followed by the commit's diff of the traced lines.
pub fn parse_line_history(stdout: &str) -> Vec<LineHistoryEntry> {
    let mut entries = Vec::new();
    for record in stdout.split('\u{1e}') {
        let (header, rest) = record.split_once('\n').unwrap_or((record, ""));
        let Some(commit) = parse_cli_commit(header) else {
            continue;
        };
        let patch = rest.trim_start_matches('\n').trim_end();
        let truncated = patch.len() > MAX_PATCH_BYTES;
        let patch = if truncated {
            let mut end = MAX_PATCH_BYTES;
            while !patch.is_char_boundary(end) {
                end -= 1;
            }
            &patch[..end]
        } else {
            patch
        };
        entries.push(LineHistoryEntry {
            commit,
            patch: patch.to_string(),
            truncated,
        });
    }
    entries
}
