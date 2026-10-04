//! The tool list: backend tools plus the UI tools the frontend registered, each with its
//! effective on/off state (destructive tools start off; settings store only the changes).

use serde_json::{json, Value};

use super::dto::{McpToolInfo, McpUiToolDef, ToolKind};
use super::tools;
use super::Shared;

pub fn is_snake_case(tool_name: &str) -> bool {
    !tool_name.is_empty()
        && tool_name.len() <= 64
        && tool_name.bytes().all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
        && tool_name.as_bytes()[0].is_ascii_lowercase()
}

/// UI tools that are well named and do not clash with another tool, and why the others
/// were refused. A clash is refused rather than shadowing a tool.
pub fn accepted_ui_tools(defs: Vec<McpUiToolDef>) -> (Vec<McpUiToolDef>, Vec<String>) {
    let mut accepted: Vec<McpUiToolDef> = Vec::new();
    let mut refused: Vec<String> = Vec::new();
    for mut def in defs {
        if !is_snake_case(&def.name) {
            refused.push(format!("\"{}\" is not a snake_case tool name", def.name));
            continue;
        }
        if tools::find(&def.name).is_some() {
            refused.push(format!("{} is already a backend tool", def.name));
            continue;
        }
        if accepted.iter().any(|other| other.name == def.name) {
            refused.push(format!("{} is registered twice", def.name));
            continue;
        }
        if !def.input_schema.is_object() {
            def.input_schema = tools::no_args();
        }
        // A tool cannot be both; destructive is the safer reading.
        if def.read_only && def.destructive {
            def.read_only = false;
        }
        accepted.push(def);
    }
    (accepted, refused)
}

pub fn infos(shared: &Shared) -> Vec<McpToolInfo> {
    let mut infos: Vec<McpToolInfo> = tools::all()
        .map(|tool| McpToolInfo {
            name: tool.name.to_string(),
            title: tool.title.to_string(),
            description: tool.description.to_string(),
            category: tool.category.to_string(),
            kind: ToolKind::Backend,
            read_only: tool.read_only,
            destructive: tool.destructive,
            default_enabled: tools::starts_on(tool.name, tool.destructive),
            enabled: shared.tool_enabled(tool.name, tool.destructive),
            input_schema: (tool.schema)(),
        })
        .collect();
    infos.extend(shared.ui_tools().into_iter().map(|def| McpToolInfo {
        default_enabled: tools::starts_on(&def.name, def.destructive),
        enabled: shared.tool_enabled(&def.name, def.destructive),
        name: def.name,
        title: def.title,
        description: def.description,
        category: def.category,
        kind: ToolKind::Ui,
        read_only: def.read_only,
        destructive: def.destructive,
        input_schema: def.input_schema,
    }));
    infos
}

/// The MCP `tools/list` entry; `_meta` carries what the command line tool shows.
pub fn listed(info: &McpToolInfo) -> Value {
    json!({
        "name": info.name,
        "title": info.title,
        "description": info.description,
        "inputSchema": info.input_schema,
        "annotations": {
            "title": info.title,
            "readOnlyHint": info.read_only,
            "destructiveHint": info.destructive,
        },
        "_meta": {
            "gitManager/category": info.category,
            "gitManager/kind": info.kind,
            "gitManager/enabled": info.enabled,
            "gitManager/defaultEnabled": info.default_enabled,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn def(tool_name: &str) -> McpUiToolDef {
        McpUiToolDef {
            name: tool_name.to_string(),
            title: "T".to_string(),
            description: "D".to_string(),
            category: "App".to_string(),
            read_only: true,
            destructive: true,
            input_schema: Value::Null,
        }
    }

    /// The names the frontend registers (src/lib/mcp/toolDefs.ts): none may be a backend tool.
    /// src/lib/mcp/toolDefs.test.ts reads this list and fails when it and UI_TOOLS differ.
    const FRONTEND_TOOLS: &[&str] = &[
        "get_app_state",
        "list_menu_commands",
        "run_menu_command",
        "show_panel",
        "open_settings",
        "close_dialog",
        "set_active_repository",
        "open_file",
        "close_tab",
        "get_editor_text",
        "get_editor_selection",
        "set_markdown_mode",
        "save_file",
        "create_file",
        "create_folder",
        "rename_path",
        "copy_paths",
        "move_paths",
        "trash_paths",
        "show_commit",
        "show_changes_diff",
        "list_scripts",
        "run_script",
        "stop_run",
        "list_terminals",
        "new_terminal",
        "send_terminal_text",
        "get_ui_performance",
        "inspect_elements",
        "scroll_view",
    ];

    #[test]
    fn backend_tools_leave_the_frontend_names_free() {
        for &tool_name in FRONTEND_TOOLS {
            assert!(tools::find(tool_name).is_none(), "{tool_name} clashes with a backend tool");
        }
    }

    #[test]
    fn ui_tools_need_a_free_snake_case_name() {
        let (accepted, refused) = accepted_ui_tools(vec![
            def("open_file"),
            def("open_file"),
            def("git_status"),
            def("Bad-Name"),
            def(""),
            def("show_toast"),
        ]);
        let names: Vec<&str> = accepted.iter().map(|tool| tool.name.as_str()).collect();
        assert_eq!(names, ["open_file", "show_toast"]);
        assert_eq!(refused.len(), 4, "{refused:?}");
        assert!(refused.iter().any(|reason| reason == "git_status is already a backend tool"));
        assert_eq!(accepted[0].input_schema["type"], "object");
        assert!(!accepted[0].read_only && accepted[0].destructive);
    }
}
