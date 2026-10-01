use std::path::Path;

use super::{blocking, run_op, OpOutcome};
use crate::error::{AppError, AppResult};
use crate::git::blame::{self, BlameInfo};
use crate::git::cli;
use crate::git::diff::{self, FileDiff};
use crate::git::log::{self, CommitDetails, CommitSummary};
use crate::git::repo as git_repo;

const MAX_PAGE: usize = 1000;

#[tauri::command]
pub async fn get_log(repo_path: String, offset: usize, limit: usize, all_refs: bool) -> AppResult<Vec<CommitSummary>> {
    blocking(move || log::page(&git_repo::open(&repo_path)?, offset, limit.min(MAX_PAGE), all_refs)).await
}

#[tauri::command]
pub async fn get_commit_details(repo_path: String, commit_id: String) -> AppResult<CommitDetails> {
    blocking(move || log::details(&git_repo::open(&repo_path)?, &commit_id)).await
}

#[tauri::command]
pub async fn get_commit_file_diff(
    repo_path: String,
    commit_id: String,
    file_path: String,
    orig_path: Option<String>,
) -> AppResult<FileDiff> {
    blocking(move || {
        let repo = git_repo::open(&repo_path)?;
        diff::commit_file(&repo, &commit_id, &file_path, orig_path.as_deref())
    })
    .await
}

/// Blames a file at `revision`, or the work tree when None; `contents`
/// (editor text or the index version) is blamed instead of the file on disk.
#[tauri::command]
pub async fn blame_file(
    repo_path: String,
    file_path: String,
    revision: Option<String>,
    contents: Option<String>,
) -> AppResult<BlameInfo> {
    blocking(move || blame::blame(Path::new(&repo_path), &file_path, revision.as_deref(), contents.as_deref())).await
}

#[tauri::command]
pub async fn cherry_pick(repo_path: String, commit_id: String) -> AppResult<OpOutcome> {
    blocking(move || run_op(&repo_path, &["cherry-pick", &commit_id])).await
}

#[tauri::command]
pub async fn revert_commit(repo_path: String, commit_id: String) -> AppResult<OpOutcome> {
    blocking(move || run_op(&repo_path, &["revert", "--no-edit", &commit_id])).await
}

#[tauri::command]
pub async fn reset_to(repo_path: String, commit_id: String, mode: String) -> AppResult<()> {
    blocking(move || {
        let flag = match mode.as_str() {
            "soft" => "--soft",
            "mixed" => "--mixed",
            "hard" => "--hard",
            _ => return Err(AppError::invalid(format!("Unknown reset mode: {mode}"))),
        };
        cli::run(Path::new(&repo_path), &["reset", flag, &commit_id])?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn checkout_commit(repo_path: String, commit_id: String) -> AppResult<()> {
    blocking(move || {
        cli::run(Path::new(&repo_path), &["switch", "--detach", &commit_id])?;
        Ok(())
    })
    .await
}
