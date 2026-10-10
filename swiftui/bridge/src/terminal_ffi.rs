//! The integrated terminal over the current app's own PTY code (src-tauri/src/terminal.rs, by path): the same
//! shell detection, environment, output merging, flow control and kill rules. A shell's output reaches Swift through
//! a C callback on the terminal's sender thread; writes, acks, resizes and closes are plain `gm_call` commands.

use std::ffi::{c_char, c_void, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::OnceLock;

use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::{AppError, AppResult};
use crate::terminal::{self, ShellProfile, TerminalInfo, TerminalRegistry};

/// Gets each output message (`exited` false), then once the exit (`exited` true, `exit_code` i32::MIN when the
/// shell was killed or its code is unknown), always after the last output.
pub type OutputCallback = extern "C" fn(
    context: *mut c_void,
    terminal_id: u32,
    bytes: *const u8,
    length: usize,
    exit_code: i32,
    exited: bool,
);

/// Every terminal of the app; the shells are hung up by `terminal_shutdown` when the app quits.
pub fn registry() -> &'static TerminalRegistry {
    static REGISTRY: OnceLock<TerminalRegistry> = OnceLock::new();
    REGISTRY.get_or_init(TerminalRegistry::default)
}

/// The caller's context pointer, handed back on the sender thread. Swift keeps what it points at alive until the
/// exit message.
#[derive(Clone, Copy)]
struct Context(*mut c_void);

// SAFETY: the pointer is only passed back to the callback, which the caller made safe to call from any thread.
unsafe impl Send for Context {}

impl Context {
    fn get(self) -> *mut c_void {
        self.0
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnArgs {
    pub shell_id: Option<String>,
    pub cwd: Option<String>,
    pub cols: u16,
    pub rows: u16,
}

/// Starts a shell like the Tauri `terminal_spawn` and answers its `TerminalInfo` as `{"ok":true,"value":...}`, or
/// `{"ok":false,"error":...}`. Free the answer with `gm_free_string`.
///
/// # Safety
/// `args_json` must be a valid NUL-terminated UTF-8 string (or null); `callback` must be safe to call from any
/// thread with `context` until it has been called with `exited` true.
#[no_mangle]
pub unsafe extern "C" fn gm_terminal_spawn(
    args_json: *const c_char,
    callback: OutputCallback,
    context: *mut c_void,
) -> *mut c_char {
    // SAFETY: the caller passes a NUL-terminated string or null, as documented.
    let args = unsafe { crate::text_of(args_json) };
    let context = Context(context);
    let reply = catch_unwind(AssertUnwindSafe(|| match spawn(&args, callback, context) {
        Ok(info) => json!({ "ok": true, "value": info }),
        Err(err) => json!({ "ok": false, "error": err }),
    }))
    .unwrap_or_else(|_| json!({ "ok": false, "error": { "kind": "panic", "message": "The terminal did not start" } }));
    CString::new(reply.to_string()).map_or(std::ptr::null_mut(), CString::into_raw)
}

fn spawn(args: &str, callback: OutputCallback, context: Context) -> AppResult<TerminalInfo> {
    let args: SpawnArgs =
        serde_json::from_str(args).map_err(|err| AppError::invalid(format!("terminal_spawn: {err}")))?;
    let on_output = move |bytes: Vec<u8>| {
        callback(context.get(), 0, bytes.as_ptr(), bytes.len(), 0, false);
    };
    let on_exit = move |terminal_id: u32, exit_code: Option<i32>| {
        callback(context.get(), terminal_id, std::ptr::null(), 0, exit_code.unwrap_or(i32::MIN), true);
    };
    terminal::start_terminal(
        registry(),
        args.shell_id.as_deref(),
        args.cwd.as_deref(),
        args.cols,
        args.rows,
        on_output,
        on_exit,
    )
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteArgs {
    terminal_id: u32,
    data: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AckArgs {
    terminal_id: u32,
    byte_count: usize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResizeArgs {
    terminal_id: u32,
    cols: u16,
    rows: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloseArgs {
    terminal_id: u32,
}

/// The `gm_call` side: `terminal_shells`, `terminal_write`, `terminal_ack`, `terminal_resize`, `terminal_close` and
/// `terminal_shutdown`, shaped like the Tauri commands. None when `command` is not one of them.
pub fn dispatch(command: &str, args: Value) -> Option<AppResult<Value>> {
    let answer = match command {
        "terminal_shells" => to_value(terminal::shell_profiles()),
        "terminal_write" => parse(command, args).map(|write: WriteArgs| {
            registry().write(write.terminal_id, write.data.into_bytes());
            Value::Null
        }),
        "terminal_ack" => parse(command, args).map(|ack: AckArgs| {
            registry().ack(ack.terminal_id, ack.byte_count);
            Value::Null
        }),
        "terminal_resize" => parse(command, args)
            .and_then(|size: ResizeArgs| registry().resize(size.terminal_id, size.cols, size.rows))
            .map(|()| Value::Null),
        "terminal_close" => parse(command, args).map(|close: CloseArgs| {
            registry().close(close.terminal_id);
            Value::Null
        }),
        "terminal_shutdown" => {
            registry().shutdown();
            Ok(Value::Null)
        }
        _ => return None,
    };
    Some(answer)
}

fn parse<T: serde::de::DeserializeOwned>(command: &str, args: Value) -> AppResult<T> {
    serde_json::from_value(args).map_err(|err| AppError::invalid(format!("{command}: {err}")))
}

fn to_value(profiles: Vec<ShellProfile>) -> AppResult<Value> {
    serde_json::to_value(profiles).map_err(|err| AppError::invalid(err.to_string()))
}
