//! Opening a folder as a workspace, like src-tauri/src/commands/workspace.rs: its repositories, found the same way.

use serde::Deserialize;

use crate::error::AppResult;
use crate::git::repo::RepoInfo;
use crate::git::workspace::{self, WorkspaceInfo};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenWorkspaceArgs {
    folder_path: String,
}

pub fn open_workspace(args: OpenWorkspaceArgs) -> AppResult<WorkspaceInfo> {
    workspace::open(&args.folder_path)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverRepositoriesArgs {
    workspace_root: String,
}

/// Scan for Repositories: one workspace folder looked through again.
pub fn discover_repositories(args: DiscoverRepositoriesArgs) -> AppResult<Vec<RepoInfo>> {
    workspace::discover_repositories(&args.workspace_root)
}
