//! open_settings and close_dialog, with the current app's names and arguments (src/lib/mcp/toolDefs.ts), so one
//! command opens Settings in either app. The window answers them (Control.swift).

use serde_json::{json, Map, Value};

use super::protocol::{Output, Tool, ToolResult};
use super::tools::object;
use super::{ask_ui, Server};

/// SETTINGS_SECTIONS in src/lib/stores/settingsData.ts.
const SECTIONS: [&str; 11] = [
    "appearance", "editor", "merge", "layout", "terminal", "keyboard", "github", "automation", "updates", "files",
    "about",
];

pub(super) const OPEN_SETTINGS: Tool = Tool {
    name: "open_settings",
    title: "Open Settings",
    description: "Opens the Settings dialog, optionally on one section.",
    category: "ui",
    read_only: true,
    schema: open_settings_schema,
    run: open_settings,
};

pub(super) const CLOSE_DIALOG: Tool = Tool {
    name: "close_dialog",
    title: "Close Dialog",
    description: "Closes the dialog on top of the window (Settings), like pressing Escape.",
    category: "ui",
    read_only: true,
    schema: no_args,
    run: close_dialog,
};

fn open_settings_schema() -> Value {
    let description = "The section to show. Defaults to Appearance.";
    object(json!({ "section": { "type": "string", "enum": SECTIONS, "description": description } }), &[])
}

fn no_args() -> Value {
    object(json!({}), &[])
}

fn open_settings(server: &Server, args: &Map<String, Value>) -> ToolResult {
    let section = match args.get("section") {
        None | Some(Value::Null) => "appearance",
        Some(Value::String(section)) if SECTIONS.contains(&section.as_str()) => section.as_str(),
        Some(other) => return Err(format!("section must be one of {}, not {other}", SECTIONS.join(", "))),
    };
    ask_ui(server, json!({ "action": "open_settings", "args": { "section": section } }))?;
    Ok(Output::Json(json!({ "section": section })))
}

fn close_dialog(server: &Server, _args: &Map<String, Value>) -> ToolResult {
    let reply = ask_ui(server, json!({ "action": "close_dialog", "args": {} }))?;
    Ok(Output::Json(reply["structured"].clone()))
}
