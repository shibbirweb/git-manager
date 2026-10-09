//! The server's switches and life (src-tauri/src/mcp/mod.rs `configure`): nothing listens while the MCP server and
//! the command line tool are both off; on, it listens on 127.0.0.1 at the chosen port, restarting when the port
//! changes. The token stays in mcp.json between runs (New Token replaces it); the port and process id are there
//! only while it listens, so the command line tool finds it.

use std::io::ErrorKind;
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, RwLock};
use std::thread::JoinHandle;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::json;

use super::{config_dir, http};

const MAX_CONNECTIONS: usize = 16;
const TOKEN_BYTES: usize = 32;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Switches {
    /// The MCP server switch (AI tools).
    pub enabled: bool,
    /// The command line tool switch.
    pub cli_enabled: bool,
    pub port: u16,
}

/// What Settings > Automation shows (the current app's McpStatus, without the install fields).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ControlStatus {
    pub enabled: bool,
    pub cli_enabled: bool,
    pub running: bool,
    pub port: u16,
    pub url: String,
    pub token: Option<String>,
    pub error: Option<String>,
}

struct Running {
    port: u16,
    requested_port: u16,
    stop: Arc<AtomicBool>,
    accept: Option<JoinHandle<()>>,
}

struct Slot {
    switches: Switches,
    running: Option<Running>,
    error: Option<String>,
}

static SLOT: Mutex<Slot> = Mutex::new(Slot { switches: Switches { enabled: false, cli_enabled: false, port: 0 },
    running: None, error: None });
static TOKEN: RwLock<Option<String>> = RwLock::new(None);
static SWITCHES: RwLock<Switches> = RwLock::new(Switches { enabled: false, cli_enabled: false, port: 0 });
static LIVE: AtomicUsize = AtomicUsize::new(0);

fn slot() -> MutexGuard<'static, Slot> {
    SLOT.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub(super) fn token() -> Option<String> {
    TOKEN.read().map(|token| token.clone()).unwrap_or_default()
}

pub(super) fn switches() -> Switches {
    SWITCHES.read().map(|switches| *switches).unwrap_or_default()
}

/// Applies both switches and the port: starts, restarts or stops the server.
pub fn configure(next: Switches) -> ControlStatus {
    let mut slot = slot();
    slot.switches = next;
    slot.error = None;
    if let Ok(mut switches) = SWITCHES.write() {
        *switches = next;
    }
    if !next.enabled && !next.cli_enabled {
        stop_locked(&mut slot);
        return status_locked(&slot);
    }
    if next.port != 0 && next.port < 1024 {
        stop_locked(&mut slot);
        slot.error = Some("Choose a port from 1024 to 65535".to_string());
        return status_locked(&slot);
    }
    if let Err(err) = ensure_token() {
        stop_locked(&mut slot);
        slot.error = Some(format!("Could not save the MCP token: {err}"));
        return status_locked(&slot);
    }
    let same_port = slot.running.as_ref().is_some_and(|running| running.requested_port == next.port);
    if !same_port {
        stop_locked(&mut slot);
        match start(next.port) {
            Ok(running) => {
                if let Err(err) = write_file(Some(running.port)) {
                    slot.error = Some(format!("Could not write mcp.json: {err}"));
                }
                slot.running = Some(running);
            }
            Err(message) => slot.error = Some(message),
        }
    }
    status_locked(&slot)
}

pub fn status() -> ControlStatus {
    status_locked(&slot())
}

/// A new token: tools connected with the old one must be set up again.
pub fn regenerate_token() -> Result<ControlStatus, String> {
    let token = new_token()?;
    if let Ok(mut slot) = TOKEN.write() {
        *slot = Some(token);
    }
    let slot = slot();
    write_file(slot.running.as_ref().map(|running| running.port))
        .map_err(|err| format!("Could not save the MCP token: {err}"))?;
    Ok(status_locked(&slot))
}

fn status_locked(slot: &Slot) -> ControlStatus {
    let port = slot.running.as_ref().map(|running| running.port).unwrap_or(slot.switches.port);
    ControlStatus {
        enabled: slot.switches.enabled,
        cli_enabled: slot.switches.cli_enabled,
        running: slot.running.is_some(),
        port,
        url: format!("http://127.0.0.1:{port}/mcp"),
        token: token(),
        error: slot.error.clone(),
    }
}

fn start(port: u16) -> Result<Running, String> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, port)).map_err(|err| match err.kind() {
        ErrorKind::AddrInUse => format!("Port {port} is already in use. Choose another port in Settings."),
        _ => format!("Could not listen on port {port}: {err}"),
    })?;
    let bound = listener.local_addr().map_err(|err| err.to_string())?.port();
    let stop = Arc::new(AtomicBool::new(false));
    let accept = {
        let stop = stop.clone();
        std::thread::Builder::new()
            .name("control-accept".into())
            .spawn(move || accept_loop(listener, stop))
            .map_err(|err| err.to_string())?
    };
    Ok(Running { port: bound, requested_port: port, stop, accept: Some(accept) })
}

fn accept_loop(listener: TcpListener, stop: Arc<AtomicBool>) {
    for stream in listener.incoming() {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        let Ok(stream) = stream else {
            continue;
        };
        if LIVE.load(Ordering::Relaxed) >= MAX_CONNECTIONS {
            continue;
        }
        LIVE.fetch_add(1, Ordering::Relaxed);
        std::thread::spawn(move || {
            let _ = http::serve(stream);
            LIVE.fetch_sub(1, Ordering::Relaxed);
        });
    }
}

fn stop_locked(slot: &mut Slot) {
    if let Some(mut running) = slot.running.take() {
        running.stop.store(true, Ordering::SeqCst);
        // A connection to ourselves unblocks accept().
        let address = SocketAddr::from((Ipv4Addr::LOCALHOST, running.port));
        let _ = TcpStream::connect_timeout(&address, Duration::from_secs(1));
        if let Some(accept) = running.accept.take() {
            let _ = accept.join();
        }
        let _ = write_file(None);
    }
}

/// The token from mcp.json, or a new one written there.
fn ensure_token() -> Result<String, String> {
    if let Some(token) = token() {
        return Ok(token);
    }
    let token = match read_file_token() {
        Some(token) => token,
        None => {
            let token = new_token()?;
            if let Ok(mut slot) = TOKEN.write() {
                *slot = Some(token.clone());
            }
            write_file(None)?;
            token
        }
    };
    if let Ok(mut slot) = TOKEN.write() {
        *slot = Some(token.clone());
    }
    Ok(token)
}

fn read_file_token() -> Option<String> {
    let text = std::fs::read_to_string(config_dir()?.join("mcp.json")).ok()?;
    let file: serde_json::Value = serde_json::from_str(&text).ok()?;
    let token = file["token"].as_str()?;
    let valid = token.len() == TOKEN_BYTES * 2 && token.bytes().all(|byte| byte.is_ascii_hexdigit());
    valid.then(|| token.to_string())
}

fn new_token() -> Result<String, String> {
    let mut bytes = [0u8; TOKEN_BYTES];
    getrandom::fill(&mut bytes).map_err(|err| format!("Could not make a random token: {err}"))?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

/// mcp.json: the token, plus the port and process id while listening. Mode 0600 from the start.
fn write_file(port: Option<u16>) -> Result<(), String> {
    let Some(token) = token() else {
        return Ok(());
    };
    let dir = config_dir().ok_or("Could not find your home folder")?;
    std::fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let mut file = json!({ "token": token });
    if let Some(port) = port {
        file["port"] = json!(port);
        file["pid"] = json!(std::process::id());
    }
    let path = dir.join("mcp.json");
    let temp = dir.join(".mcp.json.tmp");
    let _ = std::fs::remove_file(&temp);
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut handle = options.open(&temp).map_err(|err| err.to_string())?;
    std::io::Write::write_all(&mut handle, format!("{file:#}\n").as_bytes()).map_err(|err| err.to_string())?;
    drop(handle);
    std::fs::rename(&temp, &path).map_err(|err| err.to_string())
}
