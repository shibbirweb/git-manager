use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Emitter, State};

use super::blocking;
use crate::error::AppResult;
use crate::run_process::{self, RunRequest};
use crate::state::AppState;
use crate::terminal::{TerminalExitedEvent, TerminalInfo};
use crate::node_versions::{self, NodeInstall};
use crate::scripts::{self, ScriptSource};

/// The Scripts tool window: every runnable script under the workspace folders.
#[tauri::command]
pub async fn list_project_scripts(folder_paths: Vec<String>) -> AppResult<Vec<ScriptSource>> {
    // Opening or refreshing the panel also reads the shell's environment again, for runs.
    run_process::reload_login_env();
    blocking(move || Ok(scripts::list_project_scripts(&folder_paths))).await
}

/// Installed Node versions, newest first, for running a package with the version it asks for.
#[tauri::command]
pub async fn list_node_versions() -> AppResult<Vec<NodeInstall>> {
    blocking(|| Ok(node_versions::installed_here())).await
}

/// Starts a script as its own process (the Run tab). Output and exit arrive like a terminal's:
/// raw bytes on `output`, then a "terminal-exited" event; input and resizing use the terminal commands.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn run_script(
    app: AppHandle,
    state: State<'_, AppState>,
    program: String,
    args: Vec<String>,
    cwd: String,
    node_bin_dir: Option<String>,
    cols: u16,
    rows: u16,
    output: Channel<InvokeResponseBody>,
) -> AppResult<TerminalInfo> {
    let terminals = state.terminals.clone();
    let request = RunRequest {
        program,
        args,
        cwd,
        node_bin_dir,
        cols,
        rows,
    };
    blocking(move || {
        run_process::start_run(
            &terminals,
            &request,
            move |bytes| {
                let _ = output.send(InvokeResponseBody::Raw(bytes.to_vec()));
            },
            move |terminal_id, exit_code| {
                let _ = app.emit("terminal-exited", TerminalExitedEvent { terminal_id, exit_code });
            },
        )
    })
    .await
}
