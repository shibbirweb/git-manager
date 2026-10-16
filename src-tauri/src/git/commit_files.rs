//! The files a commit changed: against each parent, and for a merge the ones that differ from every parent.
use std::collections::HashSet;

use git2::{Commit, Delta, DiffFindOptions, Repository, Tree};
use serde::Serialize;

use super::repo::path_text;
use crate::error::AppResult;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    pub path: String,
    pub orig_path: Option<String>,
    pub status: String,
}

pub fn delta_status(delta: Delta) -> &'static str {
    match delta {
        Delta::Added => "added",
        Delta::Deleted => "deleted",
        Delta::Renamed => "renamed",
        Delta::Copied => "copied",
        Delta::Typechange => "typechange",
        _ => "modified",
    }
}

pub fn changed_files(repo: &Repository, parent: Option<&Commit>, tree: &Tree) -> AppResult<Vec<ChangedFile>> {
    let parent_tree = parent.and_then(|parent| parent.tree().ok());
    let mut diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(tree), None)?;
    diff.find_similar(Some(DiffFindOptions::new().renames(true)))?;

    let mut files = Vec::new();
    for delta in diff.deltas() {
        let new_path = delta.new_file().path_bytes().map(path_text);
        let old_path = delta.old_file().path_bytes().map(path_text);
        let path = new_path.clone().or_else(|| old_path.clone()).unwrap_or_default();
        let orig_path = if delta.status() == Delta::Renamed { old_path } else { None };
        files.push(ChangedFile {
            path,
            orig_path,
            status: delta_status(delta.status()).to_string(),
        });
    }
    Ok(files)
}

/// The files of `first` that also changed against every later parent, like `git diff-tree -c --name-only`.
pub fn merged_files(first: &[ChangedFile], later: &[Vec<ChangedFile>]) -> Vec<ChangedFile> {
    if later.is_empty() {
        return Vec::new();
    }
    let later_paths: Vec<HashSet<&str>> =
        later.iter().map(|files| files.iter().map(|file| file.path.as_str()).collect()).collect();
    first
        .iter()
        .filter(|file| later_paths.iter().all(|paths| paths.contains(file.path.as_str())))
        .cloned()
        .collect()
}
