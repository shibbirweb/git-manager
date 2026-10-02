//! The MCP server and command line tool switches (see mcp/mod.rs).

use std::collections::HashMap;

use tauri::State;

use super::blocking;
use crate::error::AppResult;
use crate::mcp::dto::{McpActivity, McpStatus, McpToolInfo, McpUiResult, McpUiToolDef};
use crate::state::AppState;

/// Starts, restarts or stops the server: it runs while either switch is on.
#[tauri::command]
pub async fn mcp_configure(
    state: State<'_, AppState>,
    enabled: bool,
    cli_enabled: bool,
    port: u16,
    tool_states: HashMap<String, bool>,
) -> AppResult<McpStatus> {
    let mcp = state.mcp.clone();
    blocking(move || Ok(mcp.configure(enabled, cli_enabled, port, tool_states))).await
}

#[tauri::command]
pub async fn mcp_status(state: State<'_, AppState>) -> AppResult<McpStatus> {
    let mcp = state.mcp.clone();
    blocking(move || Ok(mcp.status())).await
}

/// Backend tools and the registered UI tools, with their effective on/off state.
#[tauri::command]
pub async fn mcp_tools(state: State<'_, AppState>) -> AppResult<Vec<McpToolInfo>> {
    let mcp = state.mcp.clone();
    blocking(move || Ok(mcp.tools())).await
}

/// Registers the frontend's tools. The valid ones are kept even when Err reports others
/// that were refused (a bad name, or a name another tool already has).
#[tauri::command]
pub fn mcp_register_ui_tools(state: State<'_, AppState>, tools: Vec<McpUiToolDef>) -> AppResult<()> {
    state.mcp.register_ui_tools(tools)
}

#[tauri::command]
pub async fn mcp_set_workspace(state: State<'_, AppState>, folder_paths: Vec<String>) -> AppResult<()> {
    let mcp = state.mcp.clone();
    blocking(move || {
        mcp.set_workspace(&folder_paths);
        Ok(())
    })
    .await
}

/// The frontend's answer to an `mcp-ui-request`; a late answer (after the timeout) is dropped.
#[tauri::command]
pub fn mcp_ui_respond(state: State<'_, AppState>, request_id: u64, result: McpUiResult) {
    state.mcp.ui_respond(request_id, result);
}

#[tauri::command]
pub async fn mcp_regenerate_token(state: State<'_, AppState>) -> AppResult<McpStatus> {
    let mcp = state.mcp.clone();
    blocking(move || mcp.regenerate_token()).await
}

/// The last 50 tool calls, newest last.
#[tauri::command]
pub fn mcp_activity(state: State<'_, AppState>) -> Vec<McpActivity> {
    state.mcp.activity()
}

/// Links `~/.local/bin/git-manager` to this binary.
#[tauri::command]
pub async fn cli_install(state: State<'_, AppState>) -> AppResult<McpStatus> {
    let mcp = state.mcp.clone();
    blocking(move || mcp.install_cli()).await
}

/// Removes `~/.local/bin/git-manager`, only when it is our link.
#[tauri::command]
pub async fn cli_uninstall(state: State<'_, AppState>) -> AppResult<McpStatus> {
    let mcp = state.mcp.clone();
    blocking(move || mcp.uninstall_cli()).await
}

