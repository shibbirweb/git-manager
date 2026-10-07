//! JSON-RPC for the control server: initialize, ping, tools/list and tools/call, with results shaped like the
//! current app's (src-tauri/src/mcp/protocol.rs), so `git-manager cli` reads both the same way.

use serde_json::{json, Map, Value};

use super::tools::TOOLS;
use super::{Server, VERSION};

const PROTOCOL_VERSIONS: [&str; 3] = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_NAME: &str = "git-manager-native";
const INSTRUCTIONS: &str = "Git Manager Native, the SwiftUI experiment. Tools match the current app's names and \
                            results where both have them.";

pub(super) enum Output {
    Json(Value),
    Image { png_base64: String, caption: String },
}

pub(super) type ToolResult = Result<Output, String>;

/// One tool: what tools/list shows and the function tools/call runs.
pub(super) struct Tool {
    pub name: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    pub category: &'static str,
    pub read_only: bool,
    pub schema: fn() -> Value,
    pub run: fn(&Server, &Map<String, Value>) -> ToolResult,
}

/// None for a notification (no id), which gets no reply.
pub(super) fn handle_message(server: &Server, message: &Value) -> Option<Value> {
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
        "instructions": INSTRUCTIONS,
        "_meta": { "gitManager/mcpEnabled": true, "gitManager/cliEnabled": true },
    })
}

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
        Ok(Output::Image { png_base64, caption }) => {
            let image = json!({ "type": "image", "data": png_base64, "mimeType": "image/png" });
            json!({ "content": [image, text_block(&caption)], "isError": false })
        }
        Err(message) => json!({ "content": [text_block(&message)], "isError": true }),
    }
}
