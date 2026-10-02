use std::path::PathBuf;

use tauri::State;

use super::{blocking, safe_join};
use crate::error::AppResult;
use crate::git::files::{self, DirListing, FileContent};
use crate::git::workspace;
use crate::images;
use crate::preview_scheme::{self, PreviewStat, Target};
use crate::state::AppState;

/// Lists one directory of the workspace; an empty `dir_path` is the root.
/// `repo_roots` are the workspace repositories, used for `isRepo` and `ignored`.
#[tauri::command]
pub async fn list_directory(root_path: String, dir_path: String, repo_roots: Vec<String>) -> AppResult<DirListing> {
    blocking(move || {
        let root = workspace::canonical_dir(&root_path)?;
        let full_dir = if dir_path.is_empty() {
            root
        } else {
            safe_join(&root.to_string_lossy(), &dir_path)?
        };
        let repo_roots: Vec<PathBuf> = repo_roots
            .iter()
            .filter_map(|repo_root| PathBuf::from(repo_root).canonicalize().ok())
            .collect();
        files::list_dir(&full_dir, &dir_path, &repo_roots)
    })
    .await
}

#[tauri::command]
pub async fn read_worktree_file(repo_path: String, file_path: String) -> AppResult<FileContent> {
    blocking(move || {
        let full_path = safe_join(&repo_path, &file_path)?;
        files::read_file(&full_path, &file_path)
    })
    .await
}

/// What the preview needs before it loads a `gmpreview` URL: whether the file is there, its
/// size and, when it is too big, the limit. A work tree file (absolute `file_path`) without
/// `repo_root`, else a repo-relative `file_path` of `repo_root` at `revision`.
#[tauri::command]
pub async fn preview_stat(
    state: State<'_, AppState>,
    file_path: String,
    repo_root: Option<String>,
    revision: Option<String>,
) -> AppResult<PreviewStat> {
    let folders = state.preview_folders.clone();
    blocking(move || {
        let target = Target::from_parts(file_path, repo_root, revision)?;
        preview_scheme::stat(&folders.get(), &target)
    })
    .await
}

/// A local image for the Markdown preview as a data URL. `image_path` is
/// relative to the workspace folder `root_path` and must stay inside it.
#[tauri::command]
pub async fn read_image_data_url(root_path: String, image_path: String) -> AppResult<String> {
    blocking(move || {
        let root = workspace::canonical_dir(&root_path)?;
        let full_path = safe_join(&root.to_string_lossy(), &image_path)?;
        images::read_data_url(&root, &full_path)
    })
    .await
}
