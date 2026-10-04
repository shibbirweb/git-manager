//! The command line tool: a client of the running app's MCP server. It finds the server through
//! `~/.gitmanager/mcp.json` and talks only to 127.0.0.1.
//!
//! On macOS and Linux the app runs it as `git-manager cli ...`. On Windows the app is a GUI
//! program with no console, so the installer also ships `git-manager-cli.exe`, a console program
//! built from this crate (src/main.rs), which runs `cli ...` itself and starts the app otherwise.

pub mod home;
pub mod server_file;

use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::Engine;
use serde_json::{json, Map, Value};

use server_file as token;

/// The header that tells the server a request comes from this tool, not an AI harness.
pub const CLIENT_HEADER: &str = "x-git-manager-client";
/// The MCP protocol version this tool asks for (the newest the server speaks; a test in the app checks it).
pub const PROTOCOL_VERSION: &str = "2025-06-18";

pub const EXIT_OK: i32 = 0;
pub const EXIT_TOOL_ERROR: i32 = 1;
pub const EXIT_UNAVAILABLE: i32 = 2;

const MAX_RESPONSE_BYTES: u64 = 64 * 1024 * 1024;
const NOT_RUNNING: &str = "Git Manager is not running, or its MCP server and command line tool are both off.";

const HELP: &str = "Use Git Manager from the command line. The app must be running with the command line tool
turned on in Settings.

Usage: git-manager cli <command> [options]

Commands:
  status                 Is the app running, its server address and which switches are on
  tools [--json] [--all] The tools you can call (--all also lists the ones turned off)
  describe <tool>        A tool's description and arguments
  call <tool> [key=value ...] [--args '<json>'] [--json] [--out <file>]
                         Runs a tool and prints its result
  clone <url> [folder] [--into <dir>] [--open window|workspace]
                         Clones a repository, like git clone, and can open it in the app
  screenshot <file.png>  Saves a screenshot of the app window
  memory [--interval <ms>] [--duration <s>] [--json]
                         Live memory: one line per sample until Ctrl+C (or --duration)

Run git-manager cli <command> --help for details. Exit codes: 0 ok, 1 the tool reported an
error, 2 the app cannot be reached, is switched off, or the command was used wrongly.";

const STATUS_HELP: &str = "Usage: git-manager cli status

Shows whether Git Manager is running, the server address and which switches are on.";

const TOOLS_HELP: &str = "Usage: git-manager cli tools [--json] [--all]

Lists the tools you can call: name, category and what it does.
  --json  Print the full tool list as JSON
  --all   Also list the tools turned off in Git Manager (marked \"off\")";

const DESCRIBE_HELP: &str = "Usage: git-manager cli describe <tool>

Shows a tool's description, whether it changes anything, and its arguments (JSON Schema).";

const CALL_HELP: &str = "Usage: git-manager cli call <tool> [key=value ...] [--args '<json>'] [--json] [--out <file>]

Runs a tool. Each key=value is one argument; the value is read as JSON when it is valid JSON
(numbers, true, false, [\"a\",\"b\"], {...}) and as text otherwise. --args gives the arguments as
one JSON object; key=value pairs win over it.
  --json        Print the structured result as JSON
  --out <file>  Where to save an image result (default: a temporary file, whose path is printed)

Example: git-manager cli call git_log repoPath=\"$PWD\" limit=5";

const CLONE_HELP: &str = "Usage: git-manager cli clone <url> [folder] [--into <dir>] [--open window|workspace]

Clones a repository into a new folder through Git Manager, like Git > Clone, with your git
credentials and settings. It runs the clone_repository tool, which starts turned off: turn it
on in Help > Available MCP Tools.
  folder             Name of the new folder (default: the URL's last part without .git)
  --into <dir>       The folder to clone into (default: the current folder)
  --open window      Open the clone in the Git Manager window, in place of its folders
  --open workspace   Add the clone to the folders open in the window

Example: git-manager cli clone https://github.com/owner/repo.git --open window";

/// A clone may download for a long time; other calls keep the shorter limit.
const CLONE_TIMEOUT: Duration = Duration::from_secs(60 * 60);

const SCREENSHOT_HELP: &str = "Usage: git-manager cli screenshot <file.png>

Saves a PNG screenshot of the Git Manager window (macOS asks for Screen Recording permission
the first time).";

const MEMORY_HELP: &str = "Usage: git-manager cli memory [--interval <ms>] [--duration <s>] [--json]

Prints Git Manager's memory live, one line per sample: the total and each process (the app,
the web content that draws the UI, graphics and networking), like Activity Monitor counts it.
Stops with Ctrl+C, or after --duration seconds with the minimum, average and peak.
  --interval <ms>  Time between samples (default 500, at least 100)
  --duration <s>   Stop after this many seconds and print a summary
  --json           One JSON object per line instead of text";

const DEFAULT_MEMORY_INTERVAL_MS: u64 = 500;
const MIN_MEMORY_INTERVAL_MS: u64 = 100;

#[derive(Debug, Clone, PartialEq)]
pub enum Command {
    Help(&'static str),
    Status,
    Tools { json: bool, all: bool },
    Describe { tool_name: String },
    Call { tool_name: String, arguments: Map<String, Value>, json: bool, out: Option<PathBuf> },
    Clone { url: String, folder_name: Option<String>, into: Option<PathBuf>, open: Option<String> },
    Screenshot { file_path: PathBuf },
    Memory { interval_ms: u64, duration_s: Option<u64>, json: bool },
}

/// A key=value argument: JSON when it parses, text otherwise.
pub fn parse_pair(pair: &str) -> Result<(String, Value), String> {
    let (key, value) = pair
        .split_once('=')
        .ok_or_else(|| format!("Arguments are key=value, got: {pair}"))?;
    if key.is_empty() {
        return Err(format!("An argument needs a name before '=': {pair}"));
    }
    let value = serde_json::from_str::<Value>(value).unwrap_or_else(|_| Value::String(value.to_string()));
    Ok((key.to_string(), value))
}

fn wants_help(args: &[String]) -> bool {
    args.iter().any(|arg| arg == "--help" || arg == "-h")
}

/// Parses the words after `cli`; Err is a usage error.
pub fn parse(args: &[String]) -> Result<Command, String> {
    let Some((command, rest)) = args.split_first() else {
        return Err("Choose a command.".to_string());
    };
    match command.as_str() {
        "--help" | "-h" | "help" => Ok(Command::Help(HELP)),
        "status" => {
            if wants_help(rest) {
                return Ok(Command::Help(STATUS_HELP));
            }
            match rest.first() {
                Some(extra) => Err(format!("status takes no arguments, got: {extra}")),
                None => Ok(Command::Status),
            }
        }
        "tools" => {
            if wants_help(rest) {
                return Ok(Command::Help(TOOLS_HELP));
            }
            let (mut json, mut all) = (false, false);
            for arg in rest {
                match arg.as_str() {
                    "--json" => json = true,
                    "--all" => all = true,
                    other => return Err(format!("Unknown option for tools: {other}")),
                }
            }
            Ok(Command::Tools { json, all })
        }
        "describe" => {
            if wants_help(rest) {
                return Ok(Command::Help(DESCRIBE_HELP));
            }
            match rest {
                [tool_name] if !tool_name.starts_with('-') => Ok(Command::Describe { tool_name: tool_name.clone() }),
                _ => Err("Usage: git-manager cli describe <tool>".to_string()),
            }
        }
        "call" => {
            if wants_help(rest) {
                return Ok(Command::Help(CALL_HELP));
            }
            parse_call(rest)
        }
        "clone" => {
            if wants_help(rest) {
                return Ok(Command::Help(CLONE_HELP));
            }
            parse_clone(rest)
        }
        "screenshot" => {
            if wants_help(rest) {
                return Ok(Command::Help(SCREENSHOT_HELP));
            }
            match rest {
                [file_path] if !file_path.starts_with('-') => Ok(Command::Screenshot { file_path: PathBuf::from(file_path) }),
                _ => Err("Usage: git-manager cli screenshot <file.png>".to_string()),
            }
        }
        "memory" => {
            if wants_help(rest) {
                return Ok(Command::Help(MEMORY_HELP));
            }
            parse_memory(rest)
        }
        other => Err(format!("Unknown command: {other}")),
    }
}

fn parse_clone(rest: &[String]) -> Result<Command, String> {
    let mut positional: Vec<&String> = Vec::new();
    let (mut into, mut open) = (None, None);
    let mut words = rest.iter();
    while let Some(word) = words.next() {
        match word.as_str() {
            "--into" => into = Some(PathBuf::from(words.next().ok_or("--into needs a folder")?)),
            "--open" => {
                let mode = words.next().ok_or("--open needs window or workspace")?;
                if mode != "window" && mode != "workspace" {
                    return Err(format!("--open is window or workspace, got: {mode}"));
                }
                open = Some(mode.clone());
            }
            flag if flag.starts_with("--") => return Err(format!("Unknown option for clone: {flag}")),
            _ => positional.push(word),
        }
    }
    match positional.as_slice() {
        [url] => Ok(Command::Clone { url: (*url).clone(), folder_name: None, into, open }),
        [url, folder_name] => Ok(Command::Clone { url: (*url).clone(), folder_name: Some((*folder_name).clone()), into, open }),
        _ => Err("Usage: git-manager cli clone <url> [folder] [--into <dir>] [--open window|workspace]".to_string()),
    }
}

/// The clone_repository arguments; a relative or missing --into is taken from `current_dir`.
pub fn clone_arguments(url: &str, folder_name: Option<&str>, into: Option<&Path>, open: Option<&str>, current_dir: &Path) -> Map<String, Value> {
    let parent = match into {
        Some(dir) if dir.is_absolute() => dir.to_path_buf(),
        Some(dir) => current_dir.join(dir),
        None => current_dir.to_path_buf(),
    };
    let mut arguments = Map::new();
    arguments.insert("url".to_string(), json!(url));
    arguments.insert("parentPath".to_string(), json!(home::to_ui(&parent)));
    if let Some(folder_name) = folder_name {
        arguments.insert("folderName".to_string(), json!(folder_name));
    }
    if let Some(open) = open {
        arguments.insert("open".to_string(), json!(open));
    }
    arguments
}

fn run_clone(client: Client, arguments: &Map<String, Value>, out: &mut dyn Write, err: &mut dyn Write) -> std::io::Result<i32> {
    let client = client.with_timeout(CLONE_TIMEOUT);
    writeln!(out, "Cloning {}...", arguments["url"].as_str().unwrap_or_default())?;
    out.flush()?;
    let result = match client.call("clone_repository", arguments) {
        Ok(result) => result,
        Err(message) => return writeln!(err, "{message}").map(|_| EXIT_UNAVAILABLE),
    };
    if result["isError"].as_bool().unwrap_or(false) {
        return print_result(out, err, &result, false, None);
    }
    let structured = &result["structuredContent"];
    writeln!(out, "Cloned into {}", structured["clonedPath"].as_str().unwrap_or_default())?;
    if let Some(note) = structured["note"].as_str() {
        writeln!(out, "{note}")?;
    }
    Ok(EXIT_OK)
}

fn parse_memory(rest: &[String]) -> Result<Command, String> {
    let (mut interval_ms, mut duration_s, mut json) = (DEFAULT_MEMORY_INTERVAL_MS, None, false);
    let mut words = rest.iter();
    while let Some(word) = words.next() {
        match word.as_str() {
            "--json" => json = true,
            "--interval" | "--duration" => {
                let value = words
                    .next()
                    .and_then(|value| value.parse::<u64>().ok())
                    .ok_or_else(|| format!("{word} needs a whole number"))?;
                if word == "--interval" {
                    interval_ms = value.max(MIN_MEMORY_INTERVAL_MS);
                } else {
                    duration_s = Some(value.max(1));
                }
            }
            other => return Err(format!("Unknown option for memory: {other}")),
        }
    }
    Ok(Command::Memory { interval_ms, duration_s, json })
}

/// One sample as a line: the time, the total and each process, in MB.
pub fn memory_line(usage: &Value, elapsed_ms: u64) -> String {
    let mb = |bytes: &Value| bytes.as_f64().unwrap_or(0.0) / (1024.0 * 1024.0);
    let mut parts = vec![format!("{:>7.1}s  total {:>7.1} MB", elapsed_ms as f64 / 1000.0, mb(&usage["totalBytes"]))];
    for process in usage["processes"].as_array().map(Vec::as_slice).unwrap_or_default() {
        let label = process["label"].as_str().unwrap_or("process");
        let short = label.split(" (").next().unwrap_or(label);
        parts.push(format!("{short} {:.1}", mb(&process["bytes"])));
    }
    parts.join("  |  ")
}

fn watch_memory(client: &Client, interval_ms: u64, duration_s: Option<u64>, json_output: bool, out: &mut dyn Write) -> std::io::Result<i32> {
    let started = std::time::Instant::now();
    let interval = std::time::Duration::from_millis(interval_ms);
    let mut totals: Vec<f64> = Vec::new();
    let mut count: u32 = 0;
    loop {
        let usage = match client.call("get_memory_usage", &Map::new()) {
            Ok(result) => result["structuredContent"].clone(),
            Err(message) => {
                writeln!(out, "{message}")?;
                return Ok(EXIT_UNAVAILABLE);
            }
        };
        let elapsed_ms = started.elapsed().as_millis() as u64;
        if json_output {
            writeln!(out, "{}", serde_json::json!({ "atMs": elapsed_ms, "usage": usage }))?;
        } else {
            writeln!(out, "{}", memory_line(&usage, elapsed_ms))?;
        }
        out.flush()?;
        totals.push(usage["totalBytes"].as_f64().unwrap_or(0.0) / (1024.0 * 1024.0));
        if duration_s.is_some_and(|seconds| started.elapsed().as_secs() >= seconds) {
            break;
        }
        count += 1;
        std::thread::sleep((interval * count).saturating_sub(started.elapsed()));
    }
    if !json_output && !totals.is_empty() {
        let min = totals.iter().copied().fold(f64::MAX, f64::min);
        let max = totals.iter().copied().fold(0.0, f64::max);
        let avg = totals.iter().sum::<f64>() / totals.len() as f64;
        writeln!(out, "{} samples: total min {min:.1} MB, average {avg:.1} MB, peak {max:.1} MB", totals.len())?;
    }
    Ok(EXIT_OK)
}

fn parse_call(rest: &[String]) -> Result<Command, String> {
    let Some((tool_name, rest)) = rest.split_first().filter(|(tool_name, _)| !tool_name.starts_with('-')) else {
        return Err("Name the tool to call: git-manager cli call <tool> [key=value ...]".to_string());
    };
    let mut base = Map::new();
    let mut pairs = Map::new();
    let (mut json, mut out) = (false, None);
    let mut words = rest.iter();
    while let Some(word) = words.next() {
        match word.as_str() {
            "--json" => json = true,
            "--out" => out = Some(PathBuf::from(words.next().ok_or("--out needs a file path")?)),
            "--args" => {
                let text = words.next().ok_or("--args needs a JSON object")?;
                match serde_json::from_str::<Value>(text) {
                    Ok(Value::Object(object)) => base.extend(object),
                    _ => return Err("--args must be a JSON object, like '{\"repoPath\": \"/path\"}'".to_string()),
                }
            }
            flag if flag.starts_with("--") => return Err(format!("Unknown option for call: {flag}")),
            pair => {
                let (key, value) = parse_pair(pair)?;
                pairs.insert(key, value);
            }
        }
    }
    base.extend(pairs);
    Ok(Command::Call {
        tool_name: tool_name.clone(),
        arguments: base,
        json,
        out,
    })
}

fn agent_with_timeout(timeout: Duration) -> ureq::Agent {
    let config = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .timeout_connect(Some(Duration::from_secs(3)))
        .timeout_global(Some(timeout))
        .max_redirects(0)
        .build();
    ureq::Agent::new_with_config(config)
}

/// A JSON-RPC client of the local server.
pub struct Client {
    url: String,
    token: String,
    agent: ureq::Agent,
}

#[cfg(unix)]
fn process_alive(pid: u32) -> bool {
    // SAFETY: signal 0 only checks that the process exists.
    let result = unsafe { libc::kill(pid as libc::pid_t, 0) };
    result == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

#[cfg(windows)]
fn process_alive(pid: u32) -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, STILL_ACTIVE};
    use windows_sys::Win32::System::Threading::{GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
    // SAFETY: plain Win32 calls on a handle this function opens and closes.
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return false;
        }
        let mut code = 0u32;
        let running = GetExitCodeProcess(process, &mut code) != 0 && code == STILL_ACTIVE as u32;
        CloseHandle(process);
        running
    }
}

#[cfg(not(any(unix, windows)))]
fn process_alive(_pid: u32) -> bool {
    true
}

impl Client {
    pub fn new(port: u16, token: String) -> Client {
        Client {
            url: format!("http://127.0.0.1:{port}/mcp"),
            token,
            // Long enough for sample_memory (60 s) and a UI tool's 30 s wait.
            agent: agent_with_timeout(Duration::from_secs(150)),
        }
    }

    /// Finds the running server through mcp.json.
    pub fn from_config(config_dir: &Path) -> Result<Client, String> {
        let file = token::read_in(config_dir).ok_or(NOT_RUNNING)?;
        let port = file.port.ok_or(NOT_RUNNING)?;
        if file.pid.is_some_and(|pid| !process_alive(pid)) {
            return Err(NOT_RUNNING.to_string());
        }
        Ok(Client::new(port, file.token))
    }

    pub fn url(&self) -> &str {
        &self.url
    }

    /// The same client with another time limit for each call.
    pub fn with_timeout(self, timeout: Duration) -> Client {
        Client {
            agent: agent_with_timeout(timeout),
            ..self
        }
    }

    fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        let body = json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params }).to_string();
        let sent = self
            .agent
            .post(&self.url)
            .header("Authorization", &format!("Bearer {}", self.token))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .header(CLIENT_HEADER, "cli")
            .send(body.as_str());
        let mut response = sent.map_err(|err| format!("Could not reach Git Manager at {} ({err}). Is it running?", self.url))?;
        let status = response.status().as_u16();
        let text = response
            .body_mut()
            .with_config()
            .limit(MAX_RESPONSE_BYTES)
            .read_to_string()
            .map_err(|err| format!("Could not read Git Manager's answer: {err}"))?;
        let reply: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        if status != 200 {
            let message = reply["error"]
                .as_str()
                .or_else(|| reply["error"]["message"].as_str())
                .map(str::to_string)
                .unwrap_or_else(|| format!("Git Manager answered with HTTP {status}"));
            return Err(message);
        }
        if let Some(message) = reply["error"]["message"].as_str() {
            return Err(message.to_string());
        }
        Ok(reply["result"].clone())
    }

    pub fn initialize(&self) -> Result<Value, String> {
        self.request(
            "initialize",
            json!({
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": { "name": "git-manager-cli", "version": env!("CARGO_PKG_VERSION") },
            }),
        )
    }

    pub fn list_tools(&self, include_disabled: bool) -> Result<Vec<Value>, String> {
        let result = self.request("tools/list", json!({ "_meta": { "gitManager/includeDisabled": include_disabled } }))?;
        Ok(result["tools"].as_array().cloned().unwrap_or_default())
    }

    pub fn call(&self, tool_name: &str, arguments: &Map<String, Value>) -> Result<Value, String> {
        self.request("tools/call", json!({ "name": tool_name, "arguments": arguments }))
    }
}

/// The first sentence of a description, for one-line listings.
fn first_sentence(text: &str) -> &str {
    match text.find(". ") {
        Some(end) => &text[..=end],
        None => text,
    }
}

fn print_tools(out: &mut dyn Write, tools: &[Value], json_output: bool) -> std::io::Result<()> {
    if json_output {
        return writeln!(out, "{}", serde_json::to_string_pretty(tools).unwrap_or_default());
    }
    let width = tools.iter().filter_map(|tool| tool["name"].as_str()).map(str::len).max().unwrap_or(0);
    for tool in tools {
        let name = tool["name"].as_str().unwrap_or_default();
        let category = tool["_meta"]["gitManager/category"].as_str().unwrap_or_default();
        let off = tool["_meta"]["gitManager/enabled"].as_bool() == Some(false);
        let description = first_sentence(tool["description"].as_str().unwrap_or_default());
        let mark = if off { " (off)" } else { "" };
        writeln!(out, "{name:<width$}  {category:<11}  {description}{mark}")?;
    }
    Ok(())
}

fn print_description(out: &mut dyn Write, tool: &Value) -> std::io::Result<()> {
    let annotations = &tool["annotations"];
    let changes = if annotations["readOnlyHint"].as_bool() == Some(true) {
        "reads only"
    } else if annotations["destructiveHint"].as_bool() == Some(true) {
        "changes things and can lose work"
    } else {
        "changes things"
    };
    let state = if tool["_meta"]["gitManager/enabled"].as_bool() == Some(false) { "off" } else { "on" };
    writeln!(out, "{} ({})", tool["name"].as_str().unwrap_or_default(), tool["title"].as_str().unwrap_or_default())?;
    writeln!(out, "Category: {}. It {changes}. Turned {state}.", tool["_meta"]["gitManager/category"].as_str().unwrap_or_default())?;
    writeln!(out)?;
    writeln!(out, "{}", tool["description"].as_str().unwrap_or_default())?;
    writeln!(out)?;
    writeln!(out, "Arguments (JSON Schema):")?;
    writeln!(out, "{}", serde_json::to_string_pretty(&tool["inputSchema"]).unwrap_or_default())
}

fn temp_image_path() -> PathBuf {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("git-manager-{stamp}.png"))
}

/// Prints a tools/call result; image blocks go to `image_out` (or a temporary file).
fn print_result(
    out: &mut dyn Write,
    err: &mut dyn Write,
    result: &Value,
    json_output: bool,
    image_out: Option<&Path>,
) -> std::io::Result<i32> {
    let failed = result["isError"].as_bool().unwrap_or(false);
    let blocks = result["content"].as_array().cloned().unwrap_or_default();
    if failed {
        for block in &blocks {
            if let Some(text) = block["text"].as_str() {
                writeln!(err, "{text}")?;
            }
        }
        return Ok(EXIT_TOOL_ERROR);
    }
    for block in &blocks {
        if block["type"] == "image" {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(block["data"].as_str().unwrap_or_default())
                .unwrap_or_default();
            let target = image_out.map(Path::to_path_buf).unwrap_or_else(temp_image_path);
            if let Err(write_err) = std::fs::write(&target, bytes) {
                writeln!(err, "Could not save the image to {}: {write_err}", target.display())?;
                return Ok(EXIT_TOOL_ERROR);
            }
            writeln!(out, "Saved the image to {}", target.display())?;
        }
    }
    if json_output {
        let value = if result["structuredContent"].is_object() { &result["structuredContent"] } else { result };
        writeln!(out, "{}", serde_json::to_string_pretty(value).unwrap_or_default())?;
        return Ok(EXIT_OK);
    }
    for block in &blocks {
        if let Some(text) = block["text"].as_str().filter(|_| block["type"] == "text") {
            writeln!(out, "{text}")?;
        }
    }
    Ok(EXIT_OK)
}

fn connect(config_dir: &Path, err: &mut dyn Write) -> std::io::Result<Option<Client>> {
    match Client::from_config(config_dir) {
        Ok(client) => match client.initialize() {
            Ok(_) => Ok(Some(client)),
            Err(message) => {
                writeln!(err, "{message}")?;
                Ok(None)
            }
        },
        Err(message) => {
            writeln!(err, "{message}")?;
            Ok(None)
        }
    }
}

fn execute(command: Command, config_dir: &Path, out: &mut dyn Write, err: &mut dyn Write) -> std::io::Result<i32> {
    if let Command::Help(text) = command {
        writeln!(out, "{text}")?;
        return Ok(EXIT_OK);
    }
    if let Command::Status = command {
        let client = match Client::from_config(config_dir) {
            Ok(client) => client,
            Err(message) => {
                writeln!(out, "{message}")?;
                return Ok(EXIT_UNAVAILABLE);
            }
        };
        return match client.initialize() {
            Ok(result) => {
                let on_off = |key: &str| if result["_meta"][key].as_bool() == Some(true) { "on" } else { "off" };
                writeln!(out, "Git Manager {} is running.", result["serverInfo"]["version"].as_str().unwrap_or_default())?;
                writeln!(out, "Server: {}", client.url())?;
                writeln!(out, "MCP server: {}", on_off("gitManager/mcpEnabled"))?;
                writeln!(out, "Command line tool: {}", on_off("gitManager/cliEnabled"))?;
                Ok(EXIT_OK)
            }
            Err(message) => {
                writeln!(out, "Git Manager is running at {}, but: {message}", client.url())?;
                Ok(EXIT_UNAVAILABLE)
            }
        };
    }
    let Some(client) = connect(config_dir, err)? else {
        return Ok(EXIT_UNAVAILABLE);
    };
    let (tool_name, arguments, json_output, image_out) = match command {
        Command::Tools { json, all } => {
            return match client.list_tools(all) {
                Ok(tools) => print_tools(out, &tools, json).map(|_| EXIT_OK),
                Err(message) => writeln!(err, "{message}").map(|_| EXIT_UNAVAILABLE),
            };
        }
        Command::Describe { tool_name } => {
            let tools = match client.list_tools(true) {
                Ok(tools) => tools,
                Err(message) => return writeln!(err, "{message}").map(|_| EXIT_UNAVAILABLE),
            };
            return match tools.iter().find(|tool| tool["name"] == tool_name.as_str()) {
                Some(tool) => print_description(out, tool).map(|_| EXIT_OK),
                None => writeln!(err, "No tool named {tool_name}. See git-manager cli tools --all.").map(|_| EXIT_UNAVAILABLE),
            };
        }
        Command::Call { tool_name, arguments, json, out: image_out } => (tool_name, arguments, json, image_out),
        Command::Clone { url, folder_name, into, open } => {
            let current_dir = std::env::current_dir().unwrap_or_default();
            let arguments = clone_arguments(&url, folder_name.as_deref(), into.as_deref(), open.as_deref(), &current_dir);
            return run_clone(client, &arguments, out, err);
        }
        Command::Screenshot { file_path } => ("take_screenshot".to_string(), Map::new(), false, Some(file_path)),
        Command::Memory { interval_ms, duration_s, json } => return watch_memory(&client, interval_ms, duration_s, json, out),
        Command::Help(_) | Command::Status => return Ok(EXIT_OK),
    };
    match client.call(&tool_name, &arguments) {
        Ok(result) => print_result(out, err, &result, json_output, image_out.as_deref()),
        Err(message) => writeln!(err, "{message}").map(|_| EXIT_UNAVAILABLE),
    }
}

/// Runs the command line tool with the words after `cli`; returns the exit code.
pub fn run_with(args: &[String], config_dir: &Path, out: &mut dyn Write, err: &mut dyn Write) -> i32 {
    let command = match parse(args) {
        Ok(command) => command,
        Err(message) => {
            let _ = writeln!(err, "{message}\n\n{HELP}");
            return EXIT_UNAVAILABLE;
        }
    };
    execute(command, config_dir, out, err).unwrap_or(EXIT_UNAVAILABLE)
}

/// The app's file names next to the console program: Tauri names the Windows app after the
/// Cargo binary, and after the product name in some setups.
const APP_EXE_NAMES: [&str; 3] = ["git-manager.exe", "Git Manager.exe", "git-manager"];

/// The app's program in the folder of `exe` (the installer puts both there).
pub fn app_next_to(exe: &Path) -> Option<PathBuf> {
    let folder = exe.parent()?;
    APP_EXE_NAMES.iter().map(|name| folder.join(name)).find(|candidate| candidate.is_file())
}

/// The console program (src/main.rs): `cli ...` runs the tool here, anything else starts the app,
/// which opens the folder it is given or hands it to the copy already running.
pub fn console_main(args: &[String]) -> i32 {
    if args.first().map(String::as_str) == Some("cli") {
        return run(&args[1..]);
    }
    let Some(app) = std::env::current_exe().ok().and_then(|exe| app_next_to(&exe)) else {
        eprintln!("Could not find Git Manager next to this program. Reinstall Git Manager.");
        return EXIT_UNAVAILABLE;
    };
    match std::process::Command::new(&app).args(args).spawn() {
        Ok(_) => EXIT_OK,
        Err(err) => {
            eprintln!("Could not start Git Manager: {err}");
            EXIT_UNAVAILABLE
        }
    }
}

/// `git-manager cli ...` from main: no window, the process exits with the code.
pub fn run(args: &[String]) -> i32 {
    let config_dir = match home::home_dir() {
        Ok(home) => home::config_dir_in(&home),
        Err(message) => {
            eprintln!("{message}");
            return EXIT_UNAVAILABLE;
        }
    };
    let (mut out, mut err) = (std::io::stdout(), std::io::stderr());
    run_with(args, &config_dir, &mut out, &mut err)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_app_is_found_next_to_the_console_program() {
        let dir = tempfile::TempDir::new().unwrap();
        let console = dir.path().join("git-manager-cli.exe");
        assert_eq!(app_next_to(&console), None);
        std::fs::write(dir.path().join("Git Manager.exe"), "").unwrap();
        assert_eq!(app_next_to(&console), Some(dir.path().join("Git Manager.exe")));
        std::fs::write(dir.path().join("git-manager.exe"), "").unwrap();
        assert_eq!(app_next_to(&console), Some(dir.path().join("git-manager.exe")));
    }

    #[test]
    fn a_bad_command_line_is_a_usage_error() {
        let (mut out, mut err) = (Vec::new(), Vec::new());
        let args = vec!["no-such-command".to_string()];
        assert_eq!(run_with(&args, Path::new("/nonexistent"), &mut out, &mut err), EXIT_UNAVAILABLE);
        assert!(String::from_utf8(err).unwrap().contains("Usage: git-manager cli"));
    }
}
