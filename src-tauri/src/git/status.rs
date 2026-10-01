use git2::{Repository, Status, StatusOptions};
use serde::Serialize;

use super::opstate::{self, OpState};
use super::repo::{path_text, short_id};
use crate::error::AppResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ChangeKind {
    Added,
    Modified,
    Deleted,
    Renamed,
    Typechange,
    Untracked,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    pub path: String,
    /// Previous path when the staged change is a rename.
    pub orig_path: Option<String>,
    pub staged: Option<ChangeKind>,
    pub unstaged: Option<ChangeKind>,
    pub conflicted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeadInfo {
    /// Branch name, or None when HEAD is detached.
    pub branch: Option<String>,
    pub short_id: Option<String>,
    /// True for a fresh repository with no commits yet.
    pub unborn: bool,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoStatus {
    pub head: HeadInfo,
    pub op: OpState,
    pub files: Vec<FileStatus>,
}

fn staged_kind(status: Status) -> Option<ChangeKind> {
    if status.contains(Status::INDEX_NEW) {
        Some(ChangeKind::Added)
    } else if status.contains(Status::INDEX_RENAMED) {
        Some(ChangeKind::Renamed)
    } else if status.contains(Status::INDEX_DELETED) {
        Some(ChangeKind::Deleted)
    } else if status.contains(Status::INDEX_TYPECHANGE) {
        Some(ChangeKind::Typechange)
    } else if status.contains(Status::INDEX_MODIFIED) {
        Some(ChangeKind::Modified)
    } else {
        None
    }
}

fn unstaged_kind(status: Status) -> Option<ChangeKind> {
    if status.contains(Status::WT_NEW) {
        Some(ChangeKind::Untracked)
    } else if status.contains(Status::WT_RENAMED) {
        Some(ChangeKind::Renamed)
    } else if status.contains(Status::WT_DELETED) {
        Some(ChangeKind::Deleted)
    } else if status.contains(Status::WT_TYPECHANGE) {
        Some(ChangeKind::Typechange)
    } else if status.contains(Status::WT_MODIFIED) {
        Some(ChangeKind::Modified)
    } else {
        None
    }
}

pub fn head_info(repo: &Repository) -> HeadInfo {
    let unborn = repo.head().is_err() && repo.find_reference("HEAD").is_ok();
    let Ok(head) = repo.head() else {
        // Unborn HEAD still names the branch it will create.
        let branch = repo
            .find_reference("HEAD")
            .ok()
            .and_then(|reference| reference.symbolic_target().ok().flatten().map(str::to_string))
            .map(|target| target.trim_start_matches("refs/heads/").to_string());
        return HeadInfo {
            branch,
            short_id: None,
            unborn,
            upstream: None,
            ahead: 0,
            behind: 0,
        };
    };

    let short = head.target().map(short_id);
    if !head.is_branch() {
        return HeadInfo {
            branch: None,
            short_id: short,
            unborn: false,
            upstream: None,
            ahead: 0,
            behind: 0,
        };
    }

    let branch_name = head.shorthand().ok().map(str::to_string);
    let mut upstream = None;
    let (mut ahead, mut behind) = (0, 0);
    if let Some(name) = &branch_name {
        if let Ok(branch) = repo.find_branch(name, git2::BranchType::Local) {
            if let Ok(upstream_branch) = branch.upstream() {
                upstream = upstream_branch.name().ok().flatten().map(str::to_string);
                if let (Some(local), Some(remote)) = (head.target(), upstream_branch.get().target()) {
                    if let Ok((a, b)) = repo.graph_ahead_behind(local, remote) {
                        ahead = a;
                        behind = b;
                    }
                }
            }
        }
    }

    HeadInfo {
        branch: branch_name,
        short_id: short,
        unborn: false,
        upstream,
        ahead,
        behind,
    }
}

fn is_nested_repo(workdir: Option<&std::path::Path>, path: &str) -> bool {
    workdir.map(|root| root.join(path).join(".git").exists()).unwrap_or(false)
}

pub fn read(repo: &Repository) -> AppResult<RepoStatus> {
    let mut options = StatusOptions::new();
    options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .renames_head_to_index(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut options))?;
    let workdir = repo.workdir().map(std::path::Path::to_path_buf);
    let mut files = Vec::with_capacity(statuses.len());
    for entry in statuses.iter() {
        let status = entry.status();
        let path = path_text(entry.path_bytes());
        // A nested repository shows up as an untracked "dir/"; it has its own status.
        if status.contains(Status::WT_NEW) && path.ends_with('/') && is_nested_repo(workdir.as_deref(), &path) {
            continue;
        }
        if status.contains(Status::CONFLICTED) {
            files.push(FileStatus {
                path,
                orig_path: None,
                staged: None,
                unstaged: None,
                conflicted: true,
            });
            continue;
        }
        let staged = staged_kind(status);
        let unstaged = unstaged_kind(status);
        if staged.is_none() && unstaged.is_none() {
            continue;
        }
        // StatusEntry::path names the old side of a rename, so take both from the delta.
        let (path, orig_path) = match entry.head_to_index() {
            Some(delta) if staged == Some(ChangeKind::Renamed) => (
                delta.new_file().path_bytes().map(path_text).unwrap_or(path),
                delta.old_file().path_bytes().map(path_text),
            ),
            _ => (path, None),
        };
        files.push(FileStatus {
            path,
            orig_path,
            staged,
            unstaged,
            conflicted: false,
        });
    }
    files.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(RepoStatus {
        head: head_info(repo),
        op: opstate::read(repo),
        files,
    })
}
