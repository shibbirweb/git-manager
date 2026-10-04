use std::hash::{DefaultHasher, Hash, Hasher};

use git2::{Repository, Status, StatusOptions};
use serde::Serialize;

use super::bisect;
use super::opstate::{self, OpState};
use super::repo::{path_text, short_id};
use super::submodule::{self, SubmoduleChange};
use crate::error::AppResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ChangeKind {
    Added,
    Modified,
    Deleted,
    Renamed,
    Typechange,
    Untracked,
}

#[derive(Debug, Clone, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    pub path: String,
    /// Previous path when the staged change is a rename.
    pub orig_path: Option<String>,
    pub staged: Option<ChangeKind>,
    pub unstaged: Option<ChangeKind>,
    pub conflicted: bool,
    /// Set for a submodule: what changed in it, like `git status`.
    pub submodule: Option<SubmoduleChange>,
}

#[derive(Debug, Clone, Hash, Serialize)]
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

#[derive(Debug, Clone, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoStatus {
    pub head: HeadInfo,
    pub op: OpState,
    /// While a `git bisect` runs: a fingerprint of its log, so every mark changes the status.
    pub bisect: Option<String>,
    pub files: Vec<FileStatus>,
}

/// A fingerprint of everything a status shows: the same hash means the
/// frontend can keep the status it has (and every view depending on it).
pub fn hash(status: &RepoStatus) -> String {
    let mut hasher = DefaultHasher::new();
    status.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
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

/// From this many paths on, `pathspecs_for` folds them into folders: git
/// matches every path against every pathspec, so 50k file pathspecs take a
/// minute while the few folders holding them take milliseconds.
pub const FOLD_PATHS_FROM: usize = 200;

/// Every path `git status` reports in `repo`, nested repositories as `dir/`.
pub fn changed_paths(repo: &Repository) -> AppResult<Vec<String>> {
    let mut options = StatusOptions::new();
    options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .renames_head_to_index(true)
        .include_ignored(false);
    let statuses = repo.statuses(Some(&mut options))?;
    let mut paths = Vec::with_capacity(statuses.len());
    for entry in statuses.iter() {
        paths.push(path_text(entry.path_bytes()));
        if let Some(old) = entry.head_to_index().and_then(|delta| delta.old_file().path_bytes().map(path_text)) {
            paths.push(old);
        }
    }
    Ok(paths)
}

/// Pathspecs covering exactly `selected` among `changed` (every path status
/// reports): a folder stands for everything below it when every changed path
/// there is selected, so it touches nothing else; the rest stay single paths.
pub fn fold_pathspecs(selected: &[String], changed: &[String]) -> Vec<String> {
    use std::collections::HashSet;
    let chosen: HashSet<&str> = selected.iter().map(String::as_str).collect();
    // Folders holding a changed path that is not selected cannot stand for their contents.
    let mut blocked: HashSet<&str> = HashSet::new();
    for path in changed.iter().map(String::as_str).filter(|path| !chosen.contains(path)) {
        for (index, _) in path.trim_end_matches('/').match_indices('/') {
            blocked.insert(&path[..=index]);
        }
    }
    let mut folded: Vec<String> = Vec::new();
    let mut seen: HashSet<&str> = HashSet::new();
    for path in selected {
        let folder = path
            .trim_end_matches('/')
            .match_indices('/')
            .map(|(index, _)| &path[..=index])
            .find(|folder| !blocked.contains(folder));
        let spec = folder.unwrap_or(path.as_str());
        if seen.insert(spec) {
            folded.push(spec.to_string());
        }
    }
    folded
}

/// The pathspecs to hand git for `selected` in `repo`: folded into folders when there are many.
pub fn pathspecs_for(repo: &Repository, selected: &[String]) -> AppResult<Vec<String>> {
    if selected.len() < FOLD_PATHS_FROM {
        return Ok(selected.to_vec());
    }
    Ok(fold_pathspecs(selected, &changed_paths(repo)?))
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
    // Submodules get one entry each from a cheaper pass below, so the walk
    // never scans their work trees.
    let with_submodules = submodule::has_submodules(repo);
    options.exclude_submodules(with_submodules);

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
                submodule: None,
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
            submodule: None,
        });
    }
    if with_submodules {
        let (entries, submodule_paths) = submodule::status_entries(repo);
        files.retain(|file| file.conflicted || !submodule_paths.contains(&file.path));
        files.extend(entries);
    }
    files.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(RepoStatus {
        head: head_info(repo),
        op: opstate::read(repo),
        bisect: bisect::fingerprint(repo),
        files,
    })
}

#[cfg(test)]
mod tests {
    use super::{changed_paths, fold_pathspecs, pathspecs_for, FOLD_PATHS_FROM};
    use crate::test_support::{git_in, TestRepo};

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn folds_folders_whose_changed_paths_are_all_selected() {
        let changed = strings(&["a.txt", "deps/x/1.js", "deps/x/2.js", "deps/y/3.js", "src/main.rs", "src/lib.rs"]);
        let selected = strings(&["a.txt", "deps/x/1.js", "deps/x/2.js", "deps/y/3.js", "src/main.rs"]);
        // src/lib.rs is not selected, so src/ cannot stand for src/main.rs.
        assert_eq!(fold_pathspecs(&selected, &changed), strings(&["a.txt", "deps/", "src/main.rs"]));
        // A folder deeper down still folds when its parent cannot.
        let changed = strings(&["deps/x/1.js", "deps/x/2.js", "deps/keep.js"]);
        assert_eq!(fold_pathspecs(&strings(&["deps/x/1.js", "deps/x/2.js"]), &changed), strings(&["deps/x/"]));
        // A nested repository reported as `dir/` blocks its parents too.
        let changed = strings(&["deps/a.js", "deps/nested/"]);
        assert_eq!(fold_pathspecs(&strings(&["deps/a.js"]), &changed), strings(&["deps/a.js"]));
        assert!(fold_pathspecs(&[], &changed).is_empty());
    }

    #[test]
    fn many_paths_fold_without_touching_other_changes() {
        let repo = TestRepo::new();
        repo.write("keep/conflict.txt", "base\n");
        repo.write("other.txt", "base\n");
        repo.commit_all("base");
        let many: Vec<String> = (0..FOLD_PATHS_FROM).map(|index| format!("deps/pkg{}/file{index}.js", index % 7)).collect();
        for file_path in &many {
            repo.write(file_path, "x");
        }
        repo.write("other.txt", "changed\n");
        repo.write("keep/new.txt", "new\n");
        git_in(&repo.path.join("keep"), &["init", "-q", "nested"]);
        repo.write("keep/nested/inner.txt", "inner\n");
        let changed = changed_paths(&repo.open()).unwrap();
        assert!(changed.contains(&"keep/nested/".to_string()), "{changed:?}");

        let mut selected = many.clone();
        selected.push("keep/new.txt".to_string());
        let specs = pathspecs_for(&repo.open(), &selected).unwrap();
        // keep/ holds a nested repository, so its file stays single.
        assert_eq!(specs, strings(&["deps/", "keep/new.txt"]));
        let below = pathspecs_for(&repo.open(), &selected[..10]).unwrap();
        assert_eq!(below.len(), 10, "few paths are passed as they are");
    }
}
