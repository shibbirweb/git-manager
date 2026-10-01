//! Workspace browsing for the file explorer: one directory level at a time,
//! so large folders never load their whole tree.

use std::collections::BinaryHeap;
use std::path::{Path, PathBuf};

use git2::Repository;
use serde::Serialize;

use super::repo::bytes_to_text;
use super::workspace::{deepest_repo, relative_slash_path};
use crate::error::AppResult;
use crate::merge::model::{normalize_eol, Eol};

/// Files above this size are not opened in the editor.
const MAX_OPEN_BYTES: u64 = 4 * 1024 * 1024;
/// Very large directories are cut off to keep the UI responsive.
const MAX_ENTRIES: usize = 5000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    /// Workspace-relative path using `/` separators.
    pub path: String,
    pub is_dir: bool,
    /// Matched by the .gitignore of the deepest repository containing it.
    pub ignored: bool,
    /// The root of one of the workspace repositories.
    pub is_repo: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirListing {
    pub entries: Vec<DirEntry>,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub eol: Eol,
    pub binary: bool,
    pub too_large: bool,
    pub size: u64,
}

fn is_ignored(repo: &Repository, relative: &str, is_dir: bool) -> bool {
    // Directory-only patterns such as `target/` need the trailing slash.
    let candidate = if is_dir { format!("{relative}/") } else { relative.to_string() };
    repo.is_path_ignored(Path::new(&candidate)).unwrap_or(false)
}

/// Sort order of the listing: folders first, then by name ignoring case.
#[derive(PartialEq, Eq, PartialOrd, Ord)]
struct Candidate {
    is_file: bool,
    folded: String,
    name: String,
}

/// Follows symlinks so a linked folder can be expanded; only links need the extra stat.
fn is_dir_following_links(entry: &std::fs::DirEntry) -> bool {
    match entry.file_type() {
        Ok(kind) if kind.is_symlink() => std::fs::metadata(entry.path()).map(|meta| meta.is_dir()).unwrap_or(false),
        Ok(kind) => kind.is_dir(),
        Err(_) => false,
    }
}

/// Lists `full_dir` (the canonical workspace root joined with `dir_path`).
/// Only the deepest repository containing `full_dir` decides what is ignored:
/// every entry below it that is not itself a repository root belongs to it.
pub fn list_dir(full_dir: &Path, dir_path: &str, repo_roots: &[PathBuf]) -> AppResult<DirListing> {
    list_dir_limited(full_dir, dir_path, repo_roots, MAX_ENTRIES)
}

/// A cut-off listing still holds the first `limit` entries in sorted order,
/// not whichever ones the file system returned first.
fn list_dir_limited(full_dir: &Path, dir_path: &str, repo_roots: &[PathBuf], limit: usize) -> AppResult<DirListing> {
    // A max-heap of the smallest `limit` entries: memory stays bounded however
    // large the folder is, and nothing beyond the limit is checked for ignores.
    let mut kept: BinaryHeap<Candidate> = BinaryHeap::new();
    let mut total = 0usize;
    for entry in std::fs::read_dir(full_dir)? {
        let Ok(entry) = entry else {
            continue;
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        if name == ".git" {
            continue;
        }
        total += 1;
        let candidate = Candidate {
            is_file: !is_dir_following_links(&entry),
            folded: name.to_lowercase(),
            name,
        };
        if kept.len() < limit {
            kept.push(candidate);
        } else if kept.peek().is_some_and(|largest| candidate < *largest) {
            kept.pop();
            kept.push(candidate);
        }
    }
    let owner = deepest_repo(repo_roots, full_dir).and_then(|repo_root| {
        let repo = Repository::open(repo_root).ok()?;
        Some((repo, repo_root))
    });
    let entries = kept
        .into_sorted_vec()
        .into_iter()
        .map(|candidate| {
            let name = candidate.name;
            let is_dir = !candidate.is_file;
            let full_path = full_dir.join(&name);
            let is_repo = is_dir && repo_roots.iter().any(|repo_root| repo_root == &full_path);
            let ignored = match &owner {
                Some((repo, repo_root)) if !is_repo => {
                    is_ignored(repo, &relative_slash_path(repo_root, &full_path), is_dir)
                }
                _ => false,
            };
            let path = if dir_path.is_empty() { name.clone() } else { format!("{dir_path}/{name}") };
            DirEntry {
                name,
                path,
                is_dir,
                ignored,
                is_repo,
            }
        })
        .collect();
    Ok(DirListing {
        entries,
        truncated: total > limit,
    })
}

pub fn read_file(full_path: &Path, file_path: &str) -> AppResult<FileContent> {
    let size = std::fs::metadata(full_path)?.len();
    let mut file = FileContent {
        path: file_path.to_string(),
        content: String::new(),
        eol: Eol::Lf,
        binary: false,
        too_large: size > MAX_OPEN_BYTES,
        size,
    };
    if file.too_large {
        return Ok(file);
    }
    match bytes_to_text(std::fs::read(full_path)?) {
        Some(text) => {
            file.eol = Eol::detect(&text);
            file.content = normalize_eol(&text);
        }
        None => file.binary = true,
    }
    Ok(file)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(listing: &DirListing) -> Vec<&str> {
        listing.entries.iter().map(|entry| entry.name.as_str()).collect()
    }

    fn folder_with(dirs: &[&str], files: &[&str]) -> tempfile::TempDir {
        let dir = tempfile::TempDir::new().unwrap();
        for name in dirs {
            std::fs::create_dir_all(dir.path().join(name)).unwrap();
        }
        for name in files {
            std::fs::write(dir.path().join(name), "x").unwrap();
        }
        dir
    }

    fn listing(dir: &tempfile::TempDir, limit: usize) -> DirListing {
        list_dir_limited(dir.path(), "sub", &[], limit).unwrap()
    }

    #[test]
    fn cut_off_listings_keep_the_first_entries_in_sorted_order() {
        let dir = folder_with(&["zeta", "Alpha", ".git"], &["b.txt", "A.txt", "c.txt"]);
        let cut = listing(&dir, 3);
        assert_eq!(names(&cut), vec!["Alpha", "zeta", "A.txt"]);
        assert!(cut.truncated);
        assert!(cut.entries[0].is_dir && !cut.entries[2].is_dir);

        let all = listing(&dir, 10);
        assert_eq!(names(&all), vec!["Alpha", "zeta", "A.txt", "b.txt", "c.txt"]);
        assert!(!all.truncated);
        // .git neither shows nor counts toward the limit.
        assert!(!listing(&dir, 5).truncated);
    }

    #[test]
    fn a_folder_past_the_limit_still_lists_its_folders_first() {
        let files: Vec<String> = (0..=MAX_ENTRIES).map(|index| format!("f{index:05}")).collect();
        let dir = folder_with(&["zz-folder"], &[]);
        for name in &files {
            std::fs::write(dir.path().join(name), "").unwrap();
        }
        let result = list_dir(dir.path(), "", &[]).unwrap();
        assert!(result.truncated);
        assert_eq!(result.entries.len(), MAX_ENTRIES);
        assert_eq!(result.entries[0].name, "zz-folder");
        assert_eq!(result.entries[1].path, "f00000");
        assert_eq!(result.entries[MAX_ENTRIES - 1].name, files[MAX_ENTRIES - 2]);
    }

    #[cfg(unix)]
    #[test]
    fn linked_folders_count_as_folders() {
        let dir = folder_with(&["target-dir"], &["a.txt"]);
        std::os::unix::fs::symlink(dir.path().join("target-dir"), dir.path().join("link")).unwrap();
        let result = listing(&dir, 10);
        assert_eq!(names(&result), vec!["link", "target-dir", "a.txt"]);
        assert_eq!(result.entries[0].path, "sub/link");
    }
}
