//! Submodules: listed with git2 from `.gitmodules`, the index and HEAD, shown in
//! their parent's status as one entry each (like `git status`), and changed
//! through the git CLI.

use std::path::{Component, Path};

use git2::{Repository, SubmoduleIgnore, SubmoduleStatus};
use serde::Serialize;

use super::cli;
use super::repo::{path_text, short_id, RepoInfo};
use super::status::{ChangeKind, FileStatus};
use crate::error::{AppError, AppResult};

/// What `git status` says about a submodule in its parent.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmoduleChange {
    /// Its checked-out commit differs from the one the parent records.
    pub new_commits: bool,
    /// Tracked files inside it are changed.
    pub modified_content: bool,
    /// It holds untracked files.
    pub untracked_content: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmoduleInfo {
    pub name: String,
    /// Relative to the parent repository's root, `/`-separated.
    pub path: String,
    pub url: Option<String>,
    /// The branch `--remote` follows (`submodule.<name>.branch`).
    pub branch: Option<String>,
    /// Cloned and checked out (`git submodule update --init` has run).
    pub initialized: bool,
    /// The commit the parent records (index), short.
    pub recorded_id: Option<String>,
    /// The commit checked out inside it, short.
    pub checked_out_id: Option<String>,
}

const GITLINK_MODE: u32 = 0o160000;

/// Whether the repository has (or had, in its index) any submodule, checked
/// cheaply so ordinary repositories skip the submodule pass of their status.
pub fn has_submodules(repo: &Repository) -> bool {
    let has_gitmodules = repo.workdir().map(|root| root.join(".gitmodules").is_file()).unwrap_or(false);
    has_gitmodules
        || repo
            .index()
            .map(|index| index.iter().any(|entry| entry.mode == GITLINK_MODE))
            .unwrap_or(false)
}

fn slash_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

/// Changes inside an initialized submodule, without recursing into its own
/// submodules or untracked folders (one entry per untracked folder is enough).
fn content_changes(submodule_repo: &Repository, include_untracked: bool) -> (bool, bool) {
    let mut options = git2::StatusOptions::new();
    options
        .include_untracked(include_untracked)
        .recurse_untracked_dirs(false)
        .exclude_submodules(true)
        .include_ignored(false);
    let Ok(statuses) = submodule_repo.statuses(Some(&mut options)) else {
        return (false, false);
    };
    let mut modified = false;
    let mut untracked = false;
    for entry in statuses.iter() {
        let status = entry.status();
        if status.is_wt_new() {
            untracked = true;
        } else if !status.is_ignored() {
            modified = true;
        }
        if modified && (untracked || !include_untracked) {
            break;
        }
    }
    (modified, untracked)
}

/// The status entry of one submodule, or None when it has no change. Honors
/// `submodule.<name>.ignore` like `git status`.
fn status_entry(repo: &Repository, name: &str, path: String, ignore: SubmoduleIgnore) -> Option<FileStatus> {
    if ignore == SubmoduleIgnore::All {
        return None;
    }
    // Commit-level comparison only; content is checked below without recursion.
    let status = repo.submodule_status(name, SubmoduleIgnore::Dirty).ok()?;
    let staged = if status.contains(SubmoduleStatus::INDEX_ADDED) {
        Some(ChangeKind::Added)
    } else if status.contains(SubmoduleStatus::INDEX_DELETED) {
        Some(ChangeKind::Deleted)
    } else if status.contains(SubmoduleStatus::INDEX_MODIFIED) {
        Some(ChangeKind::Modified)
    } else {
        None
    };
    let mut change = SubmoduleChange {
        new_commits: status.contains(SubmoduleStatus::WD_MODIFIED),
        ..SubmoduleChange::default()
    };
    let initialized = status.contains(SubmoduleStatus::IN_WD) && !status.contains(SubmoduleStatus::WD_UNINITIALIZED);
    if initialized && ignore != SubmoduleIgnore::Dirty {
        if let Some(submodule_repo) = repo.workdir().and_then(|root| Repository::open(root.join(&path)).ok()) {
            let (modified, untracked) = content_changes(&submodule_repo, ignore != SubmoduleIgnore::Untracked);
            change.modified_content = modified;
            change.untracked_content = untracked;
        }
    }
    let unstaged = if change.new_commits || change.modified_content || change.untracked_content {
        Some(ChangeKind::Modified)
    } else if status.contains(SubmoduleStatus::WD_DELETED) && staged != Some(ChangeKind::Deleted) {
        Some(ChangeKind::Deleted)
    } else {
        None
    };
    if staged.is_none() && unstaged.is_none() {
        return None;
    }
    Some(FileStatus {
        path,
        orig_path: None,
        staged,
        unstaged,
        conflicted: false,
        submodule: Some(change),
    })
}

fn ignore_from_text(value: &str) -> Option<SubmoduleIgnore> {
    match value.trim() {
        "none" => Some(SubmoduleIgnore::None),
        "untracked" => Some(SubmoduleIgnore::Untracked),
        "dirty" => Some(SubmoduleIgnore::Dirty),
        "all" => Some(SubmoduleIgnore::All),
        _ => None,
    }
}

/// One status entry per changed submodule, plus every submodule path (changed
/// or not) so the caller can drop what the plain status walk said about them.
pub fn status_entries(repo: &Repository) -> (Vec<FileStatus>, Vec<String>) {
    let Ok(submodules) = repo.submodules() else {
        return (Vec::new(), Vec::new());
    };
    let config = repo.config().ok();
    let mut entries = Vec::new();
    let mut paths = Vec::with_capacity(submodules.len());
    for submodule in &submodules {
        let path = slash_path(submodule.path());
        paths.push(path.clone());
        let name = path_text(submodule.name_bytes());
        // The repository's config overrides .gitmodules, like git.
        let configured = config
            .as_ref()
            .and_then(|config| config.get_string(&format!("submodule.{name}.ignore")).ok())
            .and_then(|value| ignore_from_text(&value));
        let ignore = configured.unwrap_or_else(|| submodule.ignore_rule());
        if let Some(entry) = status_entry(repo, &name, path, ignore) {
            entries.push(entry);
        }
    }
    (entries, paths)
}

/// The submodules of the repository at `repo_path` (not recursive).
pub fn list(repo_path: &str) -> AppResult<Vec<SubmoduleInfo>> {
    let repo = Repository::open(repo_path)?;
    let mut list = Vec::new();
    for submodule in repo.submodules()? {
        let path = slash_path(submodule.path());
        let initialized = repo
            .workdir()
            .map(|root| Repository::open(root.join(&path)).is_ok())
            .unwrap_or(false);
        list.push(SubmoduleInfo {
            name: path_text(submodule.name_bytes()),
            url: submodule.url().ok().flatten().map(str::to_string),
            branch: submodule.branch().ok().flatten().map(str::to_string),
            initialized,
            recorded_id: submodule.index_id().or(submodule.head_id()).map(short_id),
            checked_out_id: submodule.workdir_id().map(short_id),
            path,
        });
    }
    list.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(list)
}

/// Marks the repositories that are submodules of the repository enclosing them.
/// `repos` is sorted by root, so every parent comes before its children.
pub fn mark_submodules(repos: &mut [RepoInfo]) {
    for index in 0..repos.len() {
        let root = Path::new(&repos[index].root).to_path_buf();
        let parent = repos[..index]
            .iter()
            .filter(|candidate| root.starts_with(&candidate.root) && root != Path::new(&candidate.root))
            .max_by_key(|candidate| candidate.root.len())
            .map(|candidate| candidate.root.clone());
        let Some(parent_root) = parent else {
            continue;
        };
        if !Path::new(&parent_root).join(".gitmodules").is_file() {
            continue;
        }
        let Ok(relative) = root.strip_prefix(&parent_root) else {
            continue;
        };
        let relative = slash_path(relative);
        repos[index].submodule = Repository::open(&parent_root)
            .map(|parent_repo| parent_repo.find_submodule(&relative).is_ok())
            .unwrap_or(false);
    }
}

/// A submodule path from the UI: relative, inside the work tree, not an option.
fn checked_path(submodule_path: &str) -> AppResult<String> {
    let trimmed = submodule_path.trim().trim_end_matches('/');
    let relative = Path::new(trimmed);
    let escapes = relative.is_absolute()
        || relative
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::Prefix(_)));
    if trimmed.is_empty() || escapes || trimmed.starts_with('-') {
        return Err(AppError::invalid(format!("Invalid submodule path: {submodule_path}")));
    }
    Ok(trimmed.to_string())
}

/// Extra environment for every submodule command; tests allow file:// URLs with it.
pub type Envs<'a> = &'a [(&'a str, &'a str)];

fn run(repo_path: &str, args: &[&str], envs: Envs) -> AppResult<cli::GitOutput> {
    cli::run_with_env(Path::new(repo_path), args, envs)
}

/// `git submodule init` for every submodule, or only `submodule_paths`.
pub fn init(repo_path: &str, submodule_paths: &[String], envs: Envs) -> AppResult<String> {
    let mut args = vec!["submodule", "init", "--"];
    let checked: Vec<String> = submodule_paths.iter().map(|path| checked_path(path)).collect::<AppResult<_>>()?;
    args.extend(checked.iter().map(String::as_str));
    Ok(run(repo_path, &args, envs)?.text())
}

/// `git submodule update --init --recursive [--remote]`, streaming git's progress.
pub fn update(
    repo_path: &str,
    remote: bool,
    submodule_paths: &[String],
    envs: Envs,
    on_progress: impl FnMut(&str),
) -> AppResult<String> {
    let mut args = vec!["submodule", "update", "--init", "--recursive", "--progress"];
    if remote {
        args.push("--remote");
    }
    args.push("--");
    let checked: Vec<String> = submodule_paths.iter().map(|path| checked_path(path)).collect::<AppResult<_>>()?;
    args.extend(checked.iter().map(String::as_str));
    Ok(cli::run_streaming_with_env(Path::new(repo_path), &args, envs, on_progress)?.text())
}

/// `git submodule sync --recursive`: copies the URLs from `.gitmodules` into the config.
pub fn sync(repo_path: &str, envs: Envs) -> AppResult<String> {
    Ok(run(repo_path, &["submodule", "sync", "--recursive"], envs)?.text())
}

/// `git submodule add <url> <path>`, optionally following `branch_name`.
pub fn add(repo_path: &str, url: &str, submodule_path: &str, branch_name: Option<&str>, envs: Envs) -> AppResult<String> {
    let url = url.trim();
    if url.is_empty() || url.starts_with('-') {
        return Err(AppError::invalid("Enter the submodule's repository URL"));
    }
    let path = checked_path(submodule_path)?;
    let mut args = vec!["submodule", "add"];
    if let Some(branch) = branch_name.map(str::trim).filter(|branch| !branch.is_empty()) {
        if branch.starts_with('-') {
            return Err(AppError::invalid(format!("Branch cannot start with '-': {branch}")));
        }
        args.extend(["-b", branch]);
    }
    args.extend(["--", url, path.as_str()]);
    Ok(run(repo_path, &args, envs)?.text())
}

/// Removes a submodule: `git submodule deinit -f`, `git rm -f`, then its
/// cloned repository under `.git/modules` (git has no command for that last
/// step; without it the same name cannot be added again).
pub fn remove(repo_path: &str, submodule_path: &str, envs: Envs) -> AppResult<()> {
    let path = checked_path(submodule_path)?;
    let repo = Repository::open(repo_path)?;
    let name = repo
        .find_submodule(&path)
        .map(|submodule| path_text(submodule.name_bytes()))
        .map_err(|_| AppError::invalid(format!("{path} is not a submodule")))?;
    let modules_dir = repo.path().join("modules");
    drop(repo);
    run(repo_path, &["submodule", "deinit", "-f", "--", &path], envs)?;
    run(repo_path, &["rm", "-f", "-q", "--", &path], envs)?;
    let module_git_dir = modules_dir.join(&name);
    // Only ever a folder inside .git/modules.
    let inside = module_git_dir
        .canonicalize()
        .ok()
        .zip(modules_dir.canonicalize().ok())
        .map(|(module, modules)| module.starts_with(&modules) && module != modules)
        .unwrap_or(false);
    if inside {
        std::fs::remove_dir_all(&module_git_dir)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::status;
    use crate::test_support::{git_in, BareRemote, TestDir, TestRepo};

    /// Allows file:// submodule URLs for these test invocations only.
    const ALLOW_FILE: &[(&str, &str)] = &[
        ("GIT_CONFIG_COUNT", "1"),
        ("GIT_CONFIG_KEY_0", "protocol.file.allow"),
        ("GIT_CONFIG_VALUE_0", "always"),
    ];

    /// A bare remote with one commit holding lib.txt.
    fn library_remote() -> BareRemote {
        let remote = BareRemote::new();
        let seed = TestRepo::new();
        seed.write("lib.txt", "v1\n");
        seed.commit_all("lib v1");
        seed.add_remote("origin", &remote);
        seed.git(&["push", "-q", "origin", "main"]);
        remote
    }

    fn url_of(remote: &BareRemote) -> String {
        format!("file://{}", remote.path_string())
    }

    fn push_new_library_commit(remote: &BareRemote, content: &str) {
        let clone = TestRepo::clone_from(remote);
        clone.write("lib.txt", content);
        clone.commit_all("lib update");
        clone.git(&["push", "-q", "origin", "main"]);
    }

    fn entry<'a>(files: &'a [FileStatus], file_path: &str) -> Option<&'a FileStatus> {
        files.iter().find(|file| file.path == file_path)
    }

    #[test]
    fn adds_updates_maps_status_and_removes_a_submodule() {
        let remote = library_remote();
        let repo = TestRepo::new();
        repo.write("app.txt", "app\n");
        repo.commit_all("base");
        let root = repo.path_string();
        assert!(!has_submodules(&repo.open()));

        add(&root, &url_of(&remote), "libs/lib", None, ALLOW_FILE).unwrap();
        assert!(has_submodules(&repo.open()));
        let files = status::read(&repo.open()).unwrap().files;
        let added = entry(&files, "libs/lib").expect("submodule entry");
        assert_eq!(added.staged, Some(ChangeKind::Added));
        assert_eq!(added.unstaged, None);
        assert!(added.submodule.is_some());
        assert!(entry(&files, ".gitmodules").is_some());
        repo.commit_all("add lib");
        assert!(status::read(&repo.open()).unwrap().files.is_empty());

        let listed = list(&root).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].path, "libs/lib");
        assert!(listed[0].initialized);
        assert_eq!(listed[0].url.as_deref(), Some(url_of(&remote).as_str()));

        // Modified and untracked content, like `git status`.
        let lib = repo.file("libs/lib");
        std::fs::write(lib.join("lib.txt"), "edited\n").unwrap();
        std::fs::write(lib.join("new.txt"), "new\n").unwrap();
        let files = status::read(&repo.open()).unwrap().files;
        assert_eq!(files.len(), 1, "{files:?}");
        let dirty = &files[0];
        assert_eq!(dirty.unstaged, Some(ChangeKind::Modified));
        assert_eq!(
            dirty.submodule,
            Some(SubmoduleChange { new_commits: false, modified_content: true, untracked_content: true })
        );
        // ignore=dirty hides content changes.
        repo.git(&["config", "submodule.libs/lib.ignore", "dirty"]);
        assert!(status::read(&repo.open()).unwrap().files.is_empty());
        repo.git(&["config", "--unset", "submodule.libs/lib.ignore"]);
        git_in(&lib, &["checkout", "-q", "--", "lib.txt"]);
        std::fs::remove_file(lib.join("new.txt")).unwrap();

        // New commits: update --remote moves it to the remote's latest commit.
        push_new_library_commit(&remote, "v2\n");
        update(&root, true, &[], ALLOW_FILE, |_| {}).unwrap();
        let files = status::read(&repo.open()).unwrap().files;
        let moved = entry(&files, "libs/lib").expect("moved submodule");
        assert_eq!(moved.unstaged, Some(ChangeKind::Modified));
        assert_eq!(moved.submodule, Some(SubmoduleChange { new_commits: true, ..SubmoduleChange::default() }));
        assert_eq!(std::fs::read_to_string(lib.join("lib.txt")).unwrap(), "v2\n");
        // A plain update goes back to the recorded commit.
        update(&root, false, &[], ALLOW_FILE, |_| {}).unwrap();
        assert!(status::read(&repo.open()).unwrap().files.is_empty());
        assert_eq!(std::fs::read_to_string(lib.join("lib.txt")).unwrap(), "v1\n");

        // Its diff reads like `git diff` shows a submodule.
        push_new_library_commit(&remote, "v3\n");
        update(&root, true, &[], ALLOW_FILE, |_| {}).unwrap();
        let moved = crate::git::diff::working_file(&repo.open(), "libs/lib", None, crate::git::diff::DiffArea::Unstaged).unwrap();
        assert!(moved.original.starts_with("Subproject commit "), "{moved:?}");
        assert!(moved.modified.starts_with("Subproject commit "));
        assert_ne!(moved.original, moved.modified);
        update(&root, false, &[], ALLOW_FILE, |_| {}).unwrap();

        sync(&root, ALLOW_FILE).unwrap();
        remove(&root, "libs/lib", ALLOW_FILE).unwrap();
        assert!(!lib.exists());
        assert!(!repo.path.join(".git/modules/libs/lib").exists());
        let files = status::read(&repo.open()).unwrap().files;
        assert_eq!(entry(&files, "libs/lib").and_then(|file| file.staged), Some(ChangeKind::Deleted), "{files:?}");
        repo.commit_all("remove lib");
        assert!(list(&root).unwrap().is_empty());
        // The same name can be added again.
        add(&root, &url_of(&remote), "libs/lib", None, ALLOW_FILE).unwrap();
    }

    #[test]
    fn a_fresh_clone_inits_and_updates_its_submodules() {
        let library = library_remote();
        let parent_remote = BareRemote::new();
        let parent = TestRepo::new();
        parent.write("app.txt", "app\n");
        parent.commit_all("base");
        add(&parent.path_string(), &url_of(&library), "lib", None, ALLOW_FILE).unwrap();
        parent.commit_all("add lib");
        parent.add_remote("origin", &parent_remote);
        parent.git(&["push", "-q", "origin", "main"]);

        let clone = TestRepo::clone_from(&parent_remote);
        let root = clone.path_string();
        // Not cloned yet: listed, not initialized, and no status entry.
        let listed = list(&root).unwrap();
        assert!(!listed[0].initialized);
        assert!(status::read(&clone.open()).unwrap().files.is_empty());

        init(&root, &[], ALLOW_FILE).unwrap();
        let mut lines = Vec::new();
        update(&root, false, &["lib".to_string()], ALLOW_FILE, |line| lines.push(line.to_string())).unwrap();
        assert!(clone.file("lib/lib.txt").exists());
        assert!(list(&root).unwrap()[0].initialized);
        assert!(status::read(&clone.open()).unwrap().files.is_empty());
    }

    #[test]
    fn workspace_scan_marks_submodules() {
        let library = library_remote();
        let dir = TestDir::new();
        let parent_root = dir.init_repo("app");
        git_in(&parent_root, &["config", "user.name", "Test User"]);
        git_in(&parent_root, &["config", "user.email", "test@example.com"]);
        dir.write("app/a.txt", "a\n");
        git_in(&parent_root, &["add", "-A"]);
        git_in(&parent_root, &["commit", "-q", "-m", "base"]);
        add(&parent_root.to_string_lossy(), &url_of(&library), "vendor-lib", None, ALLOW_FILE).unwrap();
        dir.init_repo("app/nested-plain");

        let workspace = crate::git::workspace::open(&dir.path_string()).unwrap();
        let flags: Vec<(String, bool)> = workspace.repos.iter().map(|repo| (repo.relative_path.clone(), repo.submodule)).collect();
        assert_eq!(
            flags,
            vec![
                ("app".to_string(), false),
                ("app/nested-plain".to_string(), false),
                ("app/vendor-lib".to_string(), true),
            ]
        );
    }

    #[test]
    fn refuses_paths_outside_the_work_tree() {
        assert!(checked_path("../x").is_err());
        assert!(checked_path("/abs").is_err());
        assert!(checked_path("--force").is_err());
        assert!(checked_path("  ").is_err());
        assert_eq!(checked_path("libs/x/").unwrap(), "libs/x");
    }
}
