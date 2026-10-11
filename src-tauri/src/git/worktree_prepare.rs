//! A new worktree ready to run, like Orca: the base a new task branches from, and the ignored files a fresh checkout
//! lacks. The literal paths of the main checkout's `.worktreeinclude` (such as `.env`) are copied, and shared folders
//! (such as `node_modules`) are linked. Only paths git ignores are touched: anything else the checkout already has.

use std::path::{Component, Path, PathBuf};

use git2::Repository;
use serde::Serialize;

use crate::error::{AppError, AppResult};

/// The file in the main checkout that lists ignored paths to copy into each new worktree.
pub const INCLUDE_FILE: &str = ".worktreeinclude";

/// What a new task branches from: the remote's default branch (`origin/HEAD`), else the current branch, else HEAD.
pub fn default_base(repo_path: &str) -> AppResult<String> {
    let repo = Repository::open(repo_path)?;
    if let Ok(reference) = repo.find_reference("refs/remotes/origin/HEAD") {
        if let Ok(Some(target)) = reference.symbolic_target() {
            if let Some(short) = target.strip_prefix("refs/remotes/") {
                if repo.find_reference(target).is_ok() {
                    return Ok(short.to_string());
                }
            }
        }
    }
    if let Ok(head) = repo.head() {
        if head.is_branch() {
            if let Ok(name) = head.shorthand() {
                return Ok(name.to_string());
            }
        }
    }
    Ok("HEAD".to_string())
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedPath {
    pub path: String,
    pub reason: String,
}

/// What `prepare` did, path by path (relative to the repository).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareReport {
    pub copied: Vec<String>,
    pub linked: Vec<String>,
    pub skipped: Vec<SkippedPath>,
}

impl PrepareReport {
    fn skip(&mut self, path: &str, reason: impl Into<String>) {
        self.skipped.push(SkippedPath {
            path: path.to_string(),
            reason: reason.into(),
        });
    }
}

/// Copies the `.worktreeinclude` paths of `main_root` into `worktree_path` and links each of `link_dirs` there.
/// Nothing already in the worktree is overwritten.
pub fn prepare(main_root: &str, worktree_path: &str, link_dirs: &[String]) -> AppResult<PrepareReport> {
    let main = Path::new(main_root);
    let target = Path::new(worktree_path);
    if !target.is_dir() {
        return Err(AppError::invalid(format!("The worktree folder {worktree_path} does not exist")));
    }
    let repo = Repository::open(main)?;
    let mut report = PrepareReport::default();
    let include = std::fs::read_to_string(main.join(INCLUDE_FILE)).unwrap_or_default();
    for entry in include.lines().map(str::trim).filter(|line| !line.is_empty() && !line.starts_with('#')) {
        match checked(&repo, main, target, entry) {
            Ok((source, destination)) => match copy_path(&source, &destination) {
                Ok(()) => report.copied.push(entry.to_string()),
                Err(error) => report.skip(entry, format!("could not copy: {error}")),
            },
            Err(reason) => report.skip(entry, reason),
        }
    }
    for name in link_dirs.iter().map(|name| name.trim()).filter(|name| !name.is_empty()) {
        match checked(&repo, main, target, name) {
            Ok((source, _)) if !source.is_dir() => report.skip(name, "not a folder in the main checkout"),
            Ok((source, destination)) => match link_dir(&source, &destination) {
                Ok(()) => {
                    // A link is a file to git, which a folder pattern like `node_modules/` does not ignore: without
                    // this the worktree would show it as untracked and `git worktree remove` would refuse.
                    if let Err(error) = exclude_link(&repo, name) {
                        report.skip(name, format!("linked, but could not add it to info/exclude: {error}"));
                    }
                    report.linked.push(name.to_string());
                }
                Err(error) => report.skip(name, format!("could not link: {error}")),
            },
            Err(reason) => report.skip(name, reason),
        }
    }
    Ok(report)
}

/// The source and destination of one listed path, or why it is skipped.
fn checked(repo: &Repository, main: &Path, target: &Path, entry: &str) -> Result<(PathBuf, PathBuf), String> {
    if entry.starts_with('!') || entry.contains(['*', '?', '[']) {
        return Err("patterns are not supported: list the path itself".to_string());
    }
    let relative = Path::new(entry.trim_end_matches(['/', '\\']));
    let inside = relative.components().all(|component| matches!(component, Component::Normal(_)));
    if relative.as_os_str().is_empty() || !inside {
        return Err("not a path inside the repository".to_string());
    }
    let source = main.join(relative);
    let Ok(metadata) = source.symlink_metadata() else {
        return Err("not in the main checkout".to_string());
    };
    let slashed = relative.to_string_lossy().replace('\\', "/");
    let ignored = repo.is_path_ignored(&slashed).unwrap_or(false)
        || (metadata.is_dir() && repo.is_path_ignored(format!("{slashed}/")).unwrap_or(false));
    if !ignored {
        return Err("git does not ignore it, so the worktree has its own copy".to_string());
    }
    let destination = target.join(relative);
    if destination.symlink_metadata().is_ok() {
        return Err("already in the worktree".to_string());
    }
    Ok((source, destination))
}

/// Adds `/<name>` to the repository's shared `info/exclude` (every worktree reads it), once.
fn exclude_link(repo: &Repository, name: &str) -> std::io::Result<()> {
    let pattern = format!("/{}", name.trim_end_matches(['/', '\\']).replace('\\', "/"));
    let file = repo.commondir().join("info").join("exclude");
    let current = std::fs::read_to_string(&file).unwrap_or_default();
    if current.lines().any(|line| line.trim() == pattern) {
        return Ok(());
    }
    if let Some(parent) = file.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let separator = if current.is_empty() || current.ends_with('\n') { "" } else { "\n" };
    std::fs::write(&file, format!("{current}{separator}# Linked into worktrees by Git Manager\n{pattern}\n"))
}

fn copy_path(source: &Path, destination: &Path) -> std::io::Result<()> {
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let metadata = source.symlink_metadata()?;
    if metadata.file_type().is_symlink() {
        return copy_link(source, destination);
    }
    if !metadata.is_dir() {
        std::fs::copy(source, destination)?;
        return Ok(());
    }
    std::fs::create_dir_all(destination)?;
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        copy_path(&entry.path(), &destination.join(entry.file_name()))?;
    }
    Ok(())
}

#[cfg(unix)]
fn copy_link(source: &Path, destination: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(std::fs::read_link(source)?, destination)
}

#[cfg(not(unix))]
fn copy_link(source: &Path, destination: &Path) -> std::io::Result<()> {
    // Windows links need extra rights; a copy of what the link points to works the same for these files.
    std::fs::copy(source, destination).map(|_| ())
}

fn link_dir(source: &Path, destination: &Path) -> std::io::Result<()> {
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent)?;
    }
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(source, destination)
    }
    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_dir(source, destination)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::{BareRemote, TestRepo};

    fn worktree_of(repo: &TestRepo, name: &str) -> PathBuf {
        let path = repo.path.parent().expect("repo parent").join(name);
        repo.git(&["worktree", "add", "-q", "-b", name, &path.to_string_lossy()]);
        path
    }

    #[test]
    fn the_default_base_is_the_remotes_default_branch_else_the_current_one() {
        let repo = TestRepo::new();
        repo.write("a.txt", "a");
        repo.commit_all("first");
        assert_eq!(default_base(&repo.path_string()).unwrap(), "main");

        let remote = BareRemote::new();
        repo.git(&["remote", "add", "origin", &remote.path_string()]);
        repo.git(&["push", "-q", "origin", "main"]);
        repo.git(&["fetch", "-q", "origin"]);
        repo.git(&["remote", "set-head", "origin", "main"]);
        repo.git(&["checkout", "-q", "-b", "feature"]);
        assert_eq!(default_base(&repo.path_string()).unwrap(), "origin/main");

        // origin/HEAD naming a branch that is gone: the current branch.
        repo.git(&["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/gone"]);
        assert_eq!(default_base(&repo.path_string()).unwrap(), "feature");

        repo.git(&["checkout", "-q", "--detach"]);
        assert_eq!(default_base(&repo.path_string()).unwrap(), "HEAD");
    }

    #[test]
    fn copies_listed_ignored_paths_and_links_shared_folders() {
        let repo = TestRepo::new();
        repo.write(".gitignore", ".env\nconfig/local.json\nnode_modules/\n.cache/\nsecret*\n");
        repo.write(
            INCLUDE_FILE,
            "# local files\n.env\nconfig/local.json\n\nREADME.md\nmissing.env\nsecret*\n../outside\n.cache/\n",
        );
        repo.write("README.md", "readme");
        repo.commit_all("first");
        repo.write(".env", "TOKEN=1");
        repo.write("config/local.json", "{}");
        repo.write("node_modules/pkg/index.js", "module.exports = 1;");
        repo.write(".cache/data/x", "x");
        let worktree = worktree_of(&repo, "task");
        let links = vec!["node_modules".to_string(), "missing_dir".to_string(), ".env".to_string()];

        let report = prepare(&repo.path_string(), &worktree.to_string_lossy(), &links).unwrap();

        assert_eq!(report.copied, vec![".env", "config/local.json", ".cache/"]);
        assert_eq!(report.linked, vec!["node_modules"]);
        let skipped: Vec<(&str, &str)> = report.skipped.iter().map(|skip| (skip.path.as_str(), skip.reason.as_str())).collect();
        assert_eq!(
            skipped,
            vec![
                ("README.md", "git does not ignore it, so the worktree has its own copy"),
                ("missing.env", "not in the main checkout"),
                ("secret*", "patterns are not supported: list the path itself"),
                ("../outside", "not a path inside the repository"),
                ("missing_dir", "not in the main checkout"),
                (".env", "already in the worktree"),
            ],
        );
        assert_eq!(std::fs::read_to_string(worktree.join(".env")).unwrap(), "TOKEN=1");
        assert_eq!(std::fs::read_to_string(worktree.join("config/local.json")).unwrap(), "{}");
        assert_eq!(std::fs::read_to_string(worktree.join(".cache/data/x")).unwrap(), "x");
        let link = worktree.join("node_modules");
        assert!(link.symlink_metadata().unwrap().file_type().is_symlink());
        assert_eq!(std::fs::read_to_string(link.join("pkg/index.js")).unwrap(), "module.exports = 1;");
    }

    #[test]
    fn a_linked_folder_leaves_the_worktree_clean_and_removable() {
        let repo = TestRepo::new();
        repo.write(".gitignore", "node_modules/\n");
        repo.commit_all("first");
        repo.write("node_modules/pkg/index.js", "x");
        let worktree = worktree_of(&repo, "task");
        let links = vec!["node_modules".to_string()];
        prepare(&repo.path_string(), &worktree.to_string_lossy(), &links).unwrap();
        // Twice: the exclude line is added once.
        let second = worktree_of(&repo, "task-2");
        prepare(&repo.path_string(), &second.to_string_lossy(), &links).unwrap();
        let exclude = std::fs::read_to_string(repo.path.join(".git/info/exclude")).unwrap();
        assert_eq!(exclude.matches("/node_modules\n").count(), 1);

        let status = crate::test_support::git_in(&worktree, &["status", "--porcelain"]);
        assert_eq!(status.trim(), "");
        repo.git(&["worktree", "remove", &worktree.to_string_lossy()]);
        assert!(!worktree.exists());
        // The link went, not what it pointed to.
        assert!(repo.exists("node_modules/pkg/index.js"));
    }

    #[test]
    fn never_overwrites_and_works_without_an_include_file() {
        let repo = TestRepo::new();
        repo.write(".gitignore", ".env\n");
        repo.write("a.txt", "a");
        repo.commit_all("first");
        repo.write(".env", "MAIN=1");
        let worktree = worktree_of(&repo, "task");
        let report = prepare(&repo.path_string(), &worktree.to_string_lossy(), &[]).unwrap();
        assert_eq!(report, PrepareReport::default());

        repo.write(INCLUDE_FILE, ".env\n");
        std::fs::write(worktree.join(".env"), "WORKTREE=1").unwrap();
        let report = prepare(&repo.path_string(), &worktree.to_string_lossy(), &[]).unwrap();
        assert!(report.copied.is_empty());
        assert_eq!(std::fs::read_to_string(worktree.join(".env")).unwrap(), "WORKTREE=1");
    }

    #[test]
    fn refuses_a_missing_worktree_folder() {
        let repo = TestRepo::new();
        repo.write("a.txt", "a");
        repo.commit_all("first");
        let missing = repo.path.parent().unwrap().join("nope");
        assert!(prepare(&repo.path_string(), &missing.to_string_lossy(), &[]).is_err());
    }
}
