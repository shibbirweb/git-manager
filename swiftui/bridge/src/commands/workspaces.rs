//! Opening a folder as a workspace, like src-tauri/src/commands/workspace.rs: its repositories, found the same way,
//! a repository started in a folder without one, and workspace files (src-tauri/src/workspace_file.rs).

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

/// Initialize Repository in a folder without one (git init through the CLI, as the Tauri command does).
pub fn init_repository(args: OpenWorkspaceArgs) -> AppResult<RepoInfo> {
    workspace::init(&args.folder_path)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadWorkspaceFileArgs {
    file_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteWorkspaceFileArgs {
    file_path: String,
    folders: Vec<String>,
}

/// Open Workspace from File: the folders it lists that exist, and the ones that do not.
pub fn read_workspace_file(args: ReadWorkspaceFileArgs) -> AppResult<crate::workspace_file::WorkspaceFile> {
    crate::workspace_file::read(std::path::Path::new(&args.file_path))
}

/// Save Workspace to File: the folders, kept relative to the file where they share a parent.
pub fn write_workspace_file(args: WriteWorkspaceFileArgs) -> AppResult<()> {
    crate::workspace_file::write(std::path::Path::new(&args.file_path), &args.folders)
}
