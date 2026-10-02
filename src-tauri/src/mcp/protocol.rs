//! JSON-RPC 2.0 with the MCP methods: initialize, ping, tools/list and tools/call.

use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde_json::{json, Map, Value};

use super::dto::{McpActivity, McpClient, McpUiResult};
use super::registry;
use super::tools::{self, Args, ToolCtx, ToolOutput, ToolResult};
use super::Shared;

pub const PROTOCOL_VERSIONS: [&str; 3] = ["2025-06-18", "2025-03-26", "2024-11-05"];
pub const SERVER_NAME: &str = "git-manager";
pub const TURNED_OFF: &str = "This tool is turned off in Git Manager (Help > Available MCP Tools).";

const PARSE_ERROR: i64 = -32700;
const INVALID_REQUEST: i64 = -32600;
const METHOD_NOT_FOUND: i64 = -32601;
const INVALID_PARAMS: i64 = -32602;

const INSTRUCTIONS: &str = "Git Manager is the desktop Git client the user has open. These tools read and change the git repositories and files in the workspace folders open in the app, search them, drive the app's UI and report its memory use. Call list_workspace first to learn the repository paths; every path must be absolute and inside an open workspace folder.";

/// HTTP status and body (None: 202 Accepted with no body).
pub type Reply = (u16, Option<Value>);

fn error(id: Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

fn success(id: Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

pub fn handle_body(shared: &Shared, client: McpClient, body: &[u8]) -> Reply {
    let message: Value = match serde_json::from_slice(body) {
        Ok(message) => message,
        Err(_) => return (400, Some(error(Value::Null, PARSE_ERROR, "Parse error"))),
    };
    match message {
        Value::Array(batch) if batch.is_empty() => (200, Some(error(Value::Null, INVALID_REQUEST, "Empty batch"))),
        Value::Array(batch) => {
            let replies: Vec<Value> = batch
                .iter()
                .filter_map(|message| handle_message(shared, client, message))
                .collect();
            if replies.is_empty() {
                (202, None)
            } else {
                (200, Some(Value::Array(replies)))
            }
        }
        message => match handle_message(shared, client, &message) {
            Some(reply) => (200, Some(reply)),
            None => (202, None),
        },
    }
}

/// One message; None for notifications and stray responses, which get no reply.
pub fn handle_message(shared: &Shared, client: McpClient, message: &Value) -> Option<Value> {
    let Some(object) = message.as_object() else {
        return Some(error(Value::Null, INVALID_REQUEST, "Invalid Request"));
    };
    let id = object.get("id").cloned();
    let method = object.get("method").and_then(Value::as_str);
    let valid = object.get("jsonrpc").and_then(Value::as_str) == Some("2.0");
    let Some(id) = id else {
        // Notifications (notifications/initialized and the like) need nothing back.
        return None;
    };
    let Some(method) = method.filter(|_| valid) else {
        if object.contains_key("result") || object.contains_key("error") {
            return None;
        }
        return Some(error(id, INVALID_REQUEST, "Invalid Request"));
    };
    let params = object.get("params").cloned().unwrap_or(Value::Null);
    let result = match method {
        "initialize" => Ok(initialize(shared, &params)),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(list_tools(shared, &params)),
        "tools/call" => call_tool(shared, client, &params),
        _ => Err((METHOD_NOT_FOUND, format!("Method not found: {method}"))),
    };
    Some(match result {
        Ok(result) => success(id, result),
        Err((code, message)) => error(id, code, &message),
    })
}

fn initialize(shared: &Shared, params: &Value) -> Value {
    let requested = params["protocolVersion"].as_str().unwrap_or_default();
    let version = PROTOCOL_VERSIONS
        .iter()
        .find(|known| **known == requested)
        .copied()
        .unwrap_or(PROTOCOL_VERSIONS[0]);
    let switches = shared.switches();
    json!({
        "protocolVersion": version,
        "capabilities": { "tools": { "listChanged": false } },
        "serverInfo": { "name": SERVER_NAME, "title": "Git Manager", "version": env!("CARGO_PKG_VERSION") },
        "instructions": INSTRUCTIONS,
        "_meta": { "gitManager/mcpEnabled": switches.mcp, "gitManager/cliEnabled": switches.cli },
    })
}

/// Enabled tools only; `_meta: { "gitManager/includeDisabled": true }` lists every tool.
fn list_tools(shared: &Shared, params: &Value) -> Value {
    let include_disabled = params["_meta"]["gitManager/includeDisabled"].as_bool().unwrap_or(false);
    let tools: Vec<Value> = registry::infos(shared)
        .iter()
        .filter(|info| info.enabled || include_disabled)
        .map(registry::listed)
        .collect();
    json!({ "tools": tools })
}

fn text_block(text: &str) -> Value {
    json!({ "type": "text", "text": text })
}

pub fn tool_result(output: ToolResult) -> Value {
    match output {
        Ok(ToolOutput::Json(value)) => {
            let text = serde_json::to_string_pretty(&value).unwrap_or_default();
            let mut result = json!({ "content": [text_block(&text)], "isError": false });
            if value.is_object() {
                result["structuredContent"] = value;
            }
            result
        }
        Ok(ToolOutput::Text(text)) => json!({ "content": [text_block(&text)], "isError": false }),
        Ok(ToolOutput::Image { png_base64, caption }) => json!({
            "content": [
                { "type": "image", "data": png_base64, "mimeType": "image/png" },
                text_block(&caption),
            ],
            "isError": false,
        }),
        Err(message) => json!({ "content": [text_block(&message)], "isError": true }),
    }
}

fn ui_result(answer: McpUiResult) -> Value {
    let mut content = Vec::new();
    if let Some(image) = answer.image_png_base64.as_deref().filter(|image| !image.is_empty()) {
        content.push(json!({ "type": "image", "data": image, "mimeType": "image/png" }));
    }
    if !answer.text.is_empty() || content.is_empty() {
        let text = if answer.text.is_empty() { "Done." } else { answer.text.as_str() };
        content.push(text_block(text));
    }
    let mut result = json!({ "content": content, "isError": !answer.ok });
    if let Some(structured) = answer.structured.filter(Value::is_object) {
        result["structuredContent"] = structured;
    }
    result
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0)
}

fn call_tool(shared: &Shared, client: McpClient, params: &Value) -> Result<Value, (i64, String)> {
    let tool_name = params["name"]
        .as_str()
        .ok_or((INVALID_PARAMS, "params.name must be the tool's name".to_string()))?;
    let empty = Map::new();
    let arguments = match &params["arguments"] {
        Value::Null => &empty,
        Value::Object(arguments) => arguments,
        _ => return Err((INVALID_PARAMS, "params.arguments must be an object".to_string())),
    };
    let backend = tools::find(tool_name);
    let ui_tool = match backend {
        Some(_) => None,
        None => shared.ui_tools().into_iter().find(|def| def.name == tool_name),
    };
    let destructive = match (backend, &ui_tool) {
        (Some(tool), _) => tool.destructive,
        (None, Some(def)) => def.destructive,
        (None, None) => return Err((INVALID_PARAMS, format!("Unknown tool: {tool_name}"))),
    };
    let started = Instant::now();
    let at = now_ms();
    let result = if !shared.tool_enabled(tool_name, destructive) {
        tool_result(Err(TURNED_OFF.to_string()))
    } else if let Some(tool) = backend {
        tool_result((tool.run)(&ToolCtx { shared }, &Args(arguments)))
    } else {
        let host = shared.host();
        match shared.bridge.call(host.as_deref(), tool_name, arguments, shared.ui_timeout()) {
            Ok(answer) => ui_result(answer),
            Err(message) => tool_result(Err(message)),
        }
    };
    let failed = result["isError"].as_bool().unwrap_or(false);
    let error_text = failed.then(|| {
        result["content"]
            .as_array()
            .and_then(|blocks| blocks.iter().find_map(|block| block["text"].as_str()))
            .unwrap_or("Failed")
            .to_string()
    });
    shared.record(McpActivity {
        tool: tool_name.to_string(),
        at,
        duration_ms: started.elapsed().as_millis() as u64,
        ok: !failed,
        error: error_text,
        client,
    });
    Ok(result)
}
