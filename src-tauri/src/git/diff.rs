//! Loads the two sides of a 2-way diff. The frontend computes the visual diff
//! with CodeMirror, so only the texts cross the IPC bridge.

use git2::{Oid, Repository, Tree};
use serde::{Deserialize, Serialize};

use super::repo::{bytes_to_text, workdir};
use crate::error::AppResult;
use crate::merge::model::{normalize_eol, Eol};

/// Files above this size are not diffed in the UI.
const MAX_DIFF_BYTES: usize = 4 * 1024 * 1024;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiffArea {
    /// HEAD vs index.
    Staged,
    /// Index vs work tree.
    Unstaged,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub path: String,
    pub original: String,
    pub modified: String,
    pub original_eol: Eol,
    pub modified_eol: Eol,
    pub binary: bool,
    pub too_large: bool,
}

enum Side {
    Missing,
    Bytes(Vec<u8>),
}

fn blob_side(repo: &Repository, oid: Oid) -> AppResult<Side> {
    Ok(Side::Bytes(repo.find_blob(oid)?.content().to_vec()))
}

fn tree_side(repo: &Repository, tree: Option<&Tree>, path: &str) -> AppResult<Side> {
    let Some(tree) = tree else {
        return Ok(Side::Missing);
    };
    match tree.get_path(std::path::Path::new(path)) {
        Ok(entry) => blob_side(repo, entry.id()),
        Err(_) => Ok(Side::Missing),
    }
}

fn index_side(repo: &Repository, path: &str) -> AppResult<Side> {
    let index = repo.index()?;
    match index.get_path(std::path::Path::new(path), 0) {
        Some(entry) => blob_side(repo, entry.id),
        None => Ok(Side::Missing),
    }
}

fn workdir_side(repo: &Repository, path: &str) -> AppResult<Side> {
    let full = workdir(repo)?.join(path);
    match std::fs::read(&full) {
        Ok(bytes) => Ok(Side::Bytes(bytes)),
        Err(_) => Ok(Side::Missing),
    }
}

fn build(path: &str, original: Side, modified: Side) -> FileDiff {
    let size = |side: &Side| match side {
        Side::Missing => 0,
        Side::Bytes(bytes) => bytes.len(),
    };
    let mut diff = FileDiff {
        path: path.to_string(),
        original: String::new(),
        modified: String::new(),
        original_eol: Eol::Lf,
        modified_eol: Eol::Lf,
        binary: false,
        too_large: size(&original) > MAX_DIFF_BYTES || size(&modified) > MAX_DIFF_BYTES,
    };
    if diff.too_large {
        return diff;
    }
    let to_text = |side: Side| -> Option<String> {
        match side {
            Side::Missing => Some(String::new()),
            Side::Bytes(bytes) => bytes_to_text(bytes),
        }
    };
    match (to_text(original), to_text(modified)) {
        (Some(original), Some(modified)) => {
            diff.original_eol = Eol::detect(&original);
            diff.modified_eol = Eol::detect(&modified);
            diff.original = normalize_eol(&original);
            diff.modified = normalize_eol(&modified);
        }
        _ => diff.binary = true,
    }
    diff
}

pub fn working_file(repo: &Repository, path: &str, orig_path: Option<&str>, area: DiffArea) -> AppResult<FileDiff> {
    match area {
        DiffArea::Unstaged => {
            let original = index_side(repo, path)?;
            let modified = workdir_side(repo, path)?;
            Ok(build(path, original, modified))
        }
        DiffArea::Staged => {
            let head_tree = repo.head().ok().and_then(|head| head.peel_to_tree().ok());
            let original = tree_side(repo, head_tree.as_ref(), orig_path.unwrap_or(path))?;
            let modified = index_side(repo, path)?;
            Ok(build(path, original, modified))
        }
    }
}

/// Diff of one file in a commit against its first parent.
pub fn commit_file(repo: &Repository, commit_id: &str, path: &str, orig_path: Option<&str>) -> AppResult<FileDiff> {
    let commit = repo.find_commit(Oid::from_str(commit_id)?)?;
    let tree = commit.tree()?;
    let parent_tree = commit.parent(0).ok().and_then(|parent| parent.tree().ok());
    let original = tree_side(repo, parent_tree.as_ref(), orig_path.unwrap_or(path))?;
    let modified = tree_side(repo, Some(&tree), path)?;
    Ok(build(path, original, modified))
}
