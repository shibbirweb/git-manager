//! C entry points over the Git Manager backend, for the SwiftUI app in swiftui/Sources/GitManagerNative.
//!
//! The backend modules are the Tauri app's own files, included by path, so src-tauri stays unchanged
//! and both apps run the same git code. Only the command layer is rewritten here (src/commands/),
//! because the Tauri one is tied to tauri::command. Calls look like the page's `invoke`: a command
//! name and camelCase JSON arguments in, JSON out.

#[path = "../../../src-tauri/src/askpass.rs"]
pub mod askpass;
#[path = "../../../src-tauri/src/child_process.rs"]
pub mod child_process;
#[path = "../../../src-tauri/src/error.rs"]
pub mod error;
#[path = "../../../src-tauri/src/git/mod.rs"]
pub mod git;
#[path = "../../../src-tauri/src/git_console.rs"]
pub mod git_console;
#[path = "../../../src-tauri/src/merge/mod.rs"]
pub mod merge;
#[path = "../../../src-tauri/src/paths.rs"]
pub mod paths;

mod commands;
pub mod control;
pub mod memory;

use std::ffi::{c_char, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::Once;

use serde_json::{json, Value};

static SETUP: Once = Once::new();

/// Runs `command` with `args_json` and returns `{"ok":true,"value":...}` or
/// `{"ok":false,"error":{"kind":...,"message":...}}`. The caller frees the result with
/// [`gm_free_string`].
///
/// # Safety
/// Both arguments must be valid NUL-terminated UTF-8 strings (or null).
#[no_mangle]
pub unsafe extern "C" fn gm_call(command: *const c_char, args_json: *const c_char) -> *mut c_char {
    SETUP.call_once(git::repo::configure_libgit2);
    // SAFETY: the caller passes NUL-terminated strings or null, as documented.
    let command = unsafe { text_of(command) };
    let args = unsafe { text_of(args_json) };
    let reply = catch_unwind(AssertUnwindSafe(|| run(&command, &args))).unwrap_or_else(|_| {
        failure("panic", format!("{command} stopped with an internal error"))
    });
    CString::new(reply.to_string()).map_or(std::ptr::null_mut(), CString::into_raw)
}

/// Starts the control (MCP) server once; `ui_handler` answers the requests that need the window.
/// Returns the port, or -1 when the server could not start (the reason goes to stderr).
#[no_mangle]
pub extern "C" fn gm_control_start(ui_handler: control::UiHandler) -> i32 {
    SETUP.call_once(git::repo::configure_libgit2);
    match control::start(ui_handler) {
        Ok(port) => i32::from(port),
        Err(message) => {
            eprintln!("Git Manager Native: the control server did not start: {message}");
            -1
        }
    }
}

/// Frees a string returned by [`gm_call`].
///
/// # Safety
/// `text` must come from `gm_call` and be freed only once.
#[no_mangle]
pub unsafe extern "C" fn gm_free_string(text: *mut c_char) {
    if !text.is_null() {
        // SAFETY: the pointer came from CString::into_raw in gm_call.
        drop(unsafe { CString::from_raw(text) });
    }
}

unsafe fn text_of(pointer: *const c_char) -> String {
    if pointer.is_null() {
        return String::new();
    }
    // SAFETY: checked for null above; the caller guarantees NUL termination.
    unsafe { CStr::from_ptr(pointer) }.to_string_lossy().into_owned()
}

fn run(command: &str, args: &str) -> Value {
    let args: Value = if args.trim().is_empty() {
        Value::Object(Default::default())
    } else {
        match serde_json::from_str(args) {
            Ok(value) => value,
            Err(err) => {
                return failure("invalid", format!("{command}: arguments are not JSON: {err}"));
            }
        }
    };
    match commands::dispatch(command, args) {
        Ok(value) => json!({ "ok": true, "value": value }),
        Err(err) => json!({ "ok": false, "error": err }),
    }
}

fn failure(kind: &str, message: String) -> Value {
    json!({ "ok": false, "error": { "kind": kind, "message": message } })
}
