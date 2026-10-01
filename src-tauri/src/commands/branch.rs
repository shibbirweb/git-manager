use std::path::Path;

use super::{blocking, run_op, OpOutcome};
use crate::error::AppResult;
use crate::git::cli;
use crate::git::refs::{self, Refs};
use crate::git::repo as git_repo;

#[tauri::command]
pub async fn get_refs(repo_path: String) -> AppResult<Refs> {
    blocking(move || refs::read(&git_repo::open(&repo_path)?)).await
}

#[tauri::command]
pub async fn checkout_branch(repo_path: String, branch_name: String) -> AppResult<()> {
    blocking(move || {
        cli::run(Path::new(&repo_path), &["switch", &branch_name])?;
        Ok(())
    })
    .await
}

/// Checks out a remote branch as a new tracking branch, or switches to the
/// existing local branch of the same name.
#[tauri::command]
pub async fn checkout_remote_branch(repo_path: String, remote_branch: String, local_name: String) -> AppResult<()> {
    blocking(move || {
        let root = Path::new(&repo_path);
        let repo = git_repo::open(&repo_path)?;
        if repo.find_branch(&local_name, git2::BranchType::Local).is_ok() {
            cli::run(root, &["switch", &local_name])?;
        } else {
            cli::run(root, &["switch", "-c", &local_name, "--track", &remote_branch])?;
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn create_branch(
    repo_path: String,
    branch_name: String,
    start_point: Option<String>,
    checkout: bool,
) -> AppResult<()> {
    blocking(move || {
        let root = Path::new(&repo_path);
        let mut args = if checkout {
            vec!["switch", "-c", branch_name.as_str()]
        } else {
            vec!["branch", branch_name.as_str()]
        };
        if let Some(start) = start_point.as_deref() {
            args.push(start);
        }
        cli::run(root, &args)?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn rename_branch(repo_path: String, branch_name: String, new_name: String) -> AppResult<()> {
    blocking(move || {
        cli::run(Path::new(&repo_path), &["branch", "-m", &branch_name, &new_name])?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn delete_branch(repo_path: String, branch_name: String, force: bool) -> AppResult<()> {
    blocking(move || {
        let flag = if force { "-D" } else { "-d" };
        cli::run(Path::new(&repo_path), &["branch", flag, &branch_name])?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn merge_branch(repo_path: String, branch_name: String) -> AppResult<OpOutcome> {
    blocking(move || run_op(&repo_path, &["merge", "--no-edit", &branch_name])).await
}

#[tauri::command]
pub async fn rebase_onto(repo_path: String, branch_name: String) -> AppResult<OpOutcome> {
    blocking(move || run_op(&repo_path, &["rebase", &branch_name])).await
}
