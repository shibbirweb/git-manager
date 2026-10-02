use super::blocking;
use crate::error::AppResult;
use crate::git::worktree::{self, WorktreeBranch, WorktreeInfo};

#[tauri::command]
pub async fn list_worktrees(repo_path: String) -> AppResult<Vec<WorktreeInfo>> {
    blocking(move || worktree::list(&repo_path)).await
}

/// `git worktree add`; resolves with the new work tree's path.
#[tauri::command]
pub async fn add_worktree(repo_path: String, worktree_path: String, branch: WorktreeBranch) -> AppResult<String> {
    blocking(move || worktree::add(&repo_path, &worktree_path, &branch)).await
}

#[tauri::command]
pub async fn remove_worktree(repo_path: String, worktree_path: String, force: bool) -> AppResult<()> {
    blocking(move || worktree::remove(&repo_path, &worktree_path, force)).await
}

#[tauri::command]
pub async fn lock_worktree(repo_path: String, worktree_path: String, reason: Option<String>) -> AppResult<()> {
    blocking(move || worktree::lock(&repo_path, &worktree_path, reason.as_deref())).await
}

#[tauri::command]
pub async fn unlock_worktree(repo_path: String, worktree_path: String) -> AppResult<()> {
    blocking(move || worktree::unlock(&repo_path, &worktree_path)).await
}

#[tauri::command]
pub async fn prune_worktrees(repo_path: String) -> AppResult<String> {
    blocking(move || worktree::prune(&repo_path)).await
}

/// Whether removing the work tree would throw away changes (it then needs force).
#[tauri::command]
pub async fn worktree_has_changes(worktree_path: String) -> AppResult<bool> {
    blocking(move || worktree::has_changes(&worktree_path)).await
}
