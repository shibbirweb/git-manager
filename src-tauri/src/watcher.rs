//! Watches a workspace folder (including every `.git` inside it) and emits
//! debounced `repo-changed` and `workspace-changed` events so the UI
//! refreshes without polling. `workspace-changed` carries `reposChanged` when
//! a repository may have appeared or disappeared, so the frontend rescans
//! only then.

use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::time::Duration;

use git2::Repository;
use notify_debouncer_full::notify::event::{EventKind, ModifyKind};
use notify_debouncer_full::{new_debouncer, notify::RecursiveMode, DebounceEventResult};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};
use crate::git::workspace::deepest_repo_index;
use crate::state::RepoWatcher;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RepoChanged {
    repo_path: String,
    /// HEAD, refs, index or operation state changed.
    git_dir: bool,
    work_tree: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceChanged {
    workspace_root: String,
    /// A repository may have appeared or disappeared: the frontend rescans.
    repos_changed: bool,
}

/// What one debounced batch changed.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Attribution {
    /// `(index into repo_roots, git_dir, work_tree)`, in `repo_roots` order.
    pub repos: Vec<(usize, bool, bool)>,
    pub workspace_changed: bool,
    /// A `.git` appeared or disappeared, a repository (or a folder holding
    /// one) was removed or moved, or a folder with a `.git` was moved in.
    pub repos_changed: bool,
}

/// `.git` internals that change constantly but never affect what we show.
fn is_noise(git_relative: &Path) -> bool {
    let first = git_relative.components().next();
    let noisy_dir = matches!(
        first,
        Some(Component::Normal(name)) if name == "objects" || name == "logs" || name == "lfs"
    );
    let is_lock = git_relative.extension().map(|ext| ext == "lock").unwrap_or(false);
    noisy_dir || is_lock
}

fn is_structural(kind: &EventKind) -> bool {
    matches!(
        kind,
        EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(ModifyKind::Name(_))
    )
}

fn has_git_component(path: &Path) -> bool {
    path.components().any(|component| component == Component::Normal(".git".as_ref()))
}

/// `<dir>/.git/HEAD`: written once a new repository is usable, often after its
/// `.git` directory was already reported.
fn is_git_head(path: &Path) -> bool {
    path.file_name().map(|name| name == "HEAD").unwrap_or(false)
        && path
            .parent()
            .and_then(Path::file_name)
            .map(|name| name == ".git")
            .unwrap_or(false)
}

/// Attributes every event path to the deepest of `repo_roots` containing it.
/// `is_ignored(repo_index, repo_relative_path)` asks that repository's
/// .gitignore; ignored work tree paths are dropped. Paths outside every
/// repository, visible work tree changes and any `.git` appearing or
/// disappearing mark the workspace as changed. `has_git_entry(path)` is asked
/// only for renamed paths, to notice a repository moved into the workspace.
pub fn attribute<'a>(
    repo_roots: &[PathBuf],
    events: impl IntoIterator<Item = (&'a EventKind, &'a [PathBuf])>,
    mut is_ignored: impl FnMut(usize, &Path) -> bool,
    mut has_git_entry: impl FnMut(&Path) -> bool,
) -> Attribution {
    let mut flags = vec![(false, false); repo_roots.len()];
    let mut workspace_changed = false;
    let mut repos_changed = false;
    for (kind, paths) in events {
        let structural = is_structural(kind);
        for path in paths {
            let is_git_entry = path.file_name().map(|name| name == ".git").unwrap_or(false);
            if is_git_entry && structural {
                workspace_changed = true;
                repos_changed = true;
                continue;
            }
            if structural && !repos_changed {
                let holds_known_repo = repo_roots.iter().any(|repo_root| repo_root.starts_with(path));
                let moved_in_repo = matches!(kind, EventKind::Modify(ModifyKind::Name(_)))
                    && !has_git_component(path)
                    && has_git_entry(path);
                repos_changed = holds_known_repo || moved_in_repo;
            }
            let Some(index) = deepest_repo_index(repo_roots, path) else {
                // A `.git` of a repository not in the list: only its creation matters.
                if !has_git_component(path) {
                    workspace_changed = true;
                } else if structural && is_git_head(path) {
                    repos_changed = true;
                }
                continue;
            };
            let Ok(relative) = path.strip_prefix(&repo_roots[index]) else {
                continue;
            };
            if let Ok(git_relative) = relative.strip_prefix(".git") {
                if !is_noise(git_relative) {
                    flags[index].0 = true;
                }
            } else if has_git_component(relative) {
                // Inside the `.git` of a nested repository that is not in the list yet.
                if structural && is_git_head(relative) {
                    repos_changed = true;
                }
                continue;
            } else if relative.as_os_str().is_empty() || !is_ignored(index, relative) {
                flags[index].1 = true;
                workspace_changed = true;
            }
        }
    }
    let repos = flags
        .into_iter()
        .enumerate()
        .filter(|(_, (git_dir, work_tree))| *git_dir || *work_tree)
        .map(|(index, (git_dir, work_tree))| (index, git_dir, work_tree))
        .collect();
    Attribution {
        repos,
        workspace_changed,
        repos_changed,
    }
}

/// A folder with a `.git` directory or file directly inside, i.e. a repository root.
fn has_git_entry(path: &Path) -> bool {
    path.join(".git").exists()
}

fn canonical_or_given(path: &str) -> PathBuf {
    Path::new(path).canonicalize().unwrap_or_else(|_| PathBuf::from(path))
}

fn watch_error(err: impl std::fmt::Display) -> AppError {
    AppError::invalid(format!("Could not watch workspace: {err}"))
}

/// One recursive watcher on the workspace root, plus the `.git` directory of
/// any repository outside it (a repository enclosing the workspace).
pub fn watch(app: AppHandle, workspace_root: &str, repo_roots: &[String]) -> AppResult<RepoWatcher> {
    let root = canonical_or_given(workspace_root);
    let canonical_roots: Vec<PathBuf> = repo_roots.iter().map(|repo_root| canonical_or_given(repo_root)).collect();
    let outside_git_dirs: Vec<PathBuf> = canonical_roots
        .iter()
        .filter(|repo_root| !repo_root.starts_with(&root))
        .map(|repo_root| repo_root.join(".git"))
        .filter(|git_dir| git_dir.is_dir())
        .collect();

    let workspace_root_owned = workspace_root.to_string();
    let repo_paths = repo_roots.to_vec();
    let roots = canonical_roots.clone();
    let mut debouncer = new_debouncer(Duration::from_millis(300), None, move |result: DebounceEventResult| {
        let Ok(events) = result else {
            return;
        };
        // Opened lazily for this batch only.
        let mut repos: HashMap<usize, Option<Repository>> = HashMap::new();
        let attribution = attribute(
            &roots,
            events.iter().map(|event| (&event.kind, event.paths.as_slice())),
            |index, relative| {
                repos
                    .entry(index)
                    .or_insert_with(|| Repository::open(&roots[index]).ok())
                    .as_ref()
                    .map(|repo| repo.status_should_ignore(relative).unwrap_or(false))
                    .unwrap_or(false)
            },
            has_git_entry,
        );
        for (index, git_dir, work_tree) in attribution.repos {
            let _ = app.emit(
                "repo-changed",
                RepoChanged {
                    repo_path: repo_paths[index].clone(),
                    git_dir,
                    work_tree,
                },
            );
        }
        if attribution.workspace_changed || attribution.repos_changed {
            let _ = app.emit(
                "workspace-changed",
                WorkspaceChanged {
                    workspace_root: workspace_root_owned.clone(),
                    repos_changed: attribution.repos_changed,
                },
            );
        }
    })
    .map_err(watch_error)?;

    debouncer.watch(&root, RecursiveMode::Recursive).map_err(watch_error)?;
    for git_dir in &outside_git_dirs {
        debouncer.watch(git_dir, RecursiveMode::Recursive).map_err(watch_error)?;
    }
    Ok(debouncer)
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use notify_debouncer_full::notify::event::{CreateKind, DataChange, EventKind, ModifyKind, RemoveKind, RenameMode};

    use super::{attribute, has_git_entry, Attribution};
    use crate::test_support::TestDir;

    const MODIFY: EventKind = EventKind::Modify(ModifyKind::Data(DataChange::Content));
    const CREATE_DIR: EventKind = EventKind::Create(CreateKind::Folder);
    const REMOVE_DIR: EventKind = EventKind::Remove(RemoveKind::Folder);
    const RENAME: EventKind = EventKind::Modify(ModifyKind::Name(RenameMode::Both));
    const CREATE_FILE: EventKind = EventKind::Create(CreateKind::File);

    fn paths(values: &[&str]) -> Vec<PathBuf> {
        values.iter().map(PathBuf::from).collect()
    }

    /// Attributes `events` with every `*.log` path treated as ignored and
    /// every folder named `*-repo` treated as holding a `.git`.
    fn run(repo_roots: &[&str], events: &[(EventKind, Vec<PathBuf>)]) -> Attribution {
        let roots = paths(repo_roots);
        attribute(
            &roots,
            events.iter().map(|(kind, paths)| (kind, paths.as_slice())),
            |_, relative: &Path| relative.extension().map(|ext| ext == "log").unwrap_or(false),
            |path: &Path| path.to_string_lossy().ends_with("-repo"),
        )
    }

    const NESTED: &[&str] = &["/w", "/w/apps/web"];

    #[test]
    fn work_tree_changes_go_to_the_deepest_repository() {
        let result = run(NESTED, &[(MODIFY, paths(&["/w/apps/web/src/a.ts"]))]);
        assert_eq!(result, Attribution { repos: vec![(1, false, true)], workspace_changed: true, ..Attribution::default() });

        let result = run(NESTED, &[(MODIFY, paths(&["/w/README.md", "/w/apps/web/b.ts"]))]);
        assert_eq!(result, Attribution { repos: vec![(0, false, true), (1, false, true)], workspace_changed: true, ..Attribution::default() });
    }

    #[test]
    fn git_dir_changes_skip_noise_and_do_not_touch_the_workspace() {
        let result = run(NESTED, &[(MODIFY, paths(&["/w/apps/web/.git/index", "/w/.git/refs/heads/main"]))]);
        assert_eq!(result, Attribution { repos: vec![(0, true, false), (1, true, false)], workspace_changed: false, ..Attribution::default() });

        let noise = paths(&[
            "/w/apps/web/.git/objects/ab/cdef",
            "/w/.git/logs/HEAD",
            "/w/.git/lfs/tmp",
            "/w/.git/index.lock",
            "/w/.git/refs/heads/main.lock",
        ]);
        assert_eq!(run(NESTED, &[(MODIFY, noise)]), Attribution::default());
    }

    #[test]
    fn ignored_work_tree_paths_are_dropped() {
        let roots = paths(NESTED);
        let mut asked = Vec::new();
        let events = [(MODIFY, paths(&["/w/apps/web/debug.log", "/w/target/out.log"]))];
        let result = attribute(&roots, events.iter().map(|(kind, paths)| (kind, paths.as_slice())), |index, relative| {
            asked.push((index, relative.to_path_buf()));
            true
        }, |_| false);
        assert_eq!(result, Attribution::default());
        assert_eq!(asked, vec![(1, PathBuf::from("debug.log")), (0, PathBuf::from("target/out.log"))]);
    }

    #[test]
    fn paths_outside_every_repository_change_the_workspace() {
        let result = run(&["/w/apps/web"], &[(MODIFY, paths(&["/w/notes.txt", "/w/other/x.log"]))]);
        assert_eq!(result, Attribution { repos: Vec::new(), workspace_changed: true, ..Attribution::default() });
        assert!(run(&[], &[(MODIFY, paths(&["/w/a.txt"]))]).workspace_changed);
    }

    #[test]
    fn git_directories_appearing_or_disappearing_change_the_workspace() {
        let created = run(
            NESTED,
            &[
                (CREATE_DIR, paths(&["/w/libs/new/.git"])),
                (EventKind::Create(CreateKind::File), paths(&["/w/libs/new/.git/HEAD"])),
            ],
        );
        assert_eq!(created, Attribution { repos: Vec::new(), workspace_changed: true, repos_changed: true });

        let removed = run(NESTED, &[(REMOVE_DIR, paths(&["/w/apps/web/.git"]))]);
        assert_eq!(removed, Attribution { repos: Vec::new(), workspace_changed: true, repos_changed: true });

        let renamed = run(&[], &[(RENAME, paths(&["/w/x/.git", "/w/x/.git-old"]))]);
        assert!(renamed.workspace_changed);
        assert!(renamed.repos_changed);

        // Internals of a repository that is not in the list are ignored.
        let unknown = run(NESTED, &[(MODIFY, paths(&["/w/libs/new/.git/index"]))]);
        assert_eq!(unknown, Attribution::default());
        assert_eq!(run(&[], &[(MODIFY, paths(&["/w/new/.git/index"]))]), Attribution::default());
    }

    #[test]
    fn enclosing_repository_outside_the_workspace() {
        let result = run(&["/e"], &[(MODIFY, paths(&["/e/.git/HEAD", "/e/sub/file.txt"]))]);
        assert_eq!(result, Attribution { repos: vec![(0, true, true)], workspace_changed: true, ..Attribution::default() });
    }

    #[test]
    fn a_new_head_in_an_unknown_git_dir_asks_for_a_rescan() {
        // `git init` and `git clone` write HEAD through a lock file and a rename.
        let top = run(&[], &[(RENAME, paths(&["/w/new/.git/HEAD.lock", "/w/new/.git/HEAD"]))]);
        assert_eq!(top, Attribution { repos: Vec::new(), workspace_changed: false, repos_changed: true });

        let nested = run(NESTED, &[(CREATE_FILE, paths(&["/w/libs/new/.git/HEAD"]))]);
        assert_eq!(nested, Attribution { repos: Vec::new(), workspace_changed: false, repos_changed: true });

        // Checking out a branch in a known repository rewrites HEAD too: no rescan.
        let checkout = run(NESTED, &[(RENAME, paths(&["/w/apps/web/.git/HEAD"]))]);
        assert_eq!(checkout, Attribution { repos: vec![(1, true, false)], workspace_changed: false, repos_changed: false });

        // Content changes inside an unknown `.git` are still ignored.
        assert_eq!(run(&[], &[(MODIFY, paths(&["/w/new/.git/HEAD"]))]), Attribution::default());
    }

    #[test]
    fn removing_or_moving_a_repository_or_its_parent_asks_for_a_rescan() {
        assert!(run(NESTED, &[(REMOVE_DIR, paths(&["/w/apps"]))]).repos_changed);
        assert!(run(NESTED, &[(RENAME, paths(&["/w/apps/web"]))]).repos_changed);
        assert!(!run(NESTED, &[(REMOVE_DIR, paths(&["/w/apps/web/src"]))]).repos_changed);
    }

    #[test]
    fn a_repository_moved_into_the_workspace_asks_for_a_rescan() {
        assert!(run(NESTED, &[(RENAME, paths(&["/w/libs/incoming-repo"]))]).repos_changed);
        assert!(!run(NESTED, &[(RENAME, paths(&["/w/libs/plain-folder"]))]).repos_changed);
        // Only renames are checked on disk; ordinary creations stay cheap.
        assert!(!run(NESTED, &[(CREATE_DIR, paths(&["/w/libs/new-repo"]))]).repos_changed);
        assert!(!run(NESTED, &[(CREATE_FILE, paths(&["/w/apps/web/src/a.ts"]))]).repos_changed);
    }

    #[test]
    fn has_git_entry_finds_repository_roots_on_disk() {
        let dir = TestDir::new();
        let repo = dir.init_repo("libs/new");
        dir.write("libs/plain/readme.md", "hi");
        assert!(has_git_entry(&repo));
        assert!(!has_git_entry(&dir.file("libs/plain")));
        assert!(!has_git_entry(&dir.file("libs/plain/readme.md")));
        assert!(!has_git_entry(&dir.file("libs/missing")));
    }
}
