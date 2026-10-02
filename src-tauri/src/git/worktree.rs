//! Linked work trees (`git worktree`): listed from `git worktree list
//! --porcelain`, changed through the git CLI.

use std::path::{Path, PathBuf};

use serde::Serialize;

use super::cli;
use super::repo::strip_trailing_slash;
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub path: String,
    /// Full commit id of its HEAD; None for a bare entry or an unborn branch.
    pub head: Option<String>,
    /// Short branch name; None when detached or bare.
    pub branch: Option<String>,
    pub detached: bool,
    pub bare: bool,
    pub locked: bool,
    pub lock_reason: Option<String>,
    /// Its folder is gone: `git worktree prune` removes it.
    pub prunable: bool,
    pub prunable_reason: Option<String>,
    /// The main work tree (listed first by git).
    pub is_main: bool,
    /// The work tree the list was read from.
    pub is_current: bool,
}

impl WorktreeInfo {
    fn new(path: &str, is_main: bool) -> WorktreeInfo {
        WorktreeInfo {
            path: path.to_string(),
            head: None,
            branch: None,
            detached: false,
            bare: false,
            locked: false,
            lock_reason: None,
            prunable: false,
            prunable_reason: None,
            is_main,
            is_current: false,
        }
    }
}

fn non_empty(text: &str) -> Option<String> {
    let trimmed = text.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

/// Parses `git worktree list --porcelain`: blank-line separated records of
/// `worktree <path>`, `HEAD <id>`, `branch <ref>`, `detached`, `bare`,
/// `locked [reason]` and `prunable [reason]`.
pub fn parse_porcelain(text: &str) -> Vec<WorktreeInfo> {
    let mut list: Vec<WorktreeInfo> = Vec::new();
    for line in text.lines() {
        if line.is_empty() {
            continue;
        }
        let (key, value) = line.split_once(' ').unwrap_or((line, ""));
        if key == "worktree" {
            let is_main = list.is_empty();
            list.push(WorktreeInfo::new(value, is_main));
            continue;
        }
        let Some(current) = list.last_mut() else {
            continue;
        };
        match key {
            "HEAD" => current.head = non_empty(value).filter(|id| id.chars().any(|c| c != '0')),
            "branch" => current.branch = non_empty(value.trim_start_matches("refs/heads/")),
            "detached" => current.detached = true,
            "bare" => current.bare = true,
            "locked" => {
                current.locked = true;
                current.lock_reason = non_empty(value);
            }
            "prunable" => {
                current.prunable = true;
                current.prunable_reason = non_empty(value);
            }
            _ => {}
        }
    }
    list
}

fn same_path(left: &Path, right: &Path) -> bool {
    let canonical = |path: &Path| path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    canonical(left) == canonical(right)
}

/// Every work tree of the repository at `repo_path`, the current one marked.
pub fn list(repo_path: &str) -> AppResult<Vec<WorktreeInfo>> {
    let output = cli::run(Path::new(repo_path), &["worktree", "list", "--porcelain"])?;
    let mut list = parse_porcelain(&output.stdout);
    for worktree in &mut list {
        worktree.is_current = same_path(Path::new(&worktree.path), Path::new(repo_path));
    }
    Ok(list)
}

/// Where a new work tree goes: an existing branch, or a new branch from `base_ref`.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WorktreeBranch {
    #[serde(rename_all = "camelCase")]
    Existing { branch_name: String },
    #[serde(rename_all = "camelCase")]
    New { branch_name: String, base_ref: String },
    /// Detached at `base_ref`.
    #[serde(rename_all = "camelCase")]
    Detached { base_ref: String },
}

fn reject_option(value: &str, what: &str) -> AppResult<()> {
    if value.starts_with('-') {
        return Err(AppError::invalid(format!("{what} cannot start with '-': {value}")));
    }
    Ok(())
}

fn require(value: &str, what: &str) -> AppResult<()> {
    if value.trim().is_empty() {
        return Err(AppError::invalid(format!("Enter a {what}")));
    }
    reject_option(value, what)
}

/// `git worktree add`; returns the new work tree's absolute path.
pub fn add(repo_path: &str, worktree_path: &str, branch: &WorktreeBranch) -> AppResult<String> {
    if worktree_path.trim().is_empty() {
        return Err(AppError::invalid("Enter a folder for the worktree"));
    }
    let target = PathBuf::from(worktree_path.trim());
    if !target.is_absolute() {
        return Err(AppError::invalid("The worktree folder must be an absolute path"));
    }
    if target.exists() && std::fs::read_dir(&target).map(|mut entries| entries.next().is_some()).unwrap_or(true) {
        return Err(AppError::invalid(format!("{} already exists and is not empty", target.display())));
    }
    let target_text = target.to_string_lossy().into_owned();
    let mut args: Vec<&str> = vec!["worktree", "add"];
    match branch {
        WorktreeBranch::Existing { branch_name } => {
            require(branch_name, "branch")?;
            args.extend(["--", &target_text, branch_name.as_str()]);
        }
        WorktreeBranch::New { branch_name, base_ref } => {
            require(branch_name, "branch name")?;
            require(base_ref, "base branch")?;
            args.extend(["-b", branch_name.as_str(), "--", &target_text, base_ref.as_str()]);
        }
        WorktreeBranch::Detached { base_ref } => {
            require(base_ref, "revision")?;
            args.extend(["--detach", "--", &target_text, base_ref.as_str()]);
        }
    }
    cli::run(Path::new(repo_path), &args)?;
    let created = target.canonicalize().unwrap_or(target);
    Ok(strip_trailing_slash(&created))
}

pub fn remove(repo_path: &str, worktree_path: &str, force: bool) -> AppResult<()> {
    require(worktree_path, "worktree")?;
    let mut args = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.extend(["--", worktree_path]);
    cli::run(Path::new(repo_path), &args)?;
    Ok(())
}

pub fn lock(repo_path: &str, worktree_path: &str, reason: Option<&str>) -> AppResult<()> {
    require(worktree_path, "worktree")?;
    let mut args = vec!["worktree", "lock"];
    if let Some(reason) = reason.filter(|reason| !reason.trim().is_empty()) {
        args.extend(["--reason", reason]);
    }
    args.extend(["--", worktree_path]);
    cli::run(Path::new(repo_path), &args)?;
    Ok(())
}

pub fn unlock(repo_path: &str, worktree_path: &str) -> AppResult<()> {
    require(worktree_path, "worktree")?;
    cli::run(Path::new(repo_path), &["worktree", "unlock", "--", worktree_path])?;
    Ok(())
}

/// `git worktree prune --verbose`; returns git's report (one line per pruned entry).
pub fn prune(repo_path: &str) -> AppResult<String> {
    let output = cli::run(Path::new(repo_path), &["worktree", "prune", "--verbose"])?;
    Ok(output.text())
}

/// Uncommitted or untracked changes in the work tree at `worktree_path`
/// (Remove then needs --force).
pub fn has_changes(worktree_path: &str) -> AppResult<bool> {
    let repo = git2::Repository::open(worktree_path)?;
    let mut options = git2::StatusOptions::new();
    options
        .include_untracked(true)
        .recurse_untracked_dirs(false)
        .exclude_submodules(true)
        .include_ignored(false);
    let dirty = !repo.statuses(Some(&mut options))?.is_empty();
    Ok(dirty)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::{git_in, TestRepo};

    #[test]
    fn parses_every_porcelain_field() {
        let text = "worktree /repo\nHEAD 1111111111111111111111111111111111111111\nbranch refs/heads/main\n\n\
            worktree /repo-feature\nHEAD 2222222222222222222222222222222222222222\nbranch refs/heads/feature/x\nlocked on a usb disk\n\n\
            worktree /repo-detached\nHEAD 3333333333333333333333333333333333333333\ndetached\nlocked\n\n\
            worktree /gone\nHEAD 4444444444444444444444444444444444444444\ndetached\nprunable gitdir file points to non-existent location\n";
        let list = parse_porcelain(text);
        assert_eq!(list.len(), 4);
        assert!(list[0].is_main);
        assert_eq!(list[0].branch.as_deref(), Some("main"));
        assert_eq!(list[1].branch.as_deref(), Some("feature/x"));
        assert!(!list[1].is_main);
        assert!(list[1].locked);
        assert_eq!(list[1].lock_reason.as_deref(), Some("on a usb disk"));
        assert!(list[2].detached && list[2].locked && list[2].lock_reason.is_none());
        assert_eq!(list[2].head.as_deref(), Some("3333333333333333333333333333333333333333"));
        assert!(list[3].prunable);
        assert_eq!(list[3].prunable_reason.as_deref(), Some("gitdir file points to non-existent location"));
        assert!(parse_porcelain("").is_empty());
        let bare = parse_porcelain("worktree /srv/repo.git\nbare\n");
        assert!(bare[0].bare && bare[0].head.is_none());
    }

    fn sibling(repo: &TestRepo, name: &str) -> String {
        repo.path.parent().expect("repo parent").join(name).to_string_lossy().into_owned()
    }

    #[test]
    fn adds_lists_locks_removes_and_prunes_worktrees() {
        let repo = TestRepo::new();
        repo.write("a.txt", "a\n");
        repo.commit_all("base");
        repo.branch("existing");
        let main = repo.path_string();

        let existing = add(&main, &sibling(&repo, "wt-existing"), &WorktreeBranch::Existing { branch_name: "existing".into() }).unwrap();
        let created = add(
            &main,
            &sibling(&repo, "wt-new"),
            &WorktreeBranch::New { branch_name: "feature".into(), base_ref: "main".into() },
        )
        .unwrap();
        assert!(Path::new(&existing).join("a.txt").exists());
        assert!(Path::new(&created).join(".git").is_file());

        let list = list(&main).unwrap();
        assert_eq!(list.len(), 3, "{list:?}");
        assert!(list[0].is_main && list[0].is_current);
        let feature = list.iter().find(|worktree| worktree.branch.as_deref() == Some("feature")).unwrap();
        assert!(same_path(Path::new(&feature.path), Path::new(&created)));
        assert!(!feature.is_current);
        // Listed from inside a linked work tree, that one is current.
        let from_linked = super::list(&created).unwrap();
        assert!(from_linked.iter().any(|worktree| worktree.is_current && worktree.branch.as_deref() == Some("feature")));

        // An existing, non-empty folder is refused before git runs.
        let err = add(&main, &main, &WorktreeBranch::Existing { branch_name: "existing".into() }).unwrap_err();
        assert!(err.to_string().contains("not empty"), "{err}");

        lock(&main, &existing, Some("keep it")).unwrap();
        let locked = super::list(&main).unwrap().into_iter().find(|worktree| worktree.branch.as_deref() == Some("existing")).unwrap();
        assert!(locked.locked);
        assert_eq!(locked.lock_reason.as_deref(), Some("keep it"));
        unlock(&main, &existing).unwrap();
        assert!(super::list(&main).unwrap().iter().all(|worktree| !worktree.locked));

        // A dirty work tree needs --force.
        std::fs::write(Path::new(&created).join("dirty.txt"), "x\n").unwrap();
        assert!(has_changes(&created).unwrap());
        assert!(!has_changes(&existing).unwrap());
        assert!(remove(&main, &created, false).is_err());
        remove(&main, &created, true).unwrap();
        assert!(!Path::new(&created).exists());

        // A deleted folder becomes prunable, then prune drops it.
        std::fs::remove_dir_all(&existing).unwrap();
        let stale = super::list(&main).unwrap();
        assert!(stale.iter().any(|worktree| worktree.prunable), "{stale:?}");
        prune(&main).unwrap();
        assert_eq!(super::list(&main).unwrap().len(), 1);
        git_in(&repo.path, &["branch", "-D", "feature"]);
    }

    #[test]
    fn a_worktree_folder_opens_as_a_repository() {
        let repo = TestRepo::new();
        repo.write("a.txt", "a\n");
        repo.commit_all("base");
        let worktree_path = add(
            &repo.path_string(),
            &sibling(&repo, "linked"),
            &WorktreeBranch::New { branch_name: "linked".into(), base_ref: "HEAD".into() },
        )
        .unwrap();

        let workspace = crate::git::workspace::open(&worktree_path).unwrap();
        assert_eq!(workspace.repos.len(), 1, "{:?}", workspace.repos);
        assert_eq!(workspace.repos[0].root, worktree_path);
        assert!(workspace.repos[0].worktree);
        // A folder below it finds the enclosing work tree.
        std::fs::create_dir_all(Path::new(&worktree_path).join("sub")).unwrap();
        let below = crate::git::workspace::open(&format!("{worktree_path}/sub")).unwrap();
        assert_eq!(below.repos[0].root, worktree_path);

        std::fs::write(Path::new(&worktree_path).join("a.txt"), "changed\n").unwrap();
        let status = crate::git::status::read(&crate::git::repo::open(&worktree_path).unwrap()).unwrap();
        assert_eq!(status.head.branch.as_deref(), Some("linked"));
        assert_eq!(status.files.len(), 1);
        assert_eq!(status.files[0].path, "a.txt");
        // The main repository does not see the linked work tree's edits.
        assert!(crate::git::status::read(&repo.open()).unwrap().files.is_empty());
    }
}
