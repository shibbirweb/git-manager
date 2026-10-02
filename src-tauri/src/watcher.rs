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
use notify_debouncer_full::{new_debouncer_opt, notify, notify::RecursiveMode, DebounceEventResult, NoCache};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::error::{AppError, AppResult};
use crate::git::workspace::{deepest_repo_index, SKIPPED_DIRS};
use crate::state::{AppState, RepoWatcher};
use crate::symbols::language_for;

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

/// Whether a batch created, deleted or renamed anything below `workspace_root`
/// outside `.git` and the dependency and build folders, so the Go to File
/// index is out of date. Content changes alone keep it.
pub fn adds_or_removes_files<'a>(
    workspace_root: &Path,
    events: impl IntoIterator<Item = (&'a EventKind, &'a [PathBuf])>,
) -> bool {
    events
        .into_iter()
        .any(|(kind, paths)| is_structural(kind) && paths.iter().any(|path| is_indexed(workspace_root, path)))
}

/// Whether a batch changed the contents of a source file the symbol index
/// reads (Classes and Symbols). Creations and removals are `adds_or_removes_files`.
pub fn edits_source_files<'a>(
    workspace_root: &Path,
    events: impl IntoIterator<Item = (&'a EventKind, &'a [PathBuf])>,
) -> bool {
    events.into_iter().any(|(kind, paths)| {
        matches!(kind, EventKind::Modify(ModifyKind::Data(_) | ModifyKind::Any))
            && paths
                .iter()
                .any(|path| is_indexed(workspace_root, path) && path.to_str().is_some_and(|text| language_for(text).is_some()))
    })
}

/// Below `workspace_root`, outside `.git` and the dependency and build folders.
fn is_indexed(workspace_root: &Path, path: &Path) -> bool {
    let Ok(relative) = path.strip_prefix(workspace_root) else {
        return false;
    };
    !relative.components().any(|component| {
        matches!(component, Component::Normal(name) if name.to_str().is_some_and(|name| SKIPPED_DIRS.contains(&name)))
    })
}

/// A folder with a `.git` directory or file directly inside, i.e. a repository root.
fn has_git_entry(path: &Path) -> bool {
    path.join(".git").exists()
}

fn canonical_or_given(path: &str) -> PathBuf {
    Path::new(path).canonicalize().unwrap_or_else(|_| PathBuf::from(path))
}

/// A repository whose git dir is not `<root>/.git`: a linked work tree (its
/// git dir is in the main repository) or an absorbed submodule (in the
/// parent's `.git/modules`). `(git dir, <root>/.git)`.
pub type GitDirLink = (PathBuf, PathBuf);

fn git_dir_links(repo_roots: &[PathBuf]) -> Vec<GitDirLink> {
    repo_roots
        .iter()
        .filter_map(|repo_root| {
            let repo = Repository::open(repo_root).ok()?;
            let git_dir = repo.path().canonicalize().ok()?;
            let own = repo_root.join(".git");
            (git_dir != own).then_some((git_dir, own))
        })
        .collect()
}

/// `path` inside a linked git dir, rewritten as the same path below its
/// repository's `.git`, so `attribute` gives the change to that repository.
pub fn relink(path: &Path, links: &[GitDirLink]) -> Option<PathBuf> {
    links
        .iter()
        .filter(|(git_dir, _)| path.starts_with(git_dir))
        .max_by_key(|(git_dir, _)| git_dir.components().count())
        .and_then(|(git_dir, own)| path.strip_prefix(git_dir).ok().map(|rest| own.join(rest)))
}

/// The repository each submodule-like repository sits in, when that one has a
/// `.gitmodules`: its status shows the submodule, so it refreshes with it.
fn submodule_parents(repo_roots: &[PathBuf]) -> Vec<Option<usize>> {
    repo_roots
        .iter()
        .map(|repo_root| {
            repo_roots
                .iter()
                .enumerate()
                .filter(|(_, candidate)| *candidate != repo_root && repo_root.starts_with(candidate))
                .max_by_key(|(_, candidate)| candidate.components().count())
                .map(|(index, _)| index)
                .filter(|&index| repo_roots[index].join(".gitmodules").is_file())
        })
        .collect()
}

/// Adds a work tree change for the parent of every changed submodule.
pub fn with_submodule_parents(mut repos: Vec<(usize, bool, bool)>, parents: &[Option<usize>]) -> Vec<(usize, bool, bool)> {
    let changed: Vec<usize> = repos.iter().map(|(index, _, _)| *index).collect();
    for index in changed {
        let Some(parent) = parents.get(index).copied().flatten() else {
            continue;
        };
        match repos.iter_mut().find(|(candidate, _, _)| *candidate == parent) {
            Some(entry) => entry.2 = true,
            None => repos.push((parent, false, true)),
        }
    }
    repos.sort_by_key(|(index, _, _)| *index);
    repos
}

fn watch_error(err: impl std::fmt::Display) -> AppError {
    AppError::invalid(format!("Could not watch workspace: {err}"))
}

/// One recursive watcher on the workspace root, plus the `.git` directory of
/// any repository outside it (a repository enclosing the workspace) and the
/// git dir of a linked work tree whose main repository is elsewhere.
pub fn watch(app: AppHandle, workspace_root: &str, repo_roots: &[String]) -> AppResult<RepoWatcher> {
    let root = canonical_or_given(workspace_root);
    let canonical_roots: Vec<PathBuf> = repo_roots.iter().map(|repo_root| canonical_or_given(repo_root)).collect();
    let outside_git_dirs: Vec<PathBuf> = canonical_roots
        .iter()
        .filter(|repo_root| !repo_root.starts_with(&root))
        .map(|repo_root| repo_root.join(".git"))
        .filter(|git_dir| git_dir.is_dir())
        .collect();
    let links = git_dir_links(&canonical_roots);
    let parents = submodule_parents(&canonical_roots);
    // Linked git dirs outside everything else watched (a work tree of a repository elsewhere).
    let linked_git_dirs: Vec<PathBuf> = links
        .iter()
        .map(|(git_dir, _)| git_dir.clone())
        .filter(|git_dir| !git_dir.starts_with(&root) && !outside_git_dirs.iter().any(|outside| git_dir.starts_with(outside)))
        .collect();

    let workspace_root_owned = workspace_root.to_string();
    let repo_paths = repo_roots.to_vec();
    let roots = canonical_roots.clone();
    let watched_root = root.clone();
    let handler = move |result: DebounceEventResult| {
        let Ok(events) = result else {
            return;
        };
        let changes = || events.iter().map(|event| (&event.kind, event.paths.as_slice()));
        if adds_or_removes_files(&watched_root, changes()) {
            app.state::<AppState>().file_search.mark_stale();
        } else if edits_source_files(&watched_root, changes()) {
            app.state::<AppState>().file_search.mark_contents_changed();
        }
        let relinked: Vec<(EventKind, Vec<PathBuf>)> = events
            .iter()
            .map(|event| {
                let paths = event.paths.iter().map(|path| relink(path, &links).unwrap_or_else(|| path.clone())).collect();
                (event.kind, paths)
            })
            .collect();
        // Opened lazily for this batch only.
        let mut repos: HashMap<usize, Option<Repository>> = HashMap::new();
        let attribution = attribute(
            &roots,
            relinked.iter().map(|(kind, paths)| (kind, paths.as_slice())),
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
        for (index, git_dir, work_tree) in with_submodule_parents(attribution.repos, &parents) {
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
    };
    let mut debouncer =
        new_debouncer_opt(Duration::from_millis(300), None, handler, NoCache, notify::Config::default()).map_err(watch_error)?;

    debouncer.watch(&root, RecursiveMode::Recursive).map_err(watch_error)?;
    for git_dir in outside_git_dirs.iter().chain(&linked_git_dirs) {
        debouncer.watch(git_dir, RecursiveMode::Recursive).map_err(watch_error)?;
    }
    Ok(debouncer)
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use notify_debouncer_full::notify::event::{CreateKind, DataChange, EventKind, ModifyKind, RemoveKind, RenameMode};

    use super::{
        adds_or_removes_files, attribute, edits_source_files, git_dir_links, has_git_entry, relink, submodule_parents,
        with_submodule_parents, Attribution,
    };
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
    fn only_created_removed_or_renamed_files_outdate_the_file_index() {
        let check = |events: &[(EventKind, Vec<PathBuf>)]| {
            adds_or_removes_files(Path::new("/w/build/app"), events.iter().map(|(kind, paths)| (kind, paths.as_slice())))
        };
        // The workspace itself may live below a folder named like a skipped one.
        assert!(check(&[(CREATE_FILE, paths(&["/w/build/app/src/new.ts"]))]));
        assert!(check(&[(REMOVE_DIR, paths(&["/w/build/app/src"]))]));
        assert!(check(&[(RENAME, paths(&["/w/build/app/a.ts", "/w/build/app/b.ts"]))]));
        assert!(!check(&[(MODIFY, paths(&["/w/build/app/src/a.ts"]))]));
        assert!(!check(&[(CREATE_FILE, paths(&["/w/build/app/.git/index.lock"]))]));
        assert!(!check(&[(CREATE_FILE, paths(&["/w/build/app/node_modules/x/index.js"]))]));
        assert!(!check(&[(CREATE_FILE, paths(&["/w/build/app/target/debug/out"]))]));
        assert!(!check(&[(CREATE_FILE, paths(&["/elsewhere/.git/HEAD"]))]));
    }

    #[test]
    fn only_edited_source_files_outdate_the_symbol_index() {
        let check = |events: &[(EventKind, Vec<PathBuf>)]| {
            edits_source_files(Path::new("/w"), events.iter().map(|(kind, paths)| (kind, paths.as_slice())))
        };
        assert!(check(&[(MODIFY, paths(&["/w/src/cart.ts"]))]));
        assert!(check(&[(MODIFY, paths(&["/w/README.md", "/w/lib/Cart.PHP"]))]));
        assert!(!check(&[(MODIFY, paths(&["/w/README.md"]))]));
        assert!(!check(&[(MODIFY, paths(&["/w/node_modules/x/index.js"]))]));
        assert!(!check(&[(MODIFY, paths(&["/w/.git/index"]))]));
        assert!(!check(&[(MODIFY, paths(&["/elsewhere/a.ts"]))]));
        assert!(!check(&[(CREATE_FILE, paths(&["/w/src/new.ts"]))]));
    }

    #[test]
    fn linked_git_dirs_are_read_as_their_repository_git_dir() {
        let links = vec![
            (PathBuf::from("/main/.git/worktrees/wt"), PathBuf::from("/w/wt/.git")),
            (PathBuf::from("/w/app/.git/modules/lib"), PathBuf::from("/w/app/lib/.git")),
        ];
        assert_eq!(relink(Path::new("/main/.git/worktrees/wt/index"), &links), Some(PathBuf::from("/w/wt/.git/index")));
        assert_eq!(relink(Path::new("/w/app/.git/modules/lib/HEAD"), &links), Some(PathBuf::from("/w/app/lib/.git/HEAD")));
        assert_eq!(relink(Path::new("/w/app/.git/index"), &links), None);
        assert_eq!(relink(Path::new("/main/.git/worktrees/other/HEAD"), &links), None);

        // Relinked, a work tree commit refreshes the work tree, not the main repository.
        let roots = paths(&["/w/app", "/w/app/lib", "/w/wt"]);
        let relinked = [relink(Path::new("/main/.git/worktrees/wt/index"), &links).unwrap()];
        let result = attribute(&roots, [(&MODIFY, &relinked[..])], |_, _| false, |_| false);
        assert_eq!(result.repos, vec![(2, true, false)]);
    }

    #[test]
    fn a_changed_submodule_refreshes_its_parent() {
        let parents = [None, Some(0), None];
        assert_eq!(with_submodule_parents(vec![(1, false, true)], &parents), vec![(0, false, true), (1, false, true)]);
        assert_eq!(with_submodule_parents(vec![(0, true, false), (1, true, false)], &parents), vec![(0, true, true), (1, true, false)]);
        assert_eq!(with_submodule_parents(vec![(2, true, true)], &parents), vec![(2, true, true)]);
    }

    #[test]
    fn finds_links_and_parents_on_disk() {
        let dir = TestDir::new();
        let main = dir.init_repo("main");
        dir.write("main/.gitmodules", "");
        let plain = dir.init_repo("main/plain");
        crate::test_support::git_in(&main, &["-c", "user.name=T", "-c", "user.email=t@e", "commit", "-q", "--allow-empty", "-m", "base"]);
        let worktree = dir.file("wt");
        crate::test_support::git_in(&main, &["worktree", "add", "-q", "-b", "wt", &worktree.to_string_lossy()]);
        let roots = vec![main.clone(), plain.clone(), worktree.clone()];
        let links = git_dir_links(&roots);
        assert_eq!(links.len(), 1, "{links:?}");
        assert_eq!(links[0].1, worktree.join(".git"));
        assert!(links[0].0.ends_with(".git/worktrees/wt"));
        assert_eq!(submodule_parents(&roots), vec![None, Some(0), None]);
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
