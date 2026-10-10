//! The merge tool's commands, named and shaped like src-tauri/src/commands/merge.rs: the conflicts list, one
//! conflict as a merge document, saving a resolution, taking a whole side, and the mergetool launch's four files.

use std::path::Path;

use serde::Deserialize;

use super::safe_join;
use crate::error::AppResult;
use crate::git::cli;
use crate::git::conflicts::{self, ConflictSummary};
use crate::git::repo::{self as git_repo, path_text};
use crate::merge::model::{Eol, MergeDocument};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoArgs {
    repo_path: String,
}

pub fn list_conflicts(args: RepoArgs) -> AppResult<ConflictSummary> {
    conflicts::list(&git_repo::open(&args.repo_path)?)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadConflictArgs {
    repo_path: String,
    conflict_path: String,
    ignore_whitespace: bool,
}

pub fn load_conflict(args: LoadConflictArgs) -> AppResult<MergeDocument> {
    conflicts::load(&git_repo::open(&args.repo_path)?, &args.conflict_path, args.ignore_whitespace)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResolutionArgs {
    repo_path: String,
    conflict_path: String,
    content: String,
    eol: Eol,
}

/// Writes the merged result and stages it, which marks the conflict resolved.
pub fn save_resolution(args: SaveResolutionArgs) -> AppResult<()> {
    let full = safe_join(&args.repo_path, &args.conflict_path)?;
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&full, args.eol.apply(&args.content))?;
    cli::run(Path::new(&args.repo_path), &["add", "--", &args.conflict_path])?;
    Ok(())
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Side {
    Ours,
    Theirs,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceptSideArgs {
    repo_path: String,
    conflict_paths: Vec<String>,
    side: Side,
}

/// Resolves whole files by taking one side; a side that deleted the file resolves to a deletion.
pub fn accept_side(args: AcceptSideArgs) -> AppResult<()> {
    let repo = git_repo::open(&args.repo_path)?;
    let index = repo.index()?;
    let (mut take, mut remove) = (Vec::new(), Vec::new());
    for conflict in index.conflicts()?.flatten() {
        let path = [&conflict.our, &conflict.their, &conflict.ancestor]
            .iter()
            .find_map(|entry| entry.as_ref().map(|entry| path_text(&entry.path)))
            .unwrap_or_default();
        if !args.conflict_paths.contains(&path) {
            continue;
        }
        let chosen = match args.side {
            Side::Ours => &conflict.our,
            Side::Theirs => &conflict.their,
        };
        if chosen.is_some() {
            take.push(path);
        } else {
            remove.push(path);
        }
    }
    let root = Path::new(&args.repo_path);
    let with_paths = |head: &[&str], paths: &[String]| -> Vec<String> {
        let mut all: Vec<String> = head.iter().map(|part| part.to_string()).collect();
        all.push("--".to_string());
        all.extend(paths.iter().cloned());
        all
    };
    let run = |parts: Vec<String>| -> AppResult<()> {
        let refs: Vec<&str> = parts.iter().map(String::as_str).collect();
        cli::run(root, &refs).map(|_| ())
    };
    if !take.is_empty() {
        let flag = match args.side {
            Side::Ours => "--ours",
            Side::Theirs => "--theirs",
        };
        run(with_paths(&["checkout", flag], &take))?;
        run(with_paths(&["add"], &take))?;
    }
    if !remove.is_empty() {
        run(with_paths(&["rm", "-q"], &remove))?;
    }
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergetoolArgs {
    base_path: String,
    local_path: String,
    remote_path: String,
    merged_path: String,
    ignore_whitespace: bool,
}

/// `git mergetool`'s BASE, LOCAL, REMOTE and MERGED as one merge document (load_mergetool in the current app).
pub fn load_mergetool(args: MergetoolArgs) -> AppResult<MergeDocument> {
    Ok(conflicts::load_files(
        Path::new(&args.base_path),
        Path::new(&args.local_path),
        Path::new(&args.remote_path),
        Path::new(&args.merged_path),
        args.ignore_whitespace,
    ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveMergetoolArgs {
    merged_path: String,
    content: String,
    eol: Eol,
}

/// Saves MERGED; the app then quits with status 0 so `git mergetool` marks the file resolved.
pub fn save_mergetool(args: SaveMergetoolArgs) -> AppResult<()> {
    std::fs::write(&args.merged_path, args.eol.apply(&args.content))?;
    Ok(())
}
