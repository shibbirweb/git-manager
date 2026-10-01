use std::path::Path;

use super::{blocking, safe_join, with_paths};
use crate::error::AppResult;
use crate::git::cli::{self, GitOutput};
use crate::git::diff::{self, DiffArea, FileDiff};
use crate::git::repo as git_repo;
use crate::git::status::{self, RepoStatus};
use crate::merge::model::Eol;

#[tauri::command]
pub async fn get_status(repo_path: String) -> AppResult<RepoStatus> {
    blocking(move || status::read(&git_repo::open(&repo_path)?)).await
}

#[tauri::command]
pub async fn get_file_diff(
    repo_path: String,
    file_path: String,
    orig_path: Option<String>,
    area: DiffArea,
) -> AppResult<FileDiff> {
    blocking(move || {
        let repo = git_repo::open(&repo_path)?;
        diff::working_file(&repo, &file_path, orig_path.as_deref(), area)
    })
    .await
}

#[tauri::command]
pub async fn stage_files(repo_path: String, file_paths: Vec<String>) -> AppResult<()> {
    blocking(move || {
        cli::run(Path::new(&repo_path), &with_paths(&["add", "-A"], &file_paths))?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn unstage_files(repo_path: String, file_paths: Vec<String>) -> AppResult<()> {
    blocking(move || {
        let repo = git_repo::open(&repo_path)?;
        let root = Path::new(&repo_path);
        if repo.head().is_ok() {
            cli::run(root, &with_paths(&["restore", "--staged"], &file_paths))?;
        } else {
            // No HEAD to restore from in a fresh repository.
            cli::run(root, &with_paths(&["rm", "--cached", "-r", "-q"], &file_paths))?;
        }
        Ok(())
    })
    .await
}

/// Discards unstaged changes: tracked files are restored from the index,
/// untracked files are deleted.
#[tauri::command]
pub async fn discard_files(repo_path: String, tracked_paths: Vec<String>, untracked_paths: Vec<String>) -> AppResult<()> {
    blocking(move || {
        if !tracked_paths.is_empty() {
            cli::run(Path::new(&repo_path), &with_paths(&["restore", "--worktree"], &tracked_paths))?;
        }
        for untracked_path in &untracked_paths {
            let full = safe_join(&repo_path, untracked_path)?;
            if full.is_dir() {
                std::fs::remove_dir_all(&full)?;
            } else if full.exists() {
                std::fs::remove_file(&full)?;
            }
        }
        Ok(())
    })
    .await
}

/// Writes `content` straight into the index for `file_path` (hunk staging).
#[tauri::command]
pub async fn stage_content(repo_path: String, file_path: String, content: String, eol: Eol) -> AppResult<()> {
    blocking(move || {
        safe_join(&repo_path, &file_path)?;
        let root = Path::new(&repo_path);
        let repo = git_repo::open(&repo_path)?;
        let mode = repo
            .index()?
            .get_path(Path::new(&file_path), 0)
            .map(|entry| entry.mode)
            .unwrap_or(0o100644);
        let body = eol.apply(&content);
        // stdin without --path hashes the bytes as-is (no filters), matching index content.
        let hashed = cli::run_with_stdin(root, &["hash-object", "-w", "--stdin"], body.as_bytes())?;
        let object_id = hashed.stdout.trim().to_string();
        let cache_info = format!("{mode:o},{object_id},{file_path}");
        cli::run(root, &["update-index", "--add", "--cacheinfo", &cache_info])?;
        Ok(())
    })
    .await
}

/// Overwrites a work tree file (used to discard a single hunk).
#[tauri::command]
pub async fn write_worktree_file(repo_path: String, file_path: String, content: String, eol: Eol) -> AppResult<()> {
    blocking(move || {
        let full = safe_join(&repo_path, &file_path)?;
        std::fs::write(full, eol.apply(&content))?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn commit(repo_path: String, message: String, amend: bool) -> AppResult<GitOutput> {
    blocking(move || {
        let root = Path::new(&repo_path);
        let mut args = vec!["commit"];
        if amend {
            args.push("--amend");
        }
        if message.trim().is_empty() && amend {
            args.push("--no-edit");
            cli::run(root, &args)
        } else {
            args.extend(["-F", "-"]);
            cli::run_with_stdin(root, &args, message.as_bytes())
        }
    })
    .await
}

#[tauri::command]
pub async fn get_head_message(repo_path: String) -> AppResult<String> {
    blocking(move || {
        let repo = git_repo::open(&repo_path)?;
        let message = repo
            .head()
            .ok()
            .and_then(|head| head.peel_to_commit().ok())
            .and_then(|commit| commit.message().ok().map(str::to_string))
            .unwrap_or_default();
        Ok(message)
    })
    .await
}
