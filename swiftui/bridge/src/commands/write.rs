//! Stage, unstage, commit and the commit toast's Undo, shaped like the Tauri commands in
//! src-tauri/src/commands/status.rs and reflog.rs. Writes go through the shared git CLI code (git/cli.rs), so
//! hooks, signing and config behave as in the terminal and in the current app.

use std::path::Path;

use git2::Oid;
use serde::Deserialize;

use super::commit_options::CommitOptions;
use crate::error::{AppError, AppResult};
use crate::git::cli::{self, GitOutput};
use crate::git::reflog::{self, LastAction};
use crate::git::repo as git_repo;
use crate::git::status;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FilesArgs {
    repo_path: String,
    file_paths: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RepoArgs {
    repo_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CommitArgs {
    repo_path: String,
    message: String,
    amend: bool,
    options: Option<CommitOptions>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MoveHeadBackArgs {
    repo_path: String,
    head_id: String,
    commit_id: String,
    mode: String,
}

/// `git add -A` of the paths (new and deleted files too); many paths fold into their folders first.
pub(super) fn stage_files(args: FilesArgs) -> AppResult<()> {
    let pathspecs = status::pathspecs_for(&git_repo::open(&args.repo_path)?, &args.file_paths)?;
    cli::run_with_pathspecs(Path::new(&args.repo_path), &["add", "-A"], &pathspecs)?;
    Ok(())
}

pub(super) fn unstage_files(args: FilesArgs) -> AppResult<()> {
    let repo = git_repo::open(&args.repo_path)?;
    let root = Path::new(&args.repo_path);
    let pathspecs = status::pathspecs_for(&repo, &args.file_paths)?;
    if repo.head().is_ok() {
        cli::run_with_pathspecs(root, &["restore", "--staged"], &pathspecs)?;
    } else {
        // No HEAD to restore from in a fresh repository.
        cli::run_with_pathspecs(root, &["rm", "--cached", "-r", "-q"], &pathspecs)?;
    }
    Ok(())
}

/// `git commit` of the staged changes, amending HEAD when asked; an empty message with amend keeps the old one.
pub(super) fn commit(args: CommitArgs) -> AppResult<GitOutput> {
    run_commit(args, false)
}

/// Commit All: stages every tracked change first (`--all`); untracked files stay out.
pub(super) fn commit_all(args: CommitArgs) -> AppResult<GitOutput> {
    run_commit(args, true)
}

fn run_commit(args: CommitArgs, all: bool) -> AppResult<GitOutput> {
    let root = Path::new(&args.repo_path);
    let extra = args.options.unwrap_or_default().args()?;
    let mut command = vec!["commit"];
    command.extend(extra.iter().map(String::as_str));
    if all {
        command.push("--all");
    }
    if args.amend {
        command.push("--amend");
    }
    if args.message.trim().is_empty() && args.amend {
        command.push("--no-edit");
        cli::run(root, &command)
    } else {
        command.extend(["-F", "-"]);
        cli::run_with_stdin(root, &command, args.message.as_bytes())
    }
}

/// HEAD's full message ("" in a fresh repository), for Amend's prefilled box.
pub(super) fn get_head_message(args: RepoArgs) -> AppResult<String> {
    let repo = git_repo::open(&args.repo_path)?;
    let message = repo
        .head()
        .ok()
        .and_then(|head| head.peel_to_commit().ok())
        .and_then(|commit| commit.message().ok().map(str::to_string))
        .unwrap_or_default();
    Ok(message)
}

/// The latest HEAD movement, for the commit toast's Undo.
pub(super) fn last_action(args: RepoArgs) -> AppResult<LastAction> {
    reflog::last_action(&git_repo::open(&args.repo_path)?)
}

fn parse_commit(commit_id: &str, what: &str) -> AppResult<Oid> {
    let commit_id = commit_id.trim();
    if commit_id.starts_with('-') {
        return Err(AppError::invalid(format!("{what} cannot start with '-': {commit_id}")));
    }
    Oid::from_str(commit_id).map_err(|_| AppError::invalid(format!("{what} is not a commit id: {commit_id}")))
}

/// Moves the branch back to `commitId` while HEAD still points at `headId`, so an Undo offered a while ago never
/// undoes something newer. Only the soft mode the commit toast uses: the undone changes stay staged.
pub(super) fn move_head_back(args: MoveHeadBackArgs) -> AppResult<String> {
    if args.mode != "soft" {
        return Err(AppError::invalid(format!("Unknown undo mode: {}", args.mode)));
    }
    let expected = parse_commit(&args.head_id, "The current commit")?;
    let target = parse_commit(&args.commit_id, "The commit to go back to")?;
    {
        let repo = git_repo::open(&args.repo_path)?;
        let current = repo.head().ok().and_then(|head| head.target());
        if current != Some(expected) {
            return Err(AppError::invalid("The repository changed since then, so this can no longer be undone"));
        }
        if repo.state() != git2::RepositoryState::Clean {
            return Err(AppError::invalid("Finish or abort the operation in progress first"));
        }
        repo.find_commit(target)
            .map_err(|_| AppError::invalid(format!("The commit {} is not in this repository", args.commit_id)))?;
    }
    cli::run(Path::new(&args.repo_path), &["reset", "--soft", &target.to_string(), "--"])?;
    Ok("soft".to_string())
}
