use std::path::PathBuf;

use super::{blocking, safe_join};
use crate::error::AppResult;
use crate::git::files::{self, DirListing, FileContent};
use crate::git::workspace;
use crate::images;

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
