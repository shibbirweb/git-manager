use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Emitter, State};

use super::blocking;
use crate::error::AppResult;
use crate::state::AppState;
use crate::terminal::{self, ShellProfile, TerminalExitedEvent, TerminalInfo};

#[tauri::command]
pub async fn terminal_shells() -> AppResult<Vec<ShellProfile>> {
    blocking(|| Ok(terminal::shell_profiles())).await
}

/// Output goes to `output` as raw bytes (an ArrayBuffer in JS), exit as a "terminal-exited" event.
#[tauri::command]
pub async fn terminal_spawn(
    app: AppHandle,
    state: State<'_, AppState>,
    shell_id: Option<String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    output: Channel<InvokeResponseBody>,
) -> AppResult<TerminalInfo> {
    let terminals = state.terminals.clone();
    blocking(move || {
        terminal::start_terminal(
            &terminals,
            shell_id.as_deref(),
            cwd.as_deref(),
            cols,
            rows,
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

/// Runs on every keystroke: it only queues the bytes for the terminal's writer thread,
/// so it stays a cheap synchronous command and keeps keystrokes in order.
#[tauri::command]
pub fn terminal_write(state: State<'_, AppState>, terminal_id: u32, data: String) {
    state.terminals.write(terminal_id, data.into_bytes());
}

#[tauri::command]
pub fn terminal_resize(state: State<'_, AppState>, terminal_id: u32, cols: u16, rows: u16) -> AppResult<()> {
    state.terminals.resize(terminal_id, cols, rows)
}

#[tauri::command]
pub async fn terminal_close(state: State<'_, AppState>, terminal_id: u32) -> AppResult<()> {
    let terminals = state.terminals.clone();
    blocking(move || {
        terminals.close(terminal_id);
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn terminal_close_all(state: State<'_, AppState>) -> AppResult<()> {
    let terminals = state.terminals.clone();
    blocking(move || {
        terminals.close_all();
        Ok(())
    })
    .await
}
