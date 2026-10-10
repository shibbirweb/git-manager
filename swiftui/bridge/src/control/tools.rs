//! The control server's tools: the list tools/list shows, and the app, git and screenshot tools. The memory
//! tools are in `memory_tools`.

use base64::Engine;
use serde_json::{json, Map, Value};

use super::memory_tools::{get_memory_usage, sample_memory, sample_schema};
use super::protocol::{Output, Tool, ToolResult};
use super::{ask_ui, Server, VERSION};
use crate::git::repo as git_repo;
use crate::git::status;

pub(super) const TOOLS: &[Tool] = &[
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
        description: "Reads or changes what the native app shows. action: get_state (the open folder, its branch \
                      and changed files, the staged and unstaged groups, the commit box, toasts and the window \
                      size), open_folder (folderPath), show_diff (filePath, staged), scroll (speed, rounds: \
                      scrolls the largest area down and back, for memory sampling), stage or unstage (filePaths; \
                      without them the whole group) and commit (message, amend). stage, unstage and commit run \
                      like a click in the window: busy state, toasts and the status refresh included. \
                      Terminal, like the current app's tools: show_panel (panel terminal, visible), \
                      list_terminals, new_terminal, send_terminal_text (text, pressEnter, terminalKey) and \
                      terminal_text (the screen's lines). \
                      quick_open (prefix, recentFiles) and search (query) open Quick Open or Find in Files and \
                      answer with its rows; close_dialog closes it. new_window (folderPaths, workspaceFile: \
                      none for the welcome screen) opens a window or focuses the one showing them; list_windows \
                      lists every window with its folders.",
        category: "ui",
        read_only: false,
        schema: app_schema,
        run: app,
    },
    Tool {
        name: "git_status",
        title: "Git status",
        description: "The current branch, its upstream and ahead/behind counts, any merge or rebase in progress, \
                      and every changed file with its staged and unstaged state.",
        category: "git",
        read_only: true,
        schema: repo_only,
        run: git_status,
    },
    Tool {
        name: "get_memory_usage",
        title: "Memory usage",
        description: "Memory used right now by Git Manager Native, as Activity Monitor counts it (the same method \
                      as the current app).",
        category: "performance",
        read_only: true,
        schema: no_args,
        run: get_memory_usage,
    },
    Tool {
        name: "sample_memory",
        title: "Sample memory",
        description: "Measures memory every intervalMs for durationMs (at most 60 s) and returns each sample with \
                      the minimum, maximum and average per process.",
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
    super::dialog_tools::OPEN_SETTINGS,
    super::dialog_tools::CLOSE_DIALOG,
];

pub(super) fn object(properties: Value, required: &[&str]) -> Value {
    json!({ "type": "object", "properties": properties, "required": required, "additionalProperties": false })
}

fn no_args() -> Value {
    object(json!({}), &[])
}

fn repo_only() -> Value {
    let description = "Absolute path of the repository (default: the folder open in the app).";
    object(json!({ "repoPath": { "type": "string", "description": description } }), &[])
}

fn app_schema() -> Value {
    object(
        json!({
            "action": {
                "type": "string",
                "enum": [
                    "get_state", "open_folder", "show_diff", "scroll", "stage", "unstage", "commit", "show_panel",
                    "list_terminals", "new_terminal", "send_terminal_text", "terminal_text", "quick_open", "search",
                    "close_dialog", "open_file", "editor_command", "new_window", "list_windows"
                ],
                "description": "What to do."
            },
            "filePaths": {
                "type": "array", "items": { "type": "string" },
                "description": "stage, unstage: changed files relative to the repository (default: the whole group)."
            },
            "message": { "type": "string", "description": "commit: the message typed into the commit box." },
            "amend": { "type": "boolean", "description": "commit: tick Amend first (default: as the box has it)." },
            "folderPath": { "type": "string", "description": "open_folder: absolute path of the folder to open." },
            "filePath": { "type": "string", "description": "show_diff: the changed file, relative to the repository." },
            "line": { "type": "integer", "description": "open_file: the 1-based line to put the cursor on." },
            "column": { "type": "integer", "description": "open_file: the 1-based column on that line." },
            "command": {
                "type": "string",
                "description": "editor_command: a Code or Edit menu id of the current app, such as code.moveLineDown."
            },
            "staged": { "type": "boolean", "description": "show_diff: the staged change instead of the unstaged one." },
            "speed": { "type": "number", "description": "scroll: points per frame (default 80)." },
            "rounds": { "type": "integer", "description": "scroll: down-and-back passes (default 1)." },
            "panel": { "type": "string", "description": "show_panel: the panel (only terminal is built)." },
            "visible": { "type": "boolean", "description": "show_panel: false hides it (default true)." },
            "text": { "type": "string", "description": "send_terminal_text: the text typed into the shell." },
            "pressEnter": { "type": "boolean", "description": "send_terminal_text: Enter after it (default true)." },
            "terminalKey": { "type": "integer", "description": "send_terminal_text: the terminal (default shown)." },
            "prefix": { "type": "string", "description": "quick_open: \"\" for Go to File, \">\" for commands." },
            "recentFiles": {
                "type": "array", "items": { "type": "string" },
                "description": "quick_open: files opened before, oldest first, relative to the repository."
            },
            "query": { "type": "string", "description": "search: the text to find in files." },
        }),
        &["action"],
    )
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

/// The window as the window server draws it, without its shadow, like the current app's `screencapture -o -l`
/// (src-tauri/src/mcp/host.rs). The app captures its own window, which needs no Screen Recording permission.
fn take_screenshot(server: &Server, _args: &Map<String, Value>) -> ToolResult {
    let reply = ask_ui(server, json!({ "action": "screenshot" }))?;
    let png_base64 =
        reply["structured"]["pngBase64"].as_str().filter(|data| !data.is_empty()).ok_or("The app sent no image")?;
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
