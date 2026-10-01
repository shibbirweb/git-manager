use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::{blocking, outcome, OpOutcome};
use crate::error::{AppError, AppResult};
use crate::git::cli;
use crate::git::repo as git_repo;
use crate::git::status::head_info;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress<'a> {
    repo_path: &'a str,
    line: &'a str,
}

fn stream(app: &AppHandle, repo_path: &str, args: &[&str]) -> AppResult<cli::GitOutput> {
    cli::run_streaming(Path::new(repo_path), args, |line| {
        let _ = app.emit("git-progress", Progress { repo_path, line });
    })
}

#[tauri::command]
pub async fn fetch_all(app: AppHandle, repo_path: String) -> AppResult<OpOutcome> {
    blocking(move || {
        let output = stream(&app, &repo_path, &["fetch", "--all", "--prune", "--progress"])?;
        Ok(OpOutcome {
            output: output.text(),
            conflicts: false,
        })
    })
    .await
}

#[tauri::command]
pub async fn pull(app: AppHandle, repo_path: String) -> AppResult<OpOutcome> {
    blocking(move || {
        let result = stream(&app, &repo_path, &["pull", "--progress"]);
        outcome(&repo_path, result)
    })
    .await
}

/// Pushes the current branch, setting its upstream on first push.
#[tauri::command]
pub async fn push(app: AppHandle, repo_path: String, force: bool) -> AppResult<OpOutcome> {
    blocking(move || {
        let repo = git_repo::open(&repo_path)?;
        let head = head_info(&repo);
        let branch = head
            .branch
            .clone()
            .ok_or_else(|| AppError::invalid("Cannot push a detached HEAD"))?;
        let mut args = vec!["push", "--progress"];
        if force {
            args.push("--force-with-lease");
        }
        let remote_name;
        if head.upstream.is_none() {
            let remotes = repo.remotes()?;
            let names: Vec<&str> = remotes.iter().filter_map(|name| name.ok().flatten()).collect();
            remote_name = if names.contains(&"origin") {
                "origin".to_string()
            } else {
                names
                    .first()
                    .map(|name| name.to_string())
                    .ok_or_else(|| AppError::invalid("This repository has no remote to push to"))?
            };
            args.extend(["-u", remote_name.as_str(), branch.as_str()]);
        }
        let output = stream(&app, &repo_path, &args)?;
        Ok(OpOutcome {
            output: output.text(),
            conflicts: false,
        })
    })
    .await
}
