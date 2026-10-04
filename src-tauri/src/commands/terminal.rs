use serde::Serialize;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{State, Window};

use super::blocking;
use crate::error::AppResult;
use crate::state::AppState;
use crate::terminal::{self, ShellProfile, TerminalInfo};

/// The last message on a terminal's output channel; None when the shell was killed or its code is unknown.
#[derive(Debug, Serialize)]
struct TerminalExitMessage {
    exit: Option<i32>,
}

/// A terminal's or a run's output callback: merged output as raw bytes (an ArrayBuffer in JS).
pub(crate) fn send_output(output: Channel<InvokeResponseBody>) -> impl FnMut(Vec<u8>) + Send + 'static {
    move |bytes: Vec<u8>| {
        let _ = output.send(InvokeResponseBody::Raw(bytes));
    }
}

/// A terminal's or a run's exit callback: `{ exit }` as a JSON message, after every byte of output.
pub(crate) fn send_exit(output: Channel<InvokeResponseBody>) -> impl FnOnce(u32, Option<i32>) + Send + 'static {
    move |_terminal_id: u32, exit_code: Option<i32>| {
        if let Ok(json) = serde_json::to_string(&TerminalExitMessage { exit: exit_code }) {
            let _ = output.send(InvokeResponseBody::Json(json));
        }
    }
}

#[tauri::command]
pub async fn terminal_shells() -> AppResult<Vec<ShellProfile>> {
    blocking(|| Ok(terminal::shell_profiles())).await
}

/// Output goes to `output` as raw bytes, then the exit as `{ exit }` (see `send_output` and `send_exit`).
/// The view acknowledges written output with `terminal_ack`.
#[tauri::command]
pub async fn terminal_spawn(
    window: Window,
    state: State<'_, AppState>,
    shell_id: Option<String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    output: Channel<InvokeResponseBody>,
) -> AppResult<TerminalInfo> {
    let terminals = state.terminals.clone();
    let window_label = window.label().to_string();
    blocking(move || {
        let on_output = send_output(output.clone());
        let info =
            terminal::start_terminal(&terminals, shell_id.as_deref(), cwd.as_deref(), cols, rows, on_output, send_exit(output))?;
        terminals.adopt(info.terminal_id, &window_label);
        Ok(info)
    })
    .await
}

/// Runs on every keystroke: it only queues the bytes for the terminal's writer thread,
/// so it stays a cheap synchronous command and keeps keystrokes in order.
#[tauri::command]
pub fn terminal_write(state: State<'_, AppState>, terminal_id: u32, data: String) {
    state.terminals.write(terminal_id, data.into_bytes());
}

/// The view wrote `byte_count` more bytes of output (sent about every 128 KB), so a
/// terminal paused by flow control can read on. Cheap and synchronous, like `terminal_write`.
#[tauri::command]
pub fn terminal_ack(state: State<'_, AppState>, terminal_id: u32, byte_count: usize) {
    state.terminals.ack(terminal_id, byte_count);
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

/// Closes the asking window's terminals and runs (it reloaded); other windows keep theirs.
#[tauri::command]
pub async fn terminal_close_all(window: Window, state: State<'_, AppState>) -> AppResult<()> {
    let terminals = state.terminals.clone();
    let window_label = window.label().to_string();
    blocking(move || {
        terminals.close_window(&window_label);
        Ok(())
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::TerminalExitMessage;

    #[test]
    fn the_exit_message_matches_the_view() {
        // TerminalExitMessage in src/lib/types.ts.
        let json = |exit_code| serde_json::to_string(&TerminalExitMessage { exit: exit_code }).unwrap();
        assert_eq!(json(Some(3)), r#"{"exit":3}"#);
        assert_eq!(json(None), r#"{"exit":null}"#);
    }
}
