//! The native app's MCP server, so `git-manager cli` and AI tools can drive and measure it the way they do the
//! current app. It speaks the same JSON-RPC over HTTP on 127.0.0.1 with a bearer token, and its tools carry the
//! current app's names and result shapes (git_status, get_memory_usage, sample_memory, take_screenshot,
//! get_app_info), so one command measures either app.
//!
//! It writes `~/.gitmanager-native/.gitmanager/mcp.json`, never the real app's file, so
//! `HOME=~/.gitmanager-native git-manager cli ...` reaches this app and plain `git-manager cli` keeps reaching
//! the current one. Tools that need the window (the `app` tool, the screenshot, the open folder) are answered by
//! Swift through the handler given to [`start`].
//!
//! Parts: `http` (requests and responses), `protocol` (JSON-RPC), `tools` and `memory_tools`.

mod dialog_tools;
mod http;
mod memory_tools;
mod protocol;
mod tools;

use std::ffi::{c_char, CStr, CString};
use std::net::{Ipv4Addr, TcpListener};
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::OnceLock;

use serde_json::{json, Value};

/// Swift's answer to a UI request: a malloc'd JSON string the server frees.
pub type UiHandler = extern "C" fn(request_json: *const c_char) -> *mut c_char;

const VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_CONNECTIONS: usize = 16;
/// Like the real app: ~/.gitmanager-native stands in for the home folder, so the CLI's own
/// `$HOME/.gitmanager/mcp.json` lookup finds this file when HOME points there.
const NATIVE_HOME: &str = ".gitmanager-native";

struct Server {
    token: String,
    handler: UiHandler,
}

static SERVER: OnceLock<Server> = OnceLock::new();
static LIVE: AtomicUsize = AtomicUsize::new(0);

/// Starts the server once and returns its port, or an error message.
pub fn start(handler: UiHandler) -> Result<u16, String> {
    if SERVER.get().is_some() {
        return Err("The control server is already running".to_string());
    }
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(|err| err.to_string())?;
    let port = listener.local_addr().map_err(|err| err.to_string())?.port();
    let token = new_token()?;
    write_server_file(&token, port)?;
    let _ = SERVER.set(Server { token, handler });
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            if LIVE.load(Ordering::Relaxed) >= MAX_CONNECTIONS {
                continue;
            }
            LIVE.fetch_add(1, Ordering::Relaxed);
            std::thread::spawn(move || {
                let _ = http::serve(stream);
                LIVE.fetch_sub(1, Ordering::Relaxed);
            });
        }
    });
    Ok(port)
}

fn new_token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|err| err.to_string())?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

pub fn config_dir() -> Option<PathBuf> {
    let home = std::env::var_os("HOME").filter(|home| !home.is_empty())?;
    Some(PathBuf::from(home).join(NATIVE_HOME).join(".gitmanager"))
}

fn write_server_file(token: &str, port: u16) -> Result<(), String> {
    let dir = config_dir().ok_or("Could not find your home folder")?;
    std::fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let file = dir.join("mcp.json");
    let text = json!({ "token": token, "port": port, "pid": std::process::id() }).to_string();
    std::fs::write(&file, text).map_err(|err| err.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
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
