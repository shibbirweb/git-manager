//! The native app's MCP server, so `git-manager cli` and AI tools can drive and measure it the way
//! they do the current app. It speaks the same JSON-RPC over HTTP on 127.0.0.1 with a bearer token,
//! and its tools carry the current app's names and result shapes (git_status, get_memory_usage,
//! sample_memory, take_screenshot, get_app_info), so one command measures either app.
//!
//! It writes `~/.gitmanager-native/.gitmanager/mcp.json`, never the real app's file, so
//! `HOME=~/.gitmanager-native git-manager cli ...` reaches this app and plain `git-manager cli`
//! keeps reaching the current one. Tools that need the window (the `app` tool, the screenshot's
//! window number, the open folder) are answered by Swift through the handler given to
//! [`start`].

use std::collections::BTreeMap;
use std::ffi::{c_char, CStr, CString};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use base64::Engine;
use serde_json::{json, Map, Value};

use crate::git::repo as git_repo;
use crate::git::status;
use crate::memory::{self, mb, MemoryUsage};

/// Swift's answer to a UI request: a malloc'd JSON string the server frees.
pub type UiHandler = extern "C" fn(request_json: *const c_char) -> *mut c_char;

const PROTOCOL_VERSIONS: [&str; 3] = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_NAME: &str = "git-manager-native";
const VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_HEADER_BYTES: usize = 16 * 1024;
const MAX_BODY_BYTES: usize = 4 * 1024 * 1024;
const MAX_CONNECTIONS: usize = 16;
const MAX_SAMPLE_MS: u64 = 60_000;
const MIN_INTERVAL_MS: u64 = 100;
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
                let _ = serve(stream);
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

// --- HTTP ---

struct Request {
    method: String,
    path: String,
    headers: BTreeMap<String, String>,
    body: Vec<u8>,
}

fn serve(stream: TcpStream) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(30)))?;
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut stream = stream;
    let request = match read_request(&mut reader) {
        Ok(request) => request,
        Err(status) => return respond(&mut stream, status, &json!({ "error": reason(status) })),
    };
    let Some(server) = SERVER.get() else {
        return respond(&mut stream, 503, &json!({ "error": "Not ready" }));
    };
    if request.path != "/mcp" {
        return respond(&mut stream, 404, &json!({ "error": "Not found" }));
    }
    if request.method != "POST" {
        return respond(&mut stream, 405, &json!({ "error": "Use POST" }));
    }
    let given = request
        .headers
        .get("authorization")
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or_default();
    if !tokens_match(&server.token, given) {
        return respond(&mut stream, 401, &json!({ "error": "Missing or wrong token" }));
    }
    let message: Value = match serde_json::from_slice(&request.body) {
        Ok(message) => message,
        Err(_) => {
            let reply = json!({ "jsonrpc": "2.0", "id": null, "error": { "code": -32700, "message": "Parse error" } });
            return respond(&mut stream, 200, &reply);
        }
    };
    match handle_message(server, &message) {
        Some(reply) => respond(&mut stream, 200, &reply),
        None => respond_empty(&mut stream, 202),
    }
}

fn read_request(reader: &mut BufReader<TcpStream>) -> Result<Request, u16> {
    let mut head = String::new();
    loop {
        let mut line = String::new();
        let read = reader.read_line(&mut line).map_err(|_| 400u16)?;
        if read == 0 {
            return Err(400);
        }
        head.push_str(&line);
        if head.len() > MAX_HEADER_BYTES {
            return Err(431);
        }
        if line == "\r\n" || line == "\n" {
            break;
        }
    }
    let mut lines = head.lines();
    let mut first = lines.next().unwrap_or_default().split_whitespace();
    let method = first.next().unwrap_or_default().to_string();
    let path = first.next().unwrap_or_default().to_string();
    let headers: BTreeMap<String, String> = lines
        .filter_map(|line| line.split_once(':'))
        .map(|(name, value)| (name.trim().to_ascii_lowercase(), value.trim().to_string()))
        .collect();
    let length: usize = headers.get("content-length").and_then(|value| value.parse().ok()).unwrap_or(0);
    if length > MAX_BODY_BYTES {
        return Err(413);
    }
    let mut body = vec![0u8; length];
    reader.read_exact(&mut body).map_err(|_| 400u16)?;
    Ok(Request { method, path, headers, body })
}

/// Same length and every byte equal, without stopping at the first difference.
fn tokens_match(expected: &str, given: &str) -> bool {
    expected.len() == given.len() && expected.bytes().zip(given.bytes()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0
}

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        202 => "Accepted",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        405 => "Method Not Allowed",
        413 => "Payload Too Large",
        431 => "Request Header Fields Too Large",
        _ => "Service Unavailable",
    }
}

fn respond(stream: &mut TcpStream, status: u16, body: &Value) -> std::io::Result<()> {
    let text = body.to_string();
    write!(
        stream,
        "HTTP/1.1 {status} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{text}",
        reason(status),
        text.len()
    )?;
    stream.flush()
}

fn respond_empty(stream: &mut TcpStream, status: u16) -> std::io::Result<()> {
    write!(stream, "HTTP/1.1 {status} {}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n", reason(status))?;
    stream.flush()
}

// --- JSON-RPC ---

fn handle_message(server: &Server, message: &Value) -> Option<Value> {
    let id = message.get("id").cloned()?;
    let method = message["method"].as_str().unwrap_or_default();
    let params = &message["params"];
    let result = match method {
        "initialize" => Ok(initialize(params)),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(json!({ "tools": TOOLS.iter().map(listed).collect::<Vec<_>>() })),
        "tools/call" => Ok(call_tool(server, params)),
        _ => Err(json!({ "code": -32601, "message": format!("Unknown method: {method}") })),
    };
    Some(match result {
        Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
        Err(error) => json!({ "jsonrpc": "2.0", "id": id, "error": error }),
    })
}

fn initialize(params: &Value) -> Value {
    let asked = params["protocolVersion"].as_str().unwrap_or_default();
    let version = PROTOCOL_VERSIONS.iter().find(|known| **known == asked).copied().unwrap_or(PROTOCOL_VERSIONS[0]);
    json!({
        "protocolVersion": version,
        "capabilities": { "tools": { "listChanged": false } },
        "serverInfo": { "name": SERVER_NAME, "title": "Git Manager Native", "version": VERSION },
        "instructions": "Git Manager Native, the SwiftUI experiment. Tools match the current app's names and results where both have them.",
        "_meta": { "gitManager/mcpEnabled": true, "gitManager/cliEnabled": true },
    })
}

// --- Tools ---

enum Output {
    Json(Value),
    Image { png_base64: String, caption: String },
}

type ToolResult = Result<Output, String>;

struct Tool {
    name: &'static str,
    title: &'static str,
    description: &'static str,
    category: &'static str,
    read_only: bool,
    schema: fn() -> Value,
    run: fn(&Server, &Map<String, Value>) -> ToolResult,
}

const TOOLS: &[Tool] = &[
    Tool {
        name: "get_app_info",
        title: "App info",
        description: "Which app this is (Git Manager Native), its version and process id.",
        category: "workspace",
        read_only: true,
        schema: no_args,
        run: get_app_info,
    },
    Tool {
        name: "app",
        title: "Drive the app",
        description: "Reads or changes what the native app shows. action: get_state (the open folder, its branch and changed files, the window size) or open_folder (folderPath).",
        category: "ui",
        read_only: false,
        schema: app_schema,
        run: app,
    },
    Tool {
        name: "git_status",
        title: "Git status",
        description: "The current branch, its upstream and ahead/behind counts, any merge or rebase in progress, and every changed file with its staged and unstaged state.",
        category: "git",
        read_only: true,
        schema: repo_only,
        run: git_status,
    },
    Tool {
        name: "get_memory_usage",
        title: "Memory usage",
        description: "Memory used right now by Git Manager Native, as Activity Monitor counts it (the same method as the current app).",
        category: "performance",
        read_only: true,
        schema: no_args,
        run: get_memory_usage,
    },
    Tool {
        name: "sample_memory",
        title: "Sample memory",
        description: "Measures memory every intervalMs for durationMs (at most 60 s) and returns each sample with the minimum, maximum and average per process.",
        category: "performance",
        read_only: true,
        schema: sample_schema,
        run: sample_memory,
    },
    Tool {
        name: "take_screenshot",
        title: "Screenshot",
        description: "A PNG screenshot of the Git Manager Native window, even when other windows cover it.",
        category: "performance",
        read_only: true,
        schema: no_args,
        run: take_screenshot,
    },
];

fn listed(tool: &Tool) -> Value {
    json!({
        "name": tool.name,
        "title": tool.title,
        "description": tool.description,
        "inputSchema": (tool.schema)(),
        "annotations": { "title": tool.title, "readOnlyHint": tool.read_only, "destructiveHint": false },
        "_meta": {
            "gitManager/category": tool.category,
            "gitManager/kind": if tool.category == "ui" { "ui" } else { "backend" },
            "gitManager/enabled": true,
            "gitManager/defaultEnabled": true,
        },
    })
}

fn call_tool(server: &Server, params: &Value) -> Value {
    let name = params["name"].as_str().unwrap_or_default();
    let args = params["arguments"].as_object().cloned().unwrap_or_default();
    let output = match TOOLS.iter().find(|tool| tool.name == name) {
        Some(tool) => (tool.run)(server, &args),
        None => Err(format!("Unknown tool: {name}")),
    };
    tool_result(output)
}

/// The result shape of the current app's `mcp::protocol::tool_result`.
fn tool_result(output: ToolResult) -> Value {
    let text_block = |text: &str| json!({ "type": "text", "text": text });
    match output {
        Ok(Output::Json(value)) => {
            let text = serde_json::to_string_pretty(&value).unwrap_or_default();
            let mut result = json!({ "content": [text_block(&text)], "isError": false });
            if value.is_object() {
                result["structuredContent"] = value;
            }
            result
        }
        Ok(Output::Image { png_base64, caption }) => json!({
            "content": [{ "type": "image", "data": png_base64, "mimeType": "image/png" }, text_block(&caption)],
            "isError": false,
        }),
        Err(message) => json!({ "content": [text_block(&message)], "isError": true }),
    }
}

fn object(properties: Value, required: &[&str]) -> Value {
    json!({ "type": "object", "properties": properties, "required": required, "additionalProperties": false })
}

fn no_args() -> Value {
    object(json!({}), &[])
}

fn repo_only() -> Value {
    object(
        json!({ "repoPath": { "type": "string", "description": "Absolute path of the repository (default: the folder open in the app)." } }),
        &[],
    )
}

fn app_schema() -> Value {
    object(
        json!({
            "action": { "type": "string", "enum": ["get_state", "open_folder"], "description": "What to do." },
            "folderPath": { "type": "string", "description": "open_folder: absolute path of the folder to open." },
        }),
        &["action"],
    )
}

fn sample_schema() -> Value {
    object(
        json!({
            "durationMs": { "type": "integer", "description": format!("How long to sample (default 5000, at most {MAX_SAMPLE_MS}).") },
            "intervalMs": { "type": "integer", "description": format!("Time between samples (default 500, at least {MIN_INTERVAL_MS}).") },
        }),
        &[],
    )
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
    let reply: Value = serde_json::from_str(&text).map_err(|err| format!("The app's answer is not JSON: {err}"))?;
    if reply["ok"].as_bool() != Some(true) {
        return Err(reply["text"].as_str().unwrap_or("The app could not do that").to_string());
    }
    Ok(reply)
}

fn get_app_info(_server: &Server, _args: &Map<String, Value>) -> ToolResult {
    Ok(Output::Json(json!({
        "name": "Git Manager Native",
        "version": VERSION,
        "pid": std::process::id(),
        "bundleId": "shibbirweb.github.io.gitmanager.native",
        "ui": "SwiftUI",
    })))
}

fn app(server: &Server, args: &Map<String, Value>) -> ToolResult {
    let action = args.get("action").and_then(Value::as_str).ok_or("action is required")?;
    let reply = ask_ui(server, json!({ "action": action, "args": args }))?;
    Ok(Output::Json(reply["structured"].clone()))
}

fn git_status(server: &Server, args: &Map<String, Value>) -> ToolResult {
    let repo_path = match args.get("repoPath").and_then(Value::as_str) {
        Some(repo_path) => repo_path.to_string(),
        None => ask_ui(server, json!({ "action": "get_state" }))?["structured"]["repoPath"]
            .as_str()
            .map(str::to_string)
            .ok_or("No folder is open; pass repoPath")?,
    };
    let repo = git_repo::open(&repo_path).map_err(|err| err.to_string())?;
    let status = status::read(&repo).map_err(|err| err.to_string())?;
    serde_json::to_value(status).map(Output::Json).map_err(|err| err.to_string())
}

fn get_memory_usage(_server: &Server, _args: &Map<String, Value>) -> ToolResult {
    let usage = memory::usage();
    let mut value = json!(usage);
    value["totalMb"] = json!(mb(usage.total_bytes));
    Ok(Output::Json(value))
}

fn u64_arg(args: &Map<String, Value>, key: &str, default: u64) -> Result<u64, String> {
    match args.get(key) {
        None | Some(Value::Null) => Ok(default),
        Some(value) => value.as_u64().ok_or_else(|| format!("{key} must be a whole number")),
    }
}

#[derive(Default)]
struct Stats {
    min: u64,
    max: u64,
    sum: u64,
    count: u64,
}

impl Stats {
    fn add(&mut self, bytes: u64) {
        self.min = if self.count == 0 { bytes } else { self.min.min(bytes) };
        self.max = self.max.max(bytes);
        self.sum += bytes;
        self.count += 1;
    }

    fn to_json(&self) -> Value {
        let avg = self.sum.checked_div(self.count).unwrap_or(0);
        json!({ "minBytes": self.min, "maxBytes": self.max, "avgBytes": avg, "minMb": mb(self.min), "maxMb": mb(self.max), "avgMb": mb(avg) })
    }
}

/// Same output as the current app's sample_memory (src-tauri/src/mcp/tools/performance.rs).
fn sample_memory(_server: &Server, args: &Map<String, Value>) -> ToolResult {
    let duration = Duration::from_millis(u64_arg(args, "durationMs", 5000)?.min(MAX_SAMPLE_MS));
    let interval = Duration::from_millis(u64_arg(args, "intervalMs", 500)?.max(MIN_INTERVAL_MS));
    let started = Instant::now();
    let mut samples: Vec<MemoryUsage> = Vec::new();
    let mut offsets = Vec::new();
    loop {
        offsets.push(started.elapsed().as_millis() as u64);
        samples.push(memory::usage());
        let next = interval * samples.len() as u32;
        if next > duration {
            break;
        }
        std::thread::sleep(next.saturating_sub(started.elapsed()));
    }
    let mut total = Stats::default();
    let mut by_process: BTreeMap<String, Stats> = BTreeMap::new();
    for sample in &samples {
        total.add(sample.total_bytes);
        for process in &sample.processes {
            by_process.entry(format!("{} ({})", process.label, process.pid)).or_default().add(process.bytes);
        }
    }
    let rows: Vec<Value> = samples
        .iter()
        .zip(&offsets)
        .map(|(sample, offset)| {
            let processes: Map<String, Value> = sample
                .processes
                .iter()
                .map(|process| (format!("{} ({})", process.label, process.pid), json!(process.bytes)))
                .collect();
            json!({ "atMs": offset, "totalBytes": sample.total_bytes, "processes": processes })
        })
        .collect();
    let processes: Map<String, Value> = by_process.iter().map(|(key, stats)| (key.clone(), stats.to_json())).collect();
    Ok(Output::Json(json!({
        "total": total.to_json(),
        "processes": processes,
        "samples": rows,
        "approximate": samples.iter().any(|sample| sample.approximate),
    })))
}

/// The window as the window server draws it, without its shadow, like the current app's
/// `screencapture -o -l` (src-tauri/src/mcp/host.rs). The app captures its own window, which
/// needs no Screen Recording permission.
fn take_screenshot(server: &Server, _args: &Map<String, Value>) -> ToolResult {
    let reply = ask_ui(server, json!({ "action": "screenshot" }))?;
    let png_base64 = reply["structured"]["pngBase64"].as_str().filter(|data| !data.is_empty()).ok_or("The app sent no image")?;
    let png = base64::engine::general_purpose::STANDARD.decode(png_base64).map_err(|err| err.to_string())?;
    let caption = match png.get(16..24) {
        Some(header) => {
            let width = u32::from_be_bytes([header[0], header[1], header[2], header[3]]);
            let height = u32::from_be_bytes([header[4], header[5], header[6], header[7]]);
            format!("Screenshot of the Git Manager Native window, {width}x{height} pixels.")
        }
        None => "Screenshot of the Git Manager Native window.".to_string(),
    };
    Ok(Output::Image { png_base64: png_base64.to_string(), caption })
}
