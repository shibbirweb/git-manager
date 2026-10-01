//! Detects an in-progress merge / rebase / cherry-pick / revert and derives
//! human-friendly labels for the two sides of a conflict.

use git2::{BranchType, Oid, Repository, RepositoryState};
use serde::Serialize;

use super::repo::{read_git_file, short_id};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum OpKind {
    None,
    Merge,
    Rebase,
    CherryPick,
    Revert,
    Other,
}

impl OpKind {
    /// The `git <subcommand>` that owns `--continue` / `--abort`.
    pub fn subcommand(self) -> Option<&'static str> {
        match self {
            OpKind::Merge => Some("merge"),
            OpKind::Rebase => Some("rebase"),
            OpKind::CherryPick => Some("cherry-pick"),
            OpKind::Revert => Some("revert"),
            OpKind::None | OpKind::Other => None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpState {
    pub kind: OpKind,
    /// Short description for the banner, e.g. "Merging feature/login into main".
    pub description: String,
    pub ours_label: String,
    pub theirs_label: String,
}

fn current_branch(repo: &Repository) -> String {
    match repo.head() {
        Ok(head) if head.is_branch() => head.shorthand().unwrap_or("HEAD").to_string(),
        Ok(head) => head.target().map(short_id).unwrap_or_else(|| "HEAD".to_string()),
        Err(_) => "HEAD".to_string(),
    }
}

/// Prefers a local branch name, then a remote one, then the short id.
fn name_for_commit(repo: &Repository, oid: Oid) -> String {
    for branch_type in [BranchType::Local, BranchType::Remote] {
        if let Ok(branches) = repo.branches(Some(branch_type)) {
            for (branch, _) in branches.flatten() {
                if branch.get().target() == Some(oid) {
                    if let Ok(Some(name)) = branch.name() {
                        return name.to_string();
                    }
                }
            }
        }
    }
    short_id(oid)
}

fn commit_title(repo: &Repository, oid: Oid) -> String {
    let summary = repo
        .find_commit(oid)
        .ok()
        .and_then(|commit| commit.summary().ok().flatten().map(str::to_string))
        .unwrap_or_default();
    format!("{} {}", short_id(oid), summary).trim().to_string()
}

fn head_file_oid(repo: &Repository, name: &str) -> Option<Oid> {
    read_git_file(repo, name)
        .and_then(|text| text.lines().next().map(str::to_string))
        .and_then(|line| Oid::from_str(line.trim()).ok())
}

/// Extracts `x` from "Merge branch 'x'" or "Merge remote-tracking branch 'x'".
fn merge_msg_branch(repo: &Repository) -> Option<String> {
    let message = read_git_file(repo, "MERGE_MSG")?;
    let first = message.lines().next()?;
    let start = first.find('\'')? + 1;
    let end = first[start..].find('\'')? + start;
    Some(first[start..end].to_string())
}

pub fn read(repo: &Repository) -> OpState {
    let ours = current_branch(repo);
    match repo.state() {
        RepositoryState::Clean => OpState {
            kind: OpKind::None,
            description: String::new(),
            ours_label: format!("Yours ({ours})"),
            theirs_label: "Theirs".to_string(),
        },
        RepositoryState::Merge => {
            let theirs = merge_msg_branch(repo)
                .or_else(|| head_file_oid(repo, "MERGE_HEAD").map(|oid| name_for_commit(repo, oid)))
                .unwrap_or_else(|| "MERGE_HEAD".to_string());
            OpState {
                kind: OpKind::Merge,
                description: format!("Merging {theirs} into {ours}"),
                ours_label: format!("Yours ({ours})"),
                theirs_label: format!("Theirs ({theirs})"),
            }
        }
        RepositoryState::Rebase | RepositoryState::RebaseInteractive | RepositoryState::RebaseMerge => {
            // During a rebase HEAD is the new base and the replayed commit is "theirs".
            let branch = read_git_file(repo, "rebase-merge/head-name")
                .or_else(|| read_git_file(repo, "rebase-apply/head-name"))
                .map(|name| name.trim_start_matches("refs/heads/").to_string())
                .unwrap_or_else(|| "branch".to_string());
            let onto = head_file_oid(repo, "rebase-merge/onto")
                .or_else(|| head_file_oid(repo, "rebase-apply/onto"))
                .map(|oid| name_for_commit(repo, oid))
                .unwrap_or_else(|| "upstream".to_string());
            let replayed = head_file_oid(repo, "REBASE_HEAD")
                .map(|oid| commit_title(repo, oid))
                .unwrap_or_else(|| "commit".to_string());
            OpState {
                kind: OpKind::Rebase,
                description: format!("Rebasing {branch} onto {onto}"),
                ours_label: format!("Upstream ({onto})"),
                theirs_label: format!("Your commit ({replayed})"),
            }
        }
        RepositoryState::CherryPick | RepositoryState::CherryPickSequence => {
            let picked = head_file_oid(repo, "CHERRY_PICK_HEAD")
                .map(|oid| commit_title(repo, oid))
                .unwrap_or_else(|| "commit".to_string());
            OpState {
                kind: OpKind::CherryPick,
                description: format!("Cherry-picking {picked} onto {ours}"),
                ours_label: format!("Yours ({ours})"),
                theirs_label: format!("Cherry-pick ({picked})"),
            }
        }
        RepositoryState::Revert | RepositoryState::RevertSequence => {
            let reverted = head_file_oid(repo, "REVERT_HEAD")
                .map(|oid| commit_title(repo, oid))
                .unwrap_or_else(|| "commit".to_string());
            OpState {
                kind: OpKind::Revert,
                description: format!("Reverting {reverted} on {ours}"),
                ours_label: format!("Yours ({ours})"),
                theirs_label: format!("Revert ({reverted})"),
            }
        }
        _ => OpState {
            kind: OpKind::Other,
            description: "A git operation is in progress".to_string(),
            ours_label: format!("Yours ({ours})"),
            theirs_label: "Theirs".to_string(),
        },
    }
}
