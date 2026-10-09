//! Remotes for Git > GitHub (src-tauri/src/commands/remote.rs list_remotes, push_with_options and fetch_all): the
//! same git calls, repeated here because those helpers sit in a Tauri file the bridge does not build. Progress
//! lines go to a slot the app reads with `git_progress`, as Clone's do.

use std::path::Path;
use std::sync::Mutex;

use git2::Repository;
use serde::{Deserialize, Serialize};

use super::reject_option;
use crate::error::{AppError, AppResult};
use crate::git::cli;
use crate::git::repo as git_repo;
use crate::git::status::head_info;

static PROGRESS: Mutex<String> = Mutex::new(String::new());

/// A configured remote with its URLs.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteInfo {
    name: String,
    fetch_url: Option<String>,
    push_url: Option<String>,
    default_branch: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct OpOutcome {
    output: String,
    conflicts: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RepoArgs {
    repo_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PushArgs {
    repo_path: String,
    remote_name: String,
    remote_branch: String,
    #[serde(default)]
    force_with_lease: bool,
    #[serde(default)]
    push_tags: bool,
}

pub(super) fn list_remotes_command(args: RepoArgs) -> AppResult<Vec<RemoteInfo>> {
    read_remotes(&git_repo::open(&args.repo_path)?)
}

/// The Tauri command's shape, for src-tauri's MCP tool git_remotes.
pub async fn list_remotes(repo_path: String) -> AppResult<Vec<RemoteInfo>> {
    read_remotes(&git_repo::open(&repo_path)?)
}

/// Pushes the current branch to `remote_name`/`remote_branch`, tracking it on first push (the Push dialog's call).
pub(super) fn push_with_options(args: PushArgs) -> AppResult<OpOutcome> {
    let remote_name = args.remote_name.trim();
    let remote_branch = args.remote_branch.trim();
    let remote_branch = remote_branch.strip_prefix("refs/heads/").unwrap_or(remote_branch);
    if remote_name.is_empty() {
        return Err(AppError::invalid("Choose a remote to push to"));
    }
    if remote_branch.is_empty() {
        return Err(AppError::invalid("Enter the remote branch name"));
    }
    reject_option(remote_name, "A remote name")?;
    reject_option(remote_branch, "A branch name")?;
    let repo = git_repo::open(&args.repo_path)?;
    let head = head_info(&repo);
    let branch = head.branch.clone().ok_or_else(|| AppError::invalid("Cannot push a detached HEAD"))?;
    let mut git_args = vec!["push", "--progress"];
    if args.force_with_lease {
        git_args.push("--force-with-lease");
    }
    if args.push_tags {
        git_args.push("--tags");
    }
    if head.upstream.is_none() {
        git_args.push("-u");
    }
    let refspec = format!("refs/heads/{branch}:refs/heads/{remote_branch}");
    git_args.push(remote_name);
    git_args.push(&refspec);
    stream(&args.repo_path, &git_args)
}

/// Fetches every remote and prunes deleted branches (the Git menu's Fetch All Remotes).
pub(super) fn fetch_all(args: RepoArgs) -> AppResult<OpOutcome> {
    stream(&args.repo_path, &["fetch", "--progress", "--all", "--prune"])
}

/// The last progress line of the running push or fetch.
pub(super) fn git_progress() -> AppResult<String> {
    Ok(PROGRESS.lock().map(|line| line.clone()).unwrap_or_default())
}

fn stream(repo_path: &str, args: &[&str]) -> AppResult<OpOutcome> {
    set_progress("");
    let result = cli::run_streaming(Path::new(repo_path), args, &mut |line: &str| set_progress(line));
    set_progress("");
    result.map(|output| OpOutcome { output: output.text(), conflicts: false })
}

fn set_progress(line: &str) {
    if let Ok(mut slot) = PROGRESS.lock() {
        *slot = line.to_string();
    }
}

fn read_remotes(repo: &Repository) -> AppResult<Vec<RemoteInfo>> {
    let names = repo.remotes()?;
    let mut remotes = Vec::new();
    for remote_name in names.iter().flatten().flatten() {
        let Ok(remote) = repo.find_remote(remote_name) else {
            continue;
        };
        let fetch_url = remote.url().ok().map(str::to_string);
        let push_url = remote.pushurl().ok().flatten().map(str::to_string).or_else(|| fetch_url.clone());
        let prefix = format!("refs/remotes/{remote_name}/");
        let default_branch = repo
            .find_reference(&format!("{prefix}HEAD"))
            .ok()
            .and_then(|reference| reference.symbolic_target().ok().flatten().map(str::to_string))
            .and_then(|target| target.strip_prefix(&prefix).map(str::to_string));
        remotes.push(RemoteInfo { name: remote_name.to_string(), fetch_url, push_url, default_branch });
    }
    Ok(remotes)
}
