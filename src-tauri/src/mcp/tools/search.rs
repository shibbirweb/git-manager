//! Search Everywhere and Find in Files, one call at a time: each call walks the folders,
//! answers and drops its index, unlike the popup's session index.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

use serde_json::{json, Value};

use super::{json_out, object, Args, BackendTool, ToolCtx, ToolResult, SEARCH};
use crate::file_search::{self, lock};
use crate::symbols::{self, SymbolIndex, SymbolScope, MAX_SYMBOLS};
use crate::text_search::{self, TextFileMatches, TextSearchOptions};

const MAX_RESULTS: usize = 500;

fn folder_prop() -> Value {
    json!({ "type": "string", "description": "Search only this folder (absolute path). Default: every open workspace folder." })
}

fn limit_prop(default: usize) -> Value {
    json!({ "type": "integer", "description": format!("Results to return (default {default}, at most {MAX_RESULTS}).") })
}

pub const TOOLS: &[BackendTool] = &[
    BackendTool {
        name: "search_files",
        title: "Find files by name",
        description: "Fuzzy file name search over the workspace (like Go to File), best matches first. Respects .gitignore. A query like \"cart.ts:12\" also returns the line.",
        category: SEARCH,
        read_only: true,
        destructive: false,
        schema: files_schema,
        run: search_files,
    },
    BackendTool {
        name: "search_text",
        title: "Find in files",
        description: "Searches file contents across the workspace for text or a regular expression, returning matching lines with line and column numbers. Respects .gitignore; very large files are skipped.",
        category: SEARCH,
        read_only: true,
        destructive: false,
        schema: text_schema,
        run: search_text,
    },
    BackendTool {
        name: "search_symbols",
        title: "Find symbols",
        description: "Finds classes, functions, methods and other definitions by name across the workspace's source files, with file and line.",
        category: SEARCH,
        read_only: true,
        destructive: false,
        schema: symbols_schema,
        run: search_symbols,
    },
];

fn roots(ctx: &ToolCtx, args: &Args) -> Result<Vec<String>, String> {
    if args.opt_str("folderPath")?.is_some() {
        let folder = ctx.path(args, "folderPath")?;
        if !folder.is_dir() {
            return Err("folderPath is not a folder".to_string());
        }
        return Ok(vec![folder.to_string_lossy().into_owned()]);
    }
    let folders = ctx.folder_strings();
    if folders.is_empty() {
        return Err("No folder is open in Git Manager".to_string());
    }
    Ok(folders)
}

fn files_schema() -> Value {
    object(
        json!({
            "query": { "type": "string", "description": "Part of a file name or path, e.g. \"usercontr\" or \"src/cart\"." },
            "folderPath": folder_prop(),
            "limit": limit_prop(30),
        }),
        &["query"],
    )
}

fn search_files(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let query = args.str("query")?;
    let limit = args.usize("limit", 30, MAX_RESULTS)?;
    let index = file_search::build_once(&roots(ctx, args)?);
    let results = file_search::query_once(&index, query, limit);
    let items: Vec<Value> = results
        .items
        .iter()
        .map(|item| json!({ "path": item.path, "relativePath": item.relative_path, "root": item.root }))
        .collect();
    json_out(json!({
        "items": items,
        "matched": results.matched,
        "filesIndexed": results.indexed,
        "line": results.line,
        "column": results.column,
    }))
}

fn text_schema() -> Value {
    object(
        json!({
            "query": { "type": "string", "description": format!("The text (or regular expression) to find; at least {} characters.", text_search::MIN_QUERY_CHARS) },
            "regex": { "type": "boolean", "description": "Treat query as a regular expression (default false)." },
            "matchCase": { "type": "boolean", "description": "Match upper and lower case exactly (default false)." },
            "wholeWords": { "type": "boolean", "description": "Only whole words (default false)." },
            "folderPath": folder_prop(),
            "limit": limit_prop(200),
        }),
        &["query"],
    )
}

fn search_text(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let query = args.str("query")?;
    let options = TextSearchOptions {
        match_case: args.bool("matchCase", false)?,
        whole_words: args.bool("wholeWords", false)?,
        regex: args.bool("regex", false)?,
    };
    let limit = args.usize("limit", 200, MAX_RESULTS)?.max(1);
    let index = file_search::build_once(&roots(ctx, args)?);
    let found: Mutex<Vec<TextFileMatches>> = Mutex::new(Vec::new());
    let lines = AtomicUsize::new(0);
    let summary: Mutex<Value> = Mutex::new(Value::Null);
    text_search::search(
        &index,
        query,
        &options,
        &|| lines.load(Ordering::Relaxed) >= limit,
        &|batch| {
            let added: usize = batch.files.iter().map(|file| file.lines.len()).sum();
            lines.fetch_add(added, Ordering::Relaxed);
            lock(&found).extend(batch.files);
            if batch.done {
                *lock(&summary) = json!({
                    "filesSearched": batch.files_searched,
                    "more": batch.more,
                    "error": batch.error,
                });
            }
        },
    );
    let summary = std::mem::take(&mut *lock(&summary));
    if let Some(error) = summary["error"].as_str() {
        return Err(error.to_string());
    }
    let mut remaining = limit;
    let mut cut = false;
    let mut files = Vec::new();
    for file in lock(&found).iter() {
        if remaining == 0 {
            cut = true;
            break;
        }
        let shown: Vec<Value> = file
            .lines
            .iter()
            .take(remaining)
            .map(|line| json!({ "line": line.line, "column": line.column, "text": line.text }))
            .collect();
        cut |= shown.len() < file.lines.len();
        remaining -= shown.len();
        files.push(json!({ "path": file.path, "relativePath": file.relative_path, "lines": shown }));
    }
    let more = cut || summary["more"].as_bool().unwrap_or(false) || lines.load(Ordering::Relaxed) > limit;
    json_out(json!({
        "files": files,
        "matchingLines": limit - remaining,
        "filesSearched": summary["filesSearched"],
        "more": more,
    }))
}

fn symbols_schema() -> Value {
    object(
        json!({
            "query": { "type": "string", "description": "Part of the symbol name, e.g. \"addItem\" or \"Cart.add\"." },
            "scope": { "type": "string", "enum": ["all", "classes", "members"], "description": "all (default), classes (classes, structs, interfaces...) or members (everything else)." },
            "folderPath": folder_prop(),
            "limit": limit_prop(50),
        }),
        &["query"],
    )
}

fn search_symbols(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let query = args.str("query")?;
    let scope = match args.opt_str("scope")?.unwrap_or("all") {
        "all" => SymbolScope::All,
        "classes" => SymbolScope::Classes,
        "members" => SymbolScope::Members,
        other => return Err(format!("Unknown scope: {other}")),
    };
    let limit = args.usize("limit", 50, MAX_RESULTS)?;
    let files = file_search::build_once(&roots(ctx, args)?);
    let index = SymbolIndex::new(files, MAX_SYMBOLS);
    symbols::build(&index, &|_| {});
    let results = symbols::search(&index, query, scope, limit, &|| false);
    let items: Vec<Value> = results
        .items
        .iter()
        .map(|item| {
            json!({
                "name": item.name,
                "kind": item.kind,
                "container": item.container,
                "path": item.path,
                "line": item.line,
                "column": item.column,
            })
        })
        .collect();
    json_out(json!({ "items": items, "matched": results.matched, "filesScanned": results.files }))
}
