//! Workspace folders: any directory, holding zero or more (possibly nested)
//! repositories, found by a bounded breadth-first scan.

use std::collections::VecDeque;
use std::path::{Component, Path, PathBuf};

use git2::Repository;
use serde::Serialize;

use super::cli;
use super::repo::{strip_trailing_slash, RepoInfo};
use crate::error::{AppError, AppResult};

/// Levels below the workspace root that are still searched for repositories.
const MAX_SCAN_DEPTH: usize = 6;
/// Upper bound on directories read per scan, so huge folders stay fast.
const MAX_SCAN_DIRS: usize = 50_000;
/// Dependency, build and tool folders that never hold repositories worth showing.
const SKIPPED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "bower_components",
    "vendor",
    "target",
    "dist",
    "build",
    "out",
    ".venv",
    "venv",
    "__pycache__",
    ".gradle",
    ".idea",
    ".next",
    ".nuxt",
    ".cache",
    "coverage",
    "Pods",
    "DerivedData",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub root: String,
    pub name: String,
    pub repos: Vec<RepoInfo>,
}

fn last_component(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

/// Canonical path of an existing directory.
pub fn canonical_dir(folder_path: &str) -> AppResult<PathBuf> {
    let path = Path::new(folder_path);
    if !path.exists() {
        return Err(AppError::invalid(format!("Folder does not exist: {folder_path}")));
    }
    if !path.is_dir() {
        return Err(AppError::invalid(format!("Not a folder: {folder_path}")));
    }
    Ok(path.canonicalize()?)
}

/// `/`-separated path of `path` below `base`, or "" when it is not below it.
pub fn relative_slash_path(base: &Path, path: &Path) -> String {
    let Ok(relative) = path.strip_prefix(base) else {
        return String::new();
    };
    relative
        .components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

pub fn repo_info(workspace_root: &Path, repo_root: &Path) -> RepoInfo {
    RepoInfo {
        root: strip_trailing_slash(repo_root),
        name: last_component(repo_root),
        relative_path: relative_slash_path(workspace_root, repo_root),
    }
}

/// Index of the deepest of `repo_roots` that is `path` or one of its ancestors.
pub fn deepest_repo_index(repo_roots: &[PathBuf], path: &Path) -> Option<usize> {
    repo_roots
        .iter()
        .enumerate()
        .filter(|(_, repo_root)| path.starts_with(repo_root))
        .max_by_key(|(_, repo_root)| repo_root.components().count())
        .map(|(index, _)| index)
}

pub fn deepest_repo<'a>(repo_roots: &'a [PathBuf], path: &Path) -> Option<&'a PathBuf> {
    deepest_repo_index(repo_roots, path).map(|index| &repo_roots[index])
}

/// The repository whose work tree contains the workspace root, if any.
fn enclosing_repo(workspace_root: &Path) -> Option<PathBuf> {
    let repo = Repository::discover(workspace_root).ok()?;
    if repo.is_bare() {
        return None;
    }
    let workdir = repo.workdir()?.canonicalize().ok()?;
    workspace_root.starts_with(&workdir).then_some(workdir)
}

fn is_repo_root(dir: &Path) -> bool {
    Repository::open(dir)
        .map(|repo| !repo.is_bare() && repo.workdir().is_some())
        .unwrap_or(false)
}

/// Breadth-first search for repository roots at or below `workspace_root`,
/// descending into repositories to find nested ones. Symlinks are not followed.
fn scan(workspace_root: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    let mut queue = VecDeque::from([(workspace_root.to_path_buf(), 0usize)]);
    let mut visited = 0;
    while let Some((dir, depth)) = queue.pop_front() {
        if visited >= MAX_SCAN_DIRS {
            break;
        }
        visited += 1;
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        let mut has_git = false;
        for entry in entries.flatten() {
            let name = entry.file_name();
            if name == ".git" {
                has_git = true;
                continue;
            }
            if depth >= MAX_SCAN_DEPTH {
                continue;
            }
            let is_dir = entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false);
            let skipped = name.to_str().map(|name| SKIPPED_DIRS.contains(&name)).unwrap_or(false);
            if is_dir && !skipped {
                queue.push_back((entry.path(), depth + 1));
            }
        }
        if has_git && is_repo_root(&dir) {
            found.push(dir);
        }
    }
    found
}

/// The enclosing repository plus every repository below `workspace_root`
/// (already canonical), sorted so parents come before children.
fn find_repos(workspace_root: &Path) -> Vec<RepoInfo> {
    let mut roots: Vec<PathBuf> = enclosing_repo(workspace_root).into_iter().collect();
    roots.extend(scan(workspace_root));
    let mut repos: Vec<RepoInfo> = roots.iter().map(|root| repo_info(workspace_root, root)).collect();
    repos.sort_by(|a, b| a.root.cmp(&b.root));
    repos.dedup_by(|a, b| a.root == b.root);
    repos
}

pub fn open(folder_path: &str) -> AppResult<WorkspaceInfo> {
    let root = canonical_dir(folder_path)?;
    Ok(WorkspaceInfo {
        repos: find_repos(&root),
        name: last_component(&root),
        root: strip_trailing_slash(&root),
    })
}

/// The same scan as `open`, run again when the frontend asks for a rescan.
pub fn discover_repositories(workspace_root: &str) -> AppResult<Vec<RepoInfo>> {
    Ok(find_repos(&canonical_dir(workspace_root)?))
}

/// `git init` in an existing folder.
pub fn init(folder_path: &str) -> AppResult<RepoInfo> {
    let folder = canonical_dir(folder_path)?;
    cli::run(&folder, &["init"])?;
    Ok(repo_info(&folder, &folder))
}
