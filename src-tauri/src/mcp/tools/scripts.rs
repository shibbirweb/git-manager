use serde_json::{json, Value};

use super::{json_out, no_args, object, Args, BackendTool, ToolCtx, ToolResult, SCRIPTS};
use crate::{node_versions, scripts};

pub const TOOLS: &[BackendTool] = &[
    BackendTool {
        name: "scan_project_scripts",
        title: "Scan project scripts",
        description: "Every runnable script in the workspace (the Scripts panel): package.json, composer.json, deno.json, Makefile and justfile targets, with their commands and the Node version each package asks for.",
        category: SCRIPTS,
        read_only: true,
        destructive: false,
        schema: list_schema,
        run: scan_project_scripts,
    },
    BackendTool {
        name: "list_node_versions",
        title: "List Node versions",
        description: "The Node.js versions installed on this machine (nvm, fnm, Volta, asdf, Homebrew and others), newest first.",
        category: SCRIPTS,
        read_only: true,
        destructive: false,
        schema: no_args,
        run: list_node_versions,
    },
];

fn list_schema() -> Value {
    object(
        json!({
            "folderPath": { "type": "string", "description": "Only this folder (absolute path). Default: every open workspace folder." },
        }),
        &[],
    )
}

fn scan_project_scripts(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let folders = match args.opt_str("folderPath")? {
        Some(_) => vec![ctx.path(args, "folderPath")?.to_string_lossy().into_owned()],
        None => ctx.folder_strings(),
    };
    json_out(json!({ "sources": scripts::list_project_scripts(&folders) }))
}

fn list_node_versions(_ctx: &ToolCtx, _args: &Args) -> ToolResult {
    json_out(json!({ "versions": node_versions::installed_here() }))
}
