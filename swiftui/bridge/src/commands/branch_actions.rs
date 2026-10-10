//! Compare with Branch for the MCP tool git_compare_branches (src-tauri/src/commands/branch_actions.rs
//! `compare_branches`): the same comparison, repeated here because that file is a Tauri one the bridge does not
//! build. Async like the Tauri command, so src-tauri's tool file calls it unchanged.

use git2::{DiffFindOptions, Repository, Sort};
use serde::Serialize;

use crate::error::AppResult;
use crate::git::log::{delta_status, summarize, ChangedFile, CommitSummary};
use crate::git::repo::{self as git_repo, path_text, resolve_commit};

const MAX_COMPARED: usize = 1000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchComparison {
    pub branch_id: String,
    pub base_id: String,
    /// In `branch`, not in `base`; newest first.
    pub branch_only: Vec<CommitSummary>,
    /// In `base`, not in `branch`; newest first.
    pub base_only: Vec<CommitSummary>,
    pub files: Vec<ChangedFile>,
    pub truncated: bool,
}

pub async fn compare_branches(repo_path: String, branch_name: String, base_name: String)
    -> AppResult<BranchComparison> {
    compare(&git_repo::open(&repo_path)?, &branch_name, &base_name)
}

fn compare(repo: &Repository, branch_name: &str, base_name: &str) -> AppResult<BranchComparison> {
    let branch = resolve_commit(repo, branch_name)?;
    let base = resolve_commit(repo, base_name)?;
    let mut truncated = false;
    let branch_only = commits_between(repo, branch.id(), base.id(), &mut truncated)?;
    let base_only = commits_between(repo, base.id(), branch.id(), &mut truncated)?;
    let mut diff = repo.diff_tree_to_tree(Some(&base.tree()?), Some(&branch.tree()?), None)?;
    diff.find_similar(Some(DiffFindOptions::new().renames(true)))?;
    Ok(BranchComparison {
        branch_id: branch.id().to_string(),
        base_id: base.id().to_string(),
        branch_only,
        base_only,
        files: changed_files(&diff),
        truncated,
    })
}

fn commits_between(
    repo: &Repository, include: git2::Oid, exclude: git2::Oid, truncated: &mut bool,
) -> AppResult<Vec<CommitSummary>> {
    let mut walk = repo.revwalk()?;
    walk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;
    walk.push(include)?;
    walk.hide(exclude)?;
    let mut commits = Vec::new();
    for oid in walk {
        if commits.len() == MAX_COMPARED {
            *truncated = true;
            break;
        }
        commits.push(summarize(&repo.find_commit(oid?)?, Vec::new()));
    }
    Ok(commits)
}

fn changed_files(diff: &git2::Diff) -> Vec<ChangedFile> {
    diff.deltas()
        .map(|delta| {
            let new_path = delta.new_file().path_bytes().map(path_text);
            let old_path = delta.old_file().path_bytes().map(path_text);
            let path = new_path.clone().or_else(|| old_path.clone()).unwrap_or_default();
            let orig_path = if delta.status() == git2::Delta::Renamed { old_path } else { None };
            let status = match delta.status() {
                git2::Delta::Untracked => "added",
                other => delta_status(other),
            };
            ChangedFile { path, orig_path, status: status.to_string() }
        })
        .collect()
}
