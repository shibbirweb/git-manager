//! The native app's MCP server, so `git-manager cli` and AI tools can drive and measure it the way they do the
//! current app. It speaks the same JSON-RPC over HTTP on 127.0.0.1 with a bearer token, and its tools carry the
//! current app's names and result shapes (git_status, get_memory_usage, sample_memory, take_screenshot,
//! get_app_info), so one command measures either app. Like the current app it follows Settings > Automation:
//! off until the MCP server or the command line tool is switched on, on the chosen port (`server`).
//!
//! It writes `~/.gitmanager-native/.gitmanager/mcp.json`, never the real app's file, so
//! `HOME=~/.gitmanager-native git-manager cli ...` reaches this app and plain `git-manager cli` keeps reaching
//! the current one. Tools that need the window (the `app` tool, the screenshot, the open folder) are answered by
//! Swift through the handler given to [`start`].
//!
//! Parts: `server` (switches, port, token and the listener), `http` (requests and responses), `protocol`
//! (JSON-RPC), `tools` and `memory_tools`.

mod backend;
mod dialog_tools;
mod http;
mod memory_tools;
mod protocol;
mod server;
mod tools;

use std::ffi::{c_char, CStr, CString};
use std::path::PathBuf;
use std::sync::OnceLock;

use serde_json::Value;

pub use server::{configure, regenerate_token, status, ControlStatus, Switches};

/// Swift's answer to a UI request: a malloc'd JSON string the server frees.
pub type UiHandler = extern "C" fn(request_json: *const c_char) -> *mut c_char;

const VERSION: &str = env!("CARGO_PKG_VERSION");
/// Like the real app: ~/.gitmanager-native stands in for the home folder, so the CLI's own
/// `$HOME/.gitmanager/mcp.json` lookup finds this file when HOME points there.
const NATIVE_HOME: &str = ".gitmanager-native";

struct Server {
    handler: UiHandler,
}

static SERVER: OnceLock<Server> = OnceLock::new();

/// Keeps Swift's handler for the UI tools; the server starts once `configure` switches it on.
pub fn install(handler: UiHandler) {
    let _ = SERVER.set(Server { handler });
}

pub fn config_dir() -> Option<PathBuf> {
    let home = std::env::var_os("HOME").filter(|home| !home.is_empty())?;
    Some(PathBuf::from(home).join(NATIVE_HOME).join(".gitmanager"))
}

/// Asks the Swift side; its reply is `{"ok":bool,"text":...,"structured":{...}}`.
fn ask_ui(server: &Server, request: Value) -> Result<Value, String> {
    let request = CString::new(request.to_string()).map_err(|err| err.to_string())?;
    let raw = (server.handler)(request.as_ptr());
    if raw.is_null() {
        return Err("The app did not answer".to_string());
    }
    // SAFETY: the handler returns a NUL-terminated string from malloc (strdup), freed once here.
    let text = unsafe { CStr::from_ptr(raw) }.to_string_lossy().into_owned();
    unsafe { libc::free(raw as *mut libc::c_void) };
    let reply: Value =
        serde_json::from_str(&text).map_err(|err| format!("The app's answer is not JSON: {err}"))?;
    if reply["ok"].as_bool() != Some(true) {
        return Err(reply["text"].as_str().unwrap_or("The app could not do that").to_string());
    }
    Ok(reply)
}
