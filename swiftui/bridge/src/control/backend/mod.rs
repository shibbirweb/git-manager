//! The current app's backend MCP tools in the native server: src-tauri's tool files (src/mcp/tools), included by
//! path, so their names, arguments, checks and results stay the current app's. This module stands in for their
//! parent there (src-tauri/src/mcp/tools/mod.rs): the same helpers, with the workspace folders the window reports.
//! Only the tools that need nothing of Tauri are in: git_read so far.

#[path = "../../../../../src-tauri/src/mcp/tools/git_read.rs"]
mod git_read;
#[path = "../../../../../src-tauri/src/mcp/tools/patch.rs"]
mod patch;
// The file tools use the rest of it (checked_path); they are not in yet.
#[allow(dead_code)]
#[path = "../../../../../src-tauri/src/mcp/paths.rs"]
mod paths;

use std::future::Future;
use std::path::PathBuf;
use std::pin::pin;
use std::task::{Context, Poll, Wake, Waker};

use serde::Serialize;
use serde_json::{json, Map, Value};

use crate::error::AppResult;

pub const GIT: &str = "Git";

pub enum ToolOutput {
    Json(Value),
    Text(String),
}

pub type ToolResult = Result<ToolOutput, String>;

pub struct BackendTool {
    pub name: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    pub category: &'static str,
    pub read_only: bool,
    pub destructive: bool,
    pub schema: fn() -> Value,
    pub run: fn(&ToolCtx, &Args) -> ToolResult,
}

const GROUPS: [&[BackendTool]; 1] = [git_read::TOOLS];

pub fn all() -> impl Iterator<Item = &'static BackendTool> {
    GROUPS.iter().flat_map(|group| group.iter())
}

/// What a running tool may use: the open window's workspace folders.
pub struct ToolCtx {
    folders: Vec<PathBuf>,
}

impl ToolCtx {
    pub fn new(folder_paths: &[String]) -> ToolCtx {
        ToolCtx { folders: paths::canonical_folders(folder_paths) }
    }

    /// The canonical root of the repository named by `repoPath`.
    pub fn repo(&self, args: &Args) -> Result<String, String> {
        let repo_path = args.str("repoPath")?;
        let root = paths::checked_repo(&self.folders, repo_path)?;
        Ok(crate::paths::to_ui(&root))
    }

    /// File arguments (absolute or repo-relative) as repo-relative paths.
    pub fn repo_files(&self, repo_root: &str, file_paths: &[String]) -> Result<Vec<String>, String> {
        let root = PathBuf::from(repo_root);
        file_paths.iter().map(|file_path| paths::repo_relative(&root, file_path)).collect()
    }
}

/// Typed access to a call's arguments; a wrong type is a tool error that names the argument.
pub struct Args<'a>(pub &'a Map<String, Value>);

impl Args<'_> {
    fn present(&self, key: &str) -> Option<&Value> {
        self.0.get(key).filter(|value| !value.is_null())
    }

    pub fn str(&self, key: &str) -> Result<&str, String> {
        match self.opt_str(key)? {
            Some(text) if !text.trim().is_empty() => Ok(text),
            _ => Err(format!("Missing required argument: {key}")),
        }
    }

    pub fn opt_str(&self, key: &str) -> Result<Option<&str>, String> {
        match self.present(key) {
            None => Ok(None),
            Some(Value::String(text)) => Ok(Some(text.as_str())),
            Some(_) => Err(format!("{key} must be a string")),
        }
    }

    pub fn bool(&self, key: &str, default: bool) -> Result<bool, String> {
        match self.present(key) {
            None => Ok(default),
            Some(Value::Bool(flag)) => Ok(*flag),
            Some(_) => Err(format!("{key} must be true or false")),
        }
    }

    pub fn opt_u64(&self, key: &str) -> Result<Option<u64>, String> {
        match self.present(key) {
            None => Ok(None),
            Some(value) => value.as_u64().map(Some).ok_or_else(|| format!("{key} must be a whole number of 0 or more")),
        }
    }

    pub fn u64(&self, key: &str, default: u64) -> Result<u64, String> {
        Ok(self.opt_u64(key)?.unwrap_or(default))
    }

    pub fn usize(&self, key: &str, default: usize, max: usize) -> Result<usize, String> {
        Ok((self.u64(key, default as u64)? as usize).min(max))
    }

    pub fn opt_str_list(&self, key: &str) -> Result<Vec<String>, String> {
        match self.present(key) {
            None => Ok(Vec::new()),
            Some(Value::Array(items)) => items
                .iter()
                .map(|item| item.as_str().map(str::to_string).ok_or_else(|| format!("{key} must be a list of strings")))
                .collect(),
            Some(Value::String(single)) => Ok(vec![single.clone()]),
            Some(_) => Err(format!("{key} must be a list of strings")),
        }
    }
}

struct ThreadWaker(std::thread::Thread);

impl Wake for ThreadWaker {
    fn wake(self: std::sync::Arc<Self>) {
        self.0.unpark();
    }
}

/// Runs one of the commands' async functions to the end on this server thread (they do their work inline).
pub fn wait<T>(future: impl Future<Output = AppResult<T>>) -> Result<T, String> {
    let waker = Waker::from(std::sync::Arc::new(ThreadWaker(std::thread::current())));
    let mut context = Context::from_waker(&waker);
    let mut future = pin!(future);
    loop {
        if let Poll::Ready(result) = future.as_mut().poll(&mut context) {
            return result.map_err(|err| err.to_string());
        }
        std::thread::park();
    }
}

pub fn json_out(value: impl Serialize) -> ToolResult {
    serde_json::to_value(value).map(ToolOutput::Json).map_err(|err| format!("Could not encode the result: {err}"))
}

/// The JSON Schema of a tool's arguments.
pub fn object(properties: Value, required: &[&str]) -> Value {
    json!({ "type": "object", "properties": properties, "required": required, "additionalProperties": false })
}

pub fn repo_prop() -> Value {
    json!({
        "type": "string",
        "description": "Absolute path of the repository (its root or any folder inside it). Must be in an open \
                        workspace folder.",
    })
}

pub fn files_prop(what: &str) -> Value {
    json!({
        "type": "array",
        "items": { "type": "string" },
        "description": format!("{what} Absolute paths, or paths relative to repoPath."),
    })
}

/// tools/list's entry, as the current app's registry lists a backend tool.
pub fn listed(tool: &BackendTool) -> Value {
    json!({
        "name": tool.name,
        "title": tool.title,
        "description": tool.description,
        "inputSchema": (tool.schema)(),
        "annotations": { "title": tool.title, "readOnlyHint": tool.read_only, "destructiveHint": tool.destructive },
        "_meta": {
            "gitManager/category": tool.category,
            "gitManager/kind": "backend",
            "gitManager/enabled": true,
            "gitManager/defaultEnabled": !tool.destructive,
        },
    })
}

/// Runs `tool` in the workspace of `folder_paths`; the result as the current app's protocol shapes it.
pub fn call(tool: &BackendTool, folder_paths: &[String], args: &Map<String, Value>) -> Value {
    let text_block = |text: &str| json!({ "type": "text", "text": text });
    match (tool.run)(&ToolCtx::new(folder_paths), &Args(args)) {
        Ok(ToolOutput::Json(value)) => {
            let text = serde_json::to_string_pretty(&value).unwrap_or_default();
            let mut result = json!({ "content": [text_block(&text)], "isError": false });
            if value.is_object() {
                result["structuredContent"] = value;
            }
            result
        }
        Ok(ToolOutput::Text(text)) => json!({ "content": [text_block(&text)], "isError": false }),
        Err(message) => json!({ "content": [text_block(&message)], "isError": true }),
    }
}
