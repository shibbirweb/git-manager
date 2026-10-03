//! Loads the two sides of a 2-way diff. The frontend computes the visual diff
//! with CodeMirror, so only the texts cross the IPC bridge.

use git2::{Oid, Repository, Tree};
use serde::{Deserialize, Serialize};

use super::lfs::{self, LfsPointer};
use super::repo::{bytes_to_text, resolve_commit, workdir};
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
    /// Set when either side is a Git LFS pointer: the sizes to show instead of the pointer text.
    pub lfs: Option<LfsDiff>,
}

/// One side's real content: from the pointer, or the bytes when that side is
/// the checked-out file itself.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LfsDiff {
    pub original_size: Option<u64>,
    pub modified_size: Option<u64>,
    pub original_oid: Option<String>,
    pub modified_oid: Option<String>,
}

enum Side {
    Missing,
    Bytes(Vec<u8>),
}

fn blob_side(repo: &Repository, oid: Oid) -> AppResult<Side> {
    Ok(Side::Bytes(repo.find_blob(oid)?.content().to_vec()))
}

const GITLINK_MODE: u32 = 0o160000;

/// A submodule side reads like `git diff` shows it.
fn gitlink_side(oid: Oid) -> Side {
    Side::Bytes(format!("Subproject commit {oid}\n").into_bytes())
}

fn tree_side(repo: &Repository, tree: Option<&Tree>, path: &str) -> AppResult<Side> {
    let Some(tree) = tree else {
        return Ok(Side::Missing);
    };
    match tree.get_path(std::path::Path::new(path)) {
        Ok(entry) if entry.filemode() as u32 == GITLINK_MODE => Ok(gitlink_side(entry.id())),
        Ok(entry) => blob_side(repo, entry.id()),
        Err(_) => Ok(Side::Missing),
    }
}

fn index_side(repo: &Repository, path: &str) -> AppResult<Side> {
    let index = repo.index()?;
    match index.get_path(std::path::Path::new(path), 0) {
        Some(entry) if entry.mode == GITLINK_MODE => Ok(gitlink_side(entry.id)),
        Some(entry) => blob_side(repo, entry.id),
        None => Ok(Side::Missing),
    }
}

fn workdir_side(repo: &Repository, path: &str) -> AppResult<Side> {
    let full = workdir(repo)?.join(path);
    if full.is_dir() {
        // A submodule: the commit checked out in it.
        let head = Repository::open(&full).ok().and_then(|submodule| submodule.head().ok()?.target());
        return Ok(head.map(gitlink_side).unwrap_or(Side::Missing));
    }
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
        lfs: lfs_diff(&original, &modified),
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

fn pointer_of(side: &Side) -> Option<LfsPointer> {
    match side {
        Side::Bytes(bytes) => lfs::parse_pointer(bytes),
        Side::Missing => None,
    }
}

/// LFS sizes when either side is a pointer; the other side, if present, is
/// the real (smudged) content of the work tree.
fn lfs_diff(original: &Side, modified: &Side) -> Option<LfsDiff> {
    let (original_pointer, modified_pointer) = (pointer_of(original), pointer_of(modified));
    if original_pointer.is_none() && modified_pointer.is_none() {
        return None;
    }
    let size_of = |side: &Side, pointer: &Option<LfsPointer>| match (pointer, side) {
        (Some(pointer), _) => Some(pointer.size),
        (None, Side::Bytes(bytes)) => Some(bytes.len() as u64),
        (None, Side::Missing) => None,
    };
    Some(LfsDiff {
        original_size: size_of(original, &original_pointer),
        modified_size: size_of(modified, &modified_pointer),
        original_oid: original_pointer.map(|pointer| pointer.oid),
        modified_oid: modified_pointer.map(|pointer| pointer.oid),
    })
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

/// A diff of two sides given as bytes (None: the side does not exist), e.g. a shelved file.
pub fn from_bytes(path: &str, original: Option<Vec<u8>>, modified: Option<Vec<u8>>) -> FileDiff {
    let side = |bytes: Option<Vec<u8>>| bytes.map(Side::Bytes).unwrap_or(Side::Missing);
    build(path, side(original), side(modified))
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

/// A file at a revision (left) against its work tree copy (right).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionDiff {
    pub diff: FileDiff,
    pub exists_in_revision: bool,
    pub commit_id: String,
}

/// `orig_path` is the old name of a renamed file, read from `revision` instead of `path`.
pub fn against_revision(repo: &Repository, path: &str, orig_path: Option<&str>, revision: &str) -> AppResult<RevisionDiff> {
    let commit = resolve_commit(repo, revision)?;
    let tree = commit.tree()?;
    let original = tree_side(repo, Some(&tree), orig_path.unwrap_or(path))?;
    let exists_in_revision = matches!(original, Side::Bytes(_));
    let modified = workdir_side(repo, path)?;
    Ok(RevisionDiff {
        diff: build(path, original, modified),
        exists_in_revision,
        commit_id: commit.id().to_string(),
    })
}

/// One file between two revisions, e.g. the current branch (left) and another branch (right).
pub fn between_revisions(
    repo: &Repository,
    from_revision: &str,
    to_revision: &str,
    path: &str,
    orig_path: Option<&str>,
) -> AppResult<FileDiff> {
    let from_tree = resolve_commit(repo, from_revision)?.tree()?;
    let to_tree = resolve_commit(repo, to_revision)?.tree()?;
    let original = tree_side(repo, Some(&from_tree), orig_path.unwrap_or(path))?;
    let modified = tree_side(repo, Some(&to_tree), path)?;
    Ok(build(path, original, modified))
}
