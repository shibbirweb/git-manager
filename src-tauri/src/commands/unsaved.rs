//! Remember unsaved changes (unsaved.rs): the editor keeps the text of Untitled tabs and of
//! files with unsaved edits in `~/.gitmanager/unsaved/`, reads it back when a workspace opens,
//! and forgets it once the text is saved, reverted or discarded.

use serde::Deserialize;
use tauri::ipc::Request;

use super::{blocking, raw_body, raw_parts};
use crate::config;
use crate::error::AppResult;
use crate::local_history::now_ms;
use crate::unsaved::{self, UnsavedMeta, UnsavedText};

fn store_dir() -> AppResult<std::path::PathBuf> {
    Ok(config::config_dir_in(&config::home_dir()?).join(unsaved::DIR_NAME))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteArgs {
    tab_path: String,
    workspace_id: String,
}

/// Raw body: `{ tabPath, workspaceId }` as one JSON line, then the editor's text.
#[tauri::command]
pub async fn unsaved_write(request: Request<'_>) -> AppResult<()> {
    let body = raw_body(&request)?;
    blocking(move || {
        let (args, text) = raw_parts::<WriteArgs>(&body)?;
        let meta = UnsavedMeta {
            tab_path: args.tab_path,
            workspace_id: args.workspace_id,
            saved_at: now_ms(),
        };
        unsaved::write(&store_dir()?, &meta, text)
    })
    .await
}

#[tauri::command]
pub async fn unsaved_read(tab_path: String) -> AppResult<Option<UnsavedText>> {
    blocking(move || unsaved::read(&store_dir()?, &tab_path)).await
}

#[tauri::command]
pub async fn unsaved_remove(tab_paths: Vec<String>) -> AppResult<()> {
    blocking(move || {
        let dir = store_dir()?;
        for tab_path in &tab_paths {
            unsaved::remove(&dir, tab_path)?;
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn unsaved_list() -> AppResult<Vec<UnsavedMeta>> {
    blocking(move || Ok(unsaved::list(&store_dir()?))).await
}
