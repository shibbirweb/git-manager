//! The Log's reads, shaped like the Tauri commands in src-tauri/src/commands/history.rs: a page of history with
//! the tips it was read at, a commit's details and one changed file's diff against the commit's first parent. They
//! run the shared `git::log` and `git::diff` code, so both apps show the same history.

use serde::{Deserialize, Serialize};

use crate::error::AppResult;
use crate::git::diff::{self, FileDiff};
use crate::git::log::{self, CommitDetails, CommitSummary};
use crate::git::repo as git_repo;

/// A reload asks for everything it shows in one call, as in history.rs.
const MAX_PAGE: usize = 5000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct GetLogArgs {
    repo_path: String,
    offset: usize,
    limit: usize,
    all_refs: bool,
    known_tips: Option<String>,
}

/// Same as history.rs's LogPage: `commits` is None when `known_tips` still matched, so nothing was walked.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct LogPage {
    tips: String,
    commits: Option<Vec<CommitSummary>>,
}

pub(super) fn get_log(args: GetLogArgs) -> AppResult<LogPage> {
    let repo = git_repo::open(&args.repo_path)?;
    // Taken before the walk: a ref moving meanwhile only costs one more reload.
    let tips = log::tips(&repo, args.all_refs);
    if args.known_tips.as_deref() == Some(tips.as_str()) {
        return Ok(LogPage { tips, commits: None });
    }
    let commits = log::page(&repo, args.offset, args.limit.min(MAX_PAGE), args.all_refs)?;
    Ok(LogPage { tips, commits: Some(commits) })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CommitArgs {
    repo_path: String,
    commit_id: String,
}

pub(super) fn get_commit_details(args: CommitArgs) -> AppResult<CommitDetails> {
    log::details(&git_repo::open(&args.repo_path)?, &args.commit_id)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CommitFileArgs {
    repo_path: String,
    commit_id: String,
    file_path: String,
    orig_path: Option<String>,
}

pub(super) fn get_commit_file_diff(args: CommitFileArgs) -> AppResult<FileDiff> {
    let repo = git_repo::open(&args.repo_path)?;
    diff::commit_file(&repo, &args.commit_id, &args.file_path, args.orig_path.as_deref())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RevisionArgs {
    repo_path: String,
    revision: String,
}

/// Same as history.rs's resolve_revision: a hash, branch, tag or expression such as HEAD~5 to the full commit id.
pub(super) fn resolve_revision(args: RevisionArgs) -> AppResult<String> {
    let repo = git_repo::open(&args.repo_path)?;
    let commit_id = git_repo::resolve_commit(&repo, &args.revision)?.id().to_string();
    Ok(commit_id)
}
