//! The commands the SwiftUI app can call, named and shaped like the Tauri ones
//! (src-tauri/src/commands), so `src/lib/api.ts` stays the reference for both apps.

use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{AppError, AppResult};
use crate::git::files::{FolderLister, FolderListing};
use crate::git::repo as git_repo;
use crate::git::status::{self, RepoStatus};
use crate::git::workspace;
use crate::paths::RealPath;

pub fn dispatch(command: &str, args: Value) -> AppResult<Value> {
    match command {
        "get_status" => to_json(get_status(parse(command, args)?)?),
        // The status bar's readout: this app and any helpers, counted like the current app counts itself.
        "memory_usage" => to_json(crate::memory::usage()),
        "list_directories" => to_json(list_directories(parse(command, args)?)?),
        _ => Err(AppError::invalid(format!("Unknown command: {command}"))),
    }
}

fn parse<T: DeserializeOwned>(command: &str, args: Value) -> AppResult<T> {
    serde_json::from_value(args).map_err(|err| AppError::invalid(format!("{command}: {err}")))
}

fn to_json<T: Serialize>(value: T) -> AppResult<Value> {
    serde_json::to_value(value).map_err(|err| AppError::invalid(err.to_string()))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetStatusArgs {
    repo_path: String,
    known_hash: Option<String>,
}

/// Same as the Tauri command in src-tauri/src/commands/status.rs.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StatusSnapshot {
    hash: String,
    status: Option<RepoStatus>,
}

fn get_status(args: GetStatusArgs) -> AppResult<StatusSnapshot> {
    let status = status::read(&git_repo::open(&args.repo_path)?)?;
    let hash = status::hash(&status);
    if args.known_hash.as_deref() == Some(hash.as_str()) {
        return Ok(StatusSnapshot { hash, status: None });
    }
    Ok(StatusSnapshot { hash, status: Some(status) })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListDirectoriesArgs {
    root_path: String,
    dir_paths: Vec<String>,
    repo_roots: Vec<String>,
    known: Option<HashMap<String, String>>,
}

/// Same as the Tauri command in src-tauri/src/commands/files.rs: several folders of one workspace folder at once,
/// each relative to it ("" for the folder itself); a folder whose stamp in `known` still matches answers unchanged.
fn list_directories(args: ListDirectoriesArgs) -> AppResult<Vec<FolderListing>> {
    let root = workspace::canonical_dir(&args.root_path)?;
    let root_text = root.to_string_lossy().into_owned();
    let repo_roots: Vec<PathBuf> =
        args.repo_roots.iter().filter_map(|repo_root| PathBuf::from(repo_root).real_path().ok()).collect();
    let known = args.known.unwrap_or_default();
    let mut lister = FolderLister::new(&repo_roots);
    Ok(args
        .dir_paths
        .into_iter()
        .map(|dir_path| {
            let full_dir = if dir_path.is_empty() { Ok(root.clone()) } else { safe_join(&root_text, &dir_path) };
            let known_stamp = known.get(&dir_path).map(String::as_str);
            lister.list(dir_path, full_dir, known_stamp)
        })
        .collect())
}

/// Joins a relative path from the UI, refusing anything that leaves the folder (src-tauri/src/commands/mod.rs).
fn safe_join(root_path: &str, relative_path: &str) -> AppResult<PathBuf> {
    let relative = Path::new(relative_path);
    let escapes = relative.is_absolute()
        || relative
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::Prefix(_) | Component::RootDir));
    if escapes || relative_path.is_empty() {
        return Err(AppError::invalid(format!("Invalid path: {relative_path}")));
    }
    Ok(Path::new(root_path).join(relative))
}
