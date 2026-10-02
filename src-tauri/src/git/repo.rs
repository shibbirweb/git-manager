use std::path::{Path, PathBuf};

use git2::{Commit, Oid, Repository};
use serde::Serialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub root: String,
    pub name: String,
    /// Repo root relative to the workspace root with `/` separators; "" for
    /// the workspace root itself or a repository enclosing it.
    pub relative_path: String,
    /// A submodule of the repository enclosing it.
    pub submodule: bool,
    /// A linked work tree (`git worktree add`): its `.git` is a file.
    pub worktree: bool,
}

/// Opens the repository whose work tree root is `repo_path`. Repositories
/// are opened per call: cheap, and nothing large stays resident between calls.
pub fn open(repo_path: &str) -> AppResult<Repository> {
    Ok(Repository::open(repo_path)?)
}

/// Finds the enclosing repository of any path inside a work tree.
pub fn discover(path: &str) -> AppResult<RepoInfo> {
    let repo = Repository::discover(path)?;
    let root = repo
        .workdir()
        .ok_or_else(|| AppError::invalid("Bare repositories are not supported"))?;
    let root = root.to_path_buf();
    Ok(RepoInfo {
        name: root
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| root.to_string_lossy().into_owned()),
        root: strip_trailing_slash(&root),
        relative_path: String::new(),
        submodule: false,
        worktree: repo.is_worktree(),
    })
}

pub fn strip_trailing_slash(path: &Path) -> String {
    let text = path.to_string_lossy();
    if text.len() > 1 {
        text.trim_end_matches('/').to_string()
    } else {
        text.into_owned()
    }
}

pub fn workdir(repo: &Repository) -> AppResult<PathBuf> {
    repo.workdir()
        .map(Path::to_path_buf)
        .ok_or_else(|| AppError::invalid("Bare repositories are not supported"))
}

pub fn short_id(oid: Oid) -> String {
    let text = oid.to_string();
    text[..8.min(text.len())].to_string()
}

pub fn read_git_file(repo: &Repository, name: &str) -> Option<String> {
    std::fs::read_to_string(repo.path().join(name))
        .ok()
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

/// Reads a blob as UTF-8 text. Returns None for binary or non-UTF-8 data.
pub fn blob_text(repo: &Repository, oid: Oid) -> AppResult<Option<String>> {
    let blob = repo.find_blob(oid)?;
    if blob.is_binary() {
        return Ok(None);
    }
    Ok(String::from_utf8(blob.content().to_vec()).ok())
}

pub fn bytes_to_text(bytes: Vec<u8>) -> Option<String> {
    let sniff = &bytes[..bytes.len().min(8000)];
    if sniff.contains(&0) {
        return None;
    }
    String::from_utf8(bytes).ok()
}

pub fn path_text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}

/// The commit a user-given revision (HEAD, a branch, a tag, a hash) points at.
pub fn resolve_commit<'repo>(repo: &'repo Repository, revision: &str) -> AppResult<Commit<'repo>> {
    let revision = revision.trim();
    if revision.is_empty() {
        return Err(AppError::invalid("Enter a revision"));
    }
    if revision.starts_with('-') {
        return Err(AppError::invalid(format!("Unknown revision: {revision}")));
    }
    repo.revparse_single(revision)
        .and_then(|object| object.peel_to_commit())
        .map_err(|_| AppError::invalid(format!("Unknown revision: {revision}")))
}
