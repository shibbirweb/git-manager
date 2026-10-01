use tauri::{AppHandle, State};

use super::blocking;
use crate::error::AppResult;
use crate::git::repo::RepoInfo;
use crate::git::workspace::{self, WorkspaceInfo};
use crate::state::AppState;
use crate::watcher;

#[tauri::command]
pub async fn open_workspace(folder_path: String) -> AppResult<WorkspaceInfo> {
    blocking(move || workspace::open(&folder_path)).await
}

/// Rescans one workspace folder for repositories. The frontend calls it for
/// Scan for Repositories and when the watcher reports a new repository.
#[tauri::command]
pub async fn discover_repositories(workspace_root: String) -> AppResult<Vec<RepoInfo>> {
    blocking(move || workspace::discover_repositories(&workspace_root)).await
}

#[tauri::command]
pub async fn init_repository(folder_path: String) -> AppResult<RepoInfo> {
    blocking(move || workspace::init(&folder_path)).await
}

/// Starts watching one workspace folder for changes in `repo_roots`, replacing
/// the previous watcher of that folder. A multi-root workspace watches each of
/// its folders; the frontend unwatches folders it removes.
#[tauri::command]
pub fn watch_workspace(
    app: AppHandle,
    state: State<'_, AppState>,
    workspace_root: String,
    repo_roots: Vec<String>,
) -> AppResult<()> {
    let workspace_watcher = watcher::watch(app, &workspace_root, &repo_roots)?;
    let mut watchers = state.watchers.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    watchers.insert(workspace_root, workspace_watcher);
    Ok(())
}

#[tauri::command]
pub fn unwatch_workspace(state: State<'_, AppState>, workspace_root: String) {
    let mut watchers = state.watchers.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    watchers.remove(&workspace_root);
}

/// Reads a `.gitmanager-workspace` or VS Code `.code-workspace` file.
#[tauri::command]
pub async fn read_workspace_file(file_path: String) -> AppResult<crate::workspace_file::WorkspaceFile> {
    blocking(move || crate::workspace_file::read(std::path::Path::new(&file_path))).await
}

/// Saves the workspace folders into `file_path`, keeping its other settings.
#[tauri::command]
pub async fn write_workspace_file(file_path: String, folders: Vec<String>) -> AppResult<()> {
    blocking(move || crate::workspace_file::write(std::path::Path::new(&file_path), &folders)).await
}
