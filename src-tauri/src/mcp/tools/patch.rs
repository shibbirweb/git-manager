//! Unified diffs for agents, read with git2 like the rest of the app's reads. The app's own
//! diff views load both texts instead (git/diff.rs), which an agent cannot use as well.

use git2::{Diff, DiffFindOptions, DiffFormat, DiffOptions, Repository, Tree};

use crate::git::repo::resolve_commit;

pub const DEFAULT_MAX_BYTES: usize = 200_000;
pub const MAX_BYTES: usize = 1_000_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiffMode {
    /// Index to work tree, untracked files included.
    Unstaged,
    /// HEAD to index.
    Staged,
    /// HEAD to work tree: everything not committed.
    Head,
    /// A commit against its first parent.
    Commit,
    /// One revision against another.
    Range,
}

impl DiffMode {
    pub fn parse(mode: &str) -> Result<DiffMode, String> {
        match mode {
            "unstaged" => Ok(DiffMode::Unstaged),
            "staged" => Ok(DiffMode::Staged),
            "head" => Ok(DiffMode::Head),
            "commit" => Ok(DiffMode::Commit),
            "range" => Ok(DiffMode::Range),
            other => Err(format!("Unknown diff mode: {other}")),
        }
    }
}

pub struct DiffRequest<'a> {
    pub mode: DiffMode,
    pub commit_id: Option<&'a str>,
    pub from: Option<&'a str>,
    pub to: Option<&'a str>,
    /// Repo-relative paths; empty means the whole repository.
    pub file_paths: &'a [String],
    pub context_lines: u32,
    pub max_bytes: usize,
}

pub struct PatchText {
    pub text: String,
    pub files_changed: usize,
    pub insertions: usize,
    pub deletions: usize,
    pub truncated: bool,
}

fn head_tree(repo: &Repository) -> Option<Tree<'_>> {
    repo.head().ok().and_then(|head| head.peel_to_tree().ok())
}

fn tree_of<'repo>(repo: &'repo Repository, revision: &str) -> Result<Tree<'repo>, String> {
    resolve_commit(repo, revision)
        .and_then(|commit| Ok(commit.tree()?))
        .map_err(|err| err.to_string())
}

fn build<'repo>(repo: &'repo Repository, request: &DiffRequest) -> Result<Diff<'repo>, String> {
    let mut options = DiffOptions::new();
    options.context_lines(request.context_lines);
    for file_path in request.file_paths {
        options.pathspec(file_path);
    }
    if !request.file_paths.is_empty() {
        options.disable_pathspec_match(true);
    }
    let git_err = |err: git2::Error| err.to_string();
    let mut diff = match request.mode {
        DiffMode::Unstaged => {
            options
                .include_untracked(true)
                .recurse_untracked_dirs(true)
                .show_untracked_content(true);
            repo.diff_index_to_workdir(None, Some(&mut options)).map_err(git_err)?
        }
        DiffMode::Staged => repo
            .diff_tree_to_index(head_tree(repo).as_ref(), None, Some(&mut options))
            .map_err(git_err)?,
        DiffMode::Head => {
            options
                .include_untracked(true)
                .recurse_untracked_dirs(true)
                .show_untracked_content(true);
            repo.diff_tree_to_workdir_with_index(head_tree(repo).as_ref(), Some(&mut options))
                .map_err(git_err)?
        }
        DiffMode::Commit => {
            let commit_id = request.commit_id.ok_or("commitId is needed for mode \"commit\"")?;
            let commit = resolve_commit(repo, commit_id).map_err(|err| err.to_string())?;
            let parent_tree = commit.parent(0).ok().and_then(|parent| parent.tree().ok());
            let tree = commit.tree().map_err(git_err)?;
            repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut options))
                .map_err(git_err)?
        }
        DiffMode::Range => {
            let from = request.from.ok_or("from is needed for mode \"range\"")?;
            let from_tree = tree_of(repo, from)?;
            let to_tree = tree_of(repo, request.to.unwrap_or("HEAD"))?;
            repo.diff_tree_to_tree(Some(&from_tree), Some(&to_tree), Some(&mut options))
                .map_err(git_err)?
        }
    };
    if request.mode != DiffMode::Unstaged && request.mode != DiffMode::Head {
        let mut find = DiffFindOptions::new();
        find.renames(true);
        diff.find_similar(Some(&mut find)).map_err(git_err)?;
    }
    Ok(diff)
}

/// The patch text, cut at `max_bytes` (on a line boundary).
pub fn unified(repo: &Repository, request: &DiffRequest) -> Result<PatchText, String> {
    let diff = build(repo, request)?;
    let stats = diff.stats().map_err(|err| err.to_string())?;
    let mut text = String::new();
    let mut truncated = false;
    let printed = diff.print(DiffFormat::Patch, |_delta, _hunk, line| {
        let content = String::from_utf8_lossy(line.content());
        let origin = line.origin();
        let extra = usize::from(matches!(origin, '+' | '-' | ' '));
        if text.len() + content.len() + extra > request.max_bytes {
            truncated = true;
            return false;
        }
        if extra == 1 {
            text.push(origin);
        }
        text.push_str(&content);
        true
    });
    // Stopping at the limit makes print report a user cancel, which is expected.
    if let Err(err) = printed {
        if !truncated {
            return Err(err.to_string());
        }
    }
    Ok(PatchText {
        text,
        files_changed: stats.files_changed(),
        insertions: stats.insertions(),
        deletions: stats.deletions(),
        truncated,
    })
}

/// A header with the counts, then the patch.
pub fn render(patch: &PatchText) -> String {
    if patch.files_changed == 0 {
        return "No changes.".to_string();
    }
    let mut out = format!(
        "{} file(s) changed, {} insertion(s), {} deletion(s)\n\n{}",
        patch.files_changed, patch.insertions, patch.deletions, patch.text
    );
    if patch.truncated {
        out.push_str("\n[Diff cut off at the size limit. Ask for fewer files or raise maxBytes.]\n");
    }
    out
}
