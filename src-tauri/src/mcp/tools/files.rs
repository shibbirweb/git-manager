use std::path::{Path, PathBuf};

use serde_json::{json, Value};

use super::{done, json_out, object, Args, BackendTool, ToolCtx, ToolOutput, ToolResult, FILES};
use crate::git::files;
use crate::git::workspace::relative_slash_path;

const DEFAULT_MAX_BYTES: usize = 256 * 1024;
const MAX_BYTES: usize = 1024 * 1024;

pub const TOOLS: &[BackendTool] = &[
    BackendTool {
        name: "read_file",
        title: "Read file",
        description: "Reads a text file from the workspace, optionally only a line range. Binary files and files over 4 MB are refused; long text is cut at maxBytes.",
        category: FILES,
        read_only: true,
        destructive: false,
        schema: read_schema,
        run: read_file,
    },
    BackendTool {
        name: "list_directory",
        title: "List folder",
        description: "Lists one folder of the workspace: folders first, then files, with whether each is git-ignored or a repository root.",
        category: FILES,
        read_only: true,
        destructive: false,
        schema: list_schema,
        run: list_directory,
    },
    BackendTool {
        name: "write_file",
        title: "Write file",
        description: "Creates or overwrites a text file in the workspace with the given content. Overwriting replaces the old content for good.",
        category: FILES,
        read_only: false,
        destructive: true,
        schema: write_schema,
        run: write_file,
    },
];

fn read_schema() -> Value {
    object(
        json!({
            "filePath": { "type": "string", "description": "Absolute path of the file, inside an open workspace folder." },
            "startLine": { "type": "integer", "description": "First line to return (1-based, default 1)." },
            "endLine": { "type": "integer", "description": "Last line to return (default the end)." },
            "maxBytes": { "type": "integer", "description": format!("Cut the text after this many bytes (default {DEFAULT_MAX_BYTES}, at most {MAX_BYTES}).") },
        }),
        &["filePath"],
    )
}

/// The lines `start..=end` (1-based) of `content`, cut at `max_bytes` on a line boundary.
pub fn line_range(content: &str, start: usize, end: Option<usize>, max_bytes: usize) -> (String, usize, usize, bool) {
    let lines: Vec<&str> = content.split_inclusive('\n').collect();
    let total = lines.len();
    let start = start.max(1);
    let end = end.unwrap_or(total).min(total);
    let mut text = String::new();
    let mut last = start.saturating_sub(1);
    let mut truncated = false;
    for line in lines.iter().take(end).skip(start - 1) {
        if text.len() + line.len() > max_bytes {
            truncated = true;
            break;
        }
        text.push_str(line);
        last += 1;
    }
    (text, total, last, truncated)
}

fn read_file(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let full_path = ctx.path(args, "filePath")?;
    if full_path.is_dir() {
        return Err("This is a folder; use list_directory".to_string());
    }
    let shown = full_path.to_string_lossy().into_owned();
    let file = files::read_file(&full_path, &shown).map_err(|err| err.to_string())?;
    if file.too_large {
        return Err(format!("The file is too large to read ({} bytes)", file.size));
    }
    if file.binary {
        return Err("This is a binary file".to_string());
    }
    let start = args.usize("startLine", 1, usize::MAX)?;
    let end = args.opt_u64("endLine")?.map(|end| end as usize);
    let max_bytes = args.usize("maxBytes", DEFAULT_MAX_BYTES, MAX_BYTES)?;
    let (mut text, total, last, truncated) = line_range(&file.content, start, end, max_bytes);
    let partial = start > 1 || last < total;
    if partial || truncated {
        if !text.is_empty() && !text.ends_with('\n') {
            text.push('\n');
        }
        text.push_str(&format!(
            "[Lines {}-{last} of {total}. Ask with startLine and endLine for the rest.]",
            start.max(1)
        ));
    }
    Ok(ToolOutput::Text(text))
}

fn list_schema() -> Value {
    object(
        json!({
            "folderPath": { "type": "string", "description": "Absolute path of the folder, inside an open workspace folder." },
        }),
        &["folderPath"],
    )
}

/// The enclosing repository and the repositories directly inside `dir`, for the ignored and isRepo flags.
fn repo_roots_near(dir: &Path) -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = git2::Repository::discover(dir)
        .ok()
        .and_then(|repo| repo.workdir().and_then(|workdir| workdir.canonicalize().ok()))
        .into_iter()
        .collect();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.join(".git").exists() {
                if let Ok(canonical) = path.canonicalize() {
                    roots.push(canonical);
                }
            }
        }
    }
    roots
}

fn list_directory(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let full_dir = ctx.path(args, "folderPath")?;
    if !full_dir.is_dir() {
        return Err("Not a folder".to_string());
    }
    let folders = ctx.folders();
    let root = folders
        .iter()
        .filter(|folder| full_dir.starts_with(folder))
        .max_by_key(|folder| folder.components().count())
        .cloned()
        .unwrap_or_else(|| full_dir.clone());
    let dir_path = relative_slash_path(&root, &full_dir);
    let listing = files::list_dir(&full_dir, &dir_path, &repo_roots_near(&full_dir)).map_err(|err| err.to_string())?;
    let entries: Vec<Value> = listing
        .entries
        .iter()
        .map(|entry| {
            json!({
                "name": entry.name,
                "path": full_dir.join(&entry.name).to_string_lossy(),
                "isDir": entry.is_dir,
                "ignored": entry.ignored,
                "isRepo": entry.is_repo,
            })
        })
        .collect();
    json_out(json!({ "folderPath": full_dir.to_string_lossy(), "entries": entries, "truncated": listing.truncated }))
}

fn write_schema() -> Value {
    object(
        json!({
            "filePath": { "type": "string", "description": "Absolute path of the file, inside an open workspace folder." },
            "content": { "type": "string", "description": "The full new content." },
            "createFolders": { "type": "boolean", "description": "Create missing parent folders (default true)." },
        }),
        &["filePath", "content"],
    )
}

fn write_file(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let full_path = ctx.path(args, "filePath")?;
    let content = args.text("content")?;
    if full_path.components().any(|component| component.as_os_str() == ".git") {
        return Err("Files inside .git are not written".to_string());
    }
    if full_path.is_dir() {
        return Err("This is a folder".to_string());
    }
    if let Some(parent) = full_path.parent() {
        if !parent.is_dir() {
            if !args.bool("createFolders", true)? {
                return Err("The parent folder does not exist".to_string());
            }
            std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
    }
    let existed = full_path.exists();
    std::fs::write(&full_path, content).map_err(|err| err.to_string())?;
    let verb = if existed { "Wrote" } else { "Created" };
    done(format!("{verb} {} ({} bytes).", full_path.display(), content.len()))
}

#[cfg(test)]
mod tests {
    use super::line_range;

    #[test]
    fn line_ranges_stop_at_the_end_and_the_size_limit() {
        let text = "one\ntwo\nthree\nfour";
        assert_eq!(line_range(text, 1, None, 1000), (text.to_string(), 4, 4, false));
        assert_eq!(line_range(text, 2, Some(3), 1000), ("two\nthree\n".to_string(), 4, 3, false));
        assert_eq!(line_range(text, 3, Some(99), 1000), ("three\nfour".to_string(), 4, 4, false));
        assert_eq!(line_range(text, 1, None, 9), ("one\ntwo\n".to_string(), 4, 2, true));
        assert_eq!(line_range(text, 9, None, 1000), (String::new(), 4, 8, false));
    }
}
