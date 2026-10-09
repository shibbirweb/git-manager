//! The branches, shaped like the Tauri commands in src-tauri/src/commands/branch.rs: the refs the header's branch
//! menu lists, and switching to a local branch through the git CLI as every write does.

use std::path::Path;

use serde::Deserialize;

use crate::error::AppResult;
use crate::git::cli;
use crate::git::refs::{self, Refs};
use crate::git::repo as git_repo;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RefsArgs {
    repo_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CheckoutArgs {
    repo_path: String,
    branch_name: String,
}

pub(super) fn get_refs(args: RefsArgs) -> AppResult<Refs> {
    refs::read(&git_repo::open(&args.repo_path)?)
}

pub(super) fn checkout_branch(args: CheckoutArgs) -> AppResult<()> {
    cli::run(Path::new(&args.repo_path), &["switch", &args.branch_name])?;
    Ok(())
}
