//! Files panel writes: create, rename, copy, move and Move to Trash. The checks and
//! file system work live in `crate::file_ops`; these only move it off the main thread.

use super::blocking;
use crate::error::AppResult;
use crate::file_ops::{self, FileMove};

/// Creates a file or folder; `name` may hold "/" to create nested folders.
#[tauri::command]
pub async fn file_create(
    workspace_roots: Vec<String>,
    parent_dir: String,
    name: String,
    is_dir: bool,
) -> AppResult<String> {
    blocking(move || file_ops::create_entry(&workspace_roots, &parent_dir, &name, is_dir)).await
}

#[tauri::command]
pub async fn file_rename(workspace_roots: Vec<String>, entry_path: String, new_name: String) -> AppResult<String> {
    blocking(move || file_ops::rename_entry(&workspace_roots, &entry_path, &new_name)).await
}

#[tauri::command]
pub async fn file_copy(
    workspace_roots: Vec<String>,
    source_paths: Vec<String>,
    target_dir: String,
) -> AppResult<Vec<String>> {
    blocking(move || file_ops::copy_entries(&workspace_roots, &source_paths, &target_dir)).await
}

#[tauri::command]
pub async fn file_move(
    workspace_roots: Vec<String>,
    source_paths: Vec<String>,
    target_dir: String,
) -> AppResult<Vec<FileMove>> {
    blocking(move || file_ops::move_entries(&workspace_roots, &source_paths, &target_dir)).await
}

#[tauri::command]
pub async fn file_trash(workspace_roots: Vec<String>, entry_paths: Vec<String>) -> AppResult<()> {
    blocking(move || file_ops::trash_entries(&workspace_roots, &entry_paths, file_ops::move_to_trash)).await
}
