use serde_json::json;

use super::{json_out, no_args, wait, Args, BackendTool, ToolCtx, ToolResult, WORKSPACE};
use crate::git::workspace;

pub const TOOLS: &[BackendTool] = &[
    BackendTool {
        name: "list_workspace",
        title: "List workspace",
        description: "Lists the windows of Git Manager with their folders, and the git repositories found in each folder (nested ones too). Start here to learn which repoPath and folder paths the other tools accept. UI tools act on the window holding their path argument, else on the window focused last (marked focused).",
        category: WORKSPACE,
        read_only: true,
        destructive: false,
        schema: no_args,
        run: list_workspace,
    },
    BackendTool {
        name: "get_app_info",
        title: "App info",
        description: "Git Manager's version, the operating system and whether the Git Console is recording commands.",
        category: WORKSPACE,
        read_only: true,
        destructive: false,
        schema: no_args,
        run: get_app_info,
    },
];

fn list_workspace(ctx: &ToolCtx, _args: &Args) -> ToolResult {
    let mut folders = Vec::new();
    for folder_path in ctx.folder_strings() {
        match workspace::open(&folder_path) {
            Ok(info) => folders.push(json!(info)),
            Err(err) => folders.push(json!({ "root": folder_path, "error": err.to_string() })),
        }
    }
    let focused = ctx.shared.focused_window();
    let windows: Vec<_> = ctx
        .shared
        .windows()
        .into_iter()
        .map(|window| {
            json!({
                "label": window.label,
                "title": window.title,
                "focused": focused.as_deref() == Some(window.label.as_str()),
                "folderPaths": window.folders.iter().map(crate::paths::to_ui).collect::<Vec<_>>(),
            })
        })
        .collect();
    let note = folders.is_empty().then_some("No folder is open in Git Manager. Open one in the app first.");
    json_out(json!({ "folders": folders, "windows": windows, "note": note }))
}

fn get_app_info(_ctx: &ToolCtx, _args: &Args) -> ToolResult {
    let os = wait(crate::commands::config::os_info())?;
    json_out(json!({
        "name": "Git Manager",
        "version": env!("CARGO_PKG_VERSION"),
        "os": os,
        "arch": std::env::consts::ARCH,
        "pid": std::process::id(),
        "gitConsoleEnabled": crate::git_console::global().is_enabled(),
    }))
}
