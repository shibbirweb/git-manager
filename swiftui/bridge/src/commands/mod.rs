//! The commands the SwiftUI app can call, named and shaped like the Tauri ones
//! (src-tauri/src/commands), so `src/lib/api.ts` stays the reference for both apps.

use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{AppError, AppResult};
use crate::git::diff::{self, DiffArea, FileDiff};
use crate::git::files::{FolderLister, FolderListing};
use crate::git::repo as git_repo;
use crate::git::status::{self, RepoStatus};
use crate::git::workspace;
use crate::paths::RealPath;

#[path = "../../../../src-tauri/src/commands/commit_options.rs"]
mod commit_options;
mod branches;
mod clone;
mod editing;
mod editor;
mod github;
mod remote;
mod log;
mod search;
mod merge;
mod workspaces;
mod write;

pub fn dispatch(command: &str, args: Value) -> AppResult<Value> {
    if command.starts_with("terminal_") {
        return crate::terminal_ffi::dispatch(command, args).unwrap_or_else(|| unknown(command));
    }
    match command {
        "get_status" => to_json(get_status(parse(command, args)?)?),
        "open_workspace" => to_json(workspaces::open_workspace(parse(command, args)?)?),
        "discover_repositories" => to_json(workspaces::discover_repositories(parse(command, args)?)?),
        "init_repository" => to_json(workspaces::init_repository(parse(command, args)?)?),
        "list_remotes" => to_json(remote::list_remotes(parse(command, args)?)?),
        "push_with_options" => to_json(remote::push_with_options(parse(command, args)?)?),
        "fetch_all" => to_json(remote::fetch_all(parse(command, args)?)?),
        "git_progress" => to_json(remote::git_progress()?),
        "github_account" => to_json(github::github_account()?),
        "github_cli_status" => to_json(github::github_cli_status()?),
        "github_sign_in_with_token" => to_json(github::github_sign_in_with_token(parse(command, args)?)?),
        "github_sign_in_with_cli" => to_json(github::github_sign_in_with_cli()?),
        "github_sign_out" => to_json(github::github_sign_out()?),
        "github_share_project" => to_json(github::github_share_project(parse(command, args)?)?),
        "github_repository" => to_json(github::github_repository(parse(command, args)?)?),
        "github_sync_fork" => to_json(github::github_sync_fork(parse(command, args)?)?),
        "github_create_gist" => to_json(github::github_create_gist(parse(command, args)?)?),
        "read_workspace_file" => to_json(workspaces::read_workspace_file(parse(command, args)?)?),
        "write_workspace_file" => to_json(workspaces::write_workspace_file(parse(command, args)?)?),
        // The status bar's readout: this app and any helpers, counted like the current app counts itself.
        "memory_usage" => to_json(crate::memory::usage()),
        "list_directories" => to_json(list_directories(parse(command, args)?)?),
        "get_file_diff" => to_json(get_file_diff(parse(command, args)?)?),
        "read_worktree_file" => to_json(editor::read_worktree_file(parse(command, args)?)?),
        "blame_contents" => to_json(editor::blame_contents(parse(command, args)?)?),
        "write_worktree_file" => to_json(editing::write_worktree_file(parse(command, args)?)?),
        "line_change_marks" => to_json(editing::line_change_marks(parse(command, args)?)?),
        "stage_files" => to_json(write::stage_files(parse(command, args)?)?),
        "unstage_files" => to_json(write::unstage_files(parse(command, args)?)?),
        "commit" => to_json(write::commit(parse(command, args)?)?),
        "commit_all" => to_json(write::commit_all(parse(command, args)?)?),
        "get_head_message" => to_json(write::get_head_message(parse(command, args)?)?),
        "last_action" => to_json(write::last_action(parse(command, args)?)?),
        "move_head_back" => to_json(write::move_head_back(parse(command, args)?)?),
        "clone_repository" => to_json(clone::clone_repository(parse(command, args)?)?),
        "clone_progress" => to_json(clone::clone_progress()?),
        "cancel_git_command" => to_json(clone::cancel_git_command(parse(command, args)?)?),
        "get_refs" => to_json(branches::get_refs(parse(command, args)?)?),
        "checkout_branch" => to_json(branches::checkout_branch(parse(command, args)?)?),
        "get_log" => to_json(log::get_log(parse(command, args)?)?),
        "get_commit_details" => to_json(log::get_commit_details(parse(command, args)?)?),
        "get_commit_file_diff" => to_json(log::get_commit_file_diff(parse(command, args)?)?),
        "resolve_revision" => to_json(log::resolve_revision(parse(command, args)?)?),
        "file_search_open" => to_json(search::file_search_open(parse(command, args)?)?),
        "file_search_query" => to_json(search::file_search_query(parse(command, args)?)?),
        "file_search_close" => to_json(search::file_search_close()?),
        "text_search" => to_json(search::text_search(parse(command, args)?)?),
        "text_search_cancel" => to_json(search::text_search_cancel(parse(command, args)?)?),
        "text_search_start" => to_json(search::text_search_start(parse(command, args)?)?),
        "text_search_poll" => to_json(search::text_search_poll(parse(command, args)?)?),
        "list_conflicts" | "load_conflict" | "save_resolution" | "accept_side" => merge_command(command, args),
        "load_mergetool" | "save_mergetool" => merge_command(command, args),
        _ => unknown(command),
    }
}

fn unknown(command: &str) -> AppResult<Value> {
    Err(AppError::invalid(format!("Unknown command: {command}")))
}

fn merge_command(command: &str, args: Value) -> AppResult<Value> {
    match command {
        "list_conflicts" => to_json(merge::list_conflicts(parse(command, args)?)?),
        "load_conflict" => to_json(merge::load_conflict(parse(command, args)?)?),
        "save_resolution" => to_json(merge::save_resolution(parse(command, args)?)?),
        "accept_side" => to_json(merge::accept_side(parse(command, args)?)?),
        "load_mergetool" => to_json(merge::load_mergetool(parse(command, args)?)?),
        _ => to_json(merge::save_mergetool(parse(command, args)?)?),
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetFileDiffArgs {
    repo_path: String,
    file_path: String,
    orig_path: Option<String>,
    area: DiffArea,
    known_version: Option<String>,
}

/// Same as the Tauri command in src-tauri/src/commands/status.rs: one file's staged or unstaged diff, with the
/// changed line ranges already computed; None when `known_version` still matches.
fn get_file_diff(args: GetFileDiffArgs) -> AppResult<Option<FileDiff>> {
    let repo = git_repo::open(&args.repo_path)?;
    diff::working_file_if_changed(
        &repo,
        &args.file_path,
        args.orig_path.as_deref(),
        args.area,
        args.known_version.as_deref(),
    )
}

/// Refuses a user-given name or revision that git would read as an option (src-tauri's commands::reject_option,
/// which the shared GitHub service calls).
pub fn reject_option(value: &str, what: &str) -> AppResult<()> {
    if value.starts_with('-') {
        return Err(AppError::invalid(format!("{what} cannot start with '-': {value}")));
    }
    Ok(())
}
