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

/// libgit2 settings for the whole process, made once at start before any repository is opened.
///
/// Windows: libgit2 refuses a repository owned by the Administrators group (one made in an elevated
/// terminal) when the app runs without elevation, though git accepts it, so the app said "Not a git
/// repository" there. libgit2 only reads here and runs nothing a repository's config names; every
/// write goes through git, which keeps its own ownership check (safe.directory).
pub fn configure_libgit2() {
    #[cfg(windows)]
    // SAFETY: called before any other thread uses libgit2.
    unsafe {
        let _ = git2::opts::set_verify_owner_validation(false);
    }
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

/// The path for the page (see paths.rs) without a trailing `/`, except for a root (`/`, `C:/`).
pub fn strip_trailing_slash(path: &Path) -> String {
    let text = crate::paths::to_ui(path);
    let trimmed = text.trim_end_matches('/');
    if trimmed.is_empty() || trimmed.ends_with(':') {
        text
    } else {
        trimmed.to_string()
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

#[cfg(test)]
mod tests {
    use super::strip_trailing_slash;
    use std::path::Path;

    #[test]
    fn roots_keep_their_slash_and_folders_lose_it() {
        assert_eq!(strip_trailing_slash(Path::new("/")), "/");
        assert_eq!(strip_trailing_slash(Path::new("/Users/me/repo/")), "/Users/me/repo");
        assert_eq!(strip_trailing_slash(Path::new("/Users/me/repo")), "/Users/me/repo");
    }

    #[cfg(windows)]
    #[test]
    fn windows_roots_use_slashes_and_keep_the_drive_root() {
        assert_eq!(strip_trailing_slash(Path::new(r"C:\")), "C:/");
        assert_eq!(strip_trailing_slash(Path::new(r"c:\Users\me\repo\")), "C:/Users/me/repo");
        assert_eq!(strip_trailing_slash(Path::new(r"\\?\C:\Users\me\repo")), "C:/Users/me/repo");
    }
}
