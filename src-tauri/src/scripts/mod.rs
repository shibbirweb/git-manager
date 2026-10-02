//! The Scripts tool window: finds the runnable scripts of the workspace folders
//! (package.json, composer.json, Makefile, deno.json and justfile) so the UI can
//! run them in the integrated terminal. Nothing is cached; every call rescans.

mod composer;
mod deno;
mod json;
mod justfile;
mod makefile;
mod node_wanted;
mod package_json;

#[cfg(test)]
mod tests;

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use ignore::{DirEntry, WalkBuilder};
use serde::Serialize;

const MAX_DEPTH: usize = 6;
/// Total manifest files read per call, so a huge tree cannot stall the panel.
const MAX_FILES: usize = 300;
const MAX_FILE_BYTES: u64 = 1024 * 1024;
const MAX_COMMAND_CHARS: usize = 300;

const SKIPPED_DIRS: &[&str] = &[
    "node_modules",
    "vendor",
    "target",
    ".git",
    "dist",
    "build",
    "out",
    ".next",
    ".svelte-kit",
    "bower_components",
    "Pods",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ScriptKind {
    Npm,
    Composer,
    Make,
    Deno,
    Just,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptSource {
    pub kind: ScriptKind,
    /// Absolute path of the manifest file.
    pub file_path: String,
    /// Absolute directory of the manifest: the working directory to run in.
    pub folder_path: String,
    /// The workspace folder it was found under, as given.
    pub workspace_folder: String,
    /// The program that runs the scripts, such as "pnpm" or "make".
    pub runner: String,
    pub package_name: Option<String>,
    /// In file order.
    pub scripts: Vec<ProjectScript>,
    /// Set, with no scripts, when the file could not be read or parsed.
    pub error: Option<String>,
    /// package.json only: the Node version the project asks for, if it says.
    pub node_version: Option<NodeWanted>,
}

/// A Node version asked for by `.nvmrc`, `.node-version`, `.tool-versions` or package.json.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeWanted {
    /// As written: "18", "v20.11.1", "lts/iron", ">=18 <21"...
    pub spec: String,
    /// Where it came from, for the UI: ".nvmrc", "package.json engines.node"...
    pub source: String,
    /// Absolute path of that file.
    pub file_path: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectScript {
    pub name: String,
    /// What it runs, cut to about 300 characters.
    pub command: String,
    /// 1-based line of the name in the file; 0 if unknown.
    pub line: u32,
}

impl ProjectScript {
    fn new(name: impl Into<String>, command: &str, line: u32) -> Self {
        ProjectScript {
            name: name.into(),
            command: shorten(command),
            line,
        }
    }
}

/// What a format parser read from one file.
#[derive(Debug, Default, PartialEq)]
struct Parsed {
    package_name: Option<String>,
    scripts: Vec<ProjectScript>,
    /// package.json only: the "packageManager" field.
    package_manager: Option<String>,
    /// package.json only: volta.node or engines.node, with which of the two it was.
    node_wanted: Option<(String, &'static str)>,
}

fn shorten(command: &str) -> String {
    let command = command.trim();
    match command.char_indices().nth(MAX_COMMAND_CHARS) {
        Some((cut, _)) => format!("{}...", command[..cut].trim_end()),
        None => command.to_string(),
    }
}

fn kind_of(file_name: &str) -> Option<ScriptKind> {
    match file_name {
        "package.json" => Some(ScriptKind::Npm),
        "composer.json" => Some(ScriptKind::Composer),
        "Makefile" | "makefile" | "GNUmakefile" => Some(ScriptKind::Make),
        "deno.json" | "deno.jsonc" => Some(ScriptKind::Deno),
        "justfile" | "Justfile" | ".justfile" => Some(ScriptKind::Just),
        _ => None,
    }
}

struct Found {
    workspace_index: usize,
    depth: usize,
    kind: ScriptKind,
    file_path: PathBuf,
}

/// Lists the scripts of every manifest under `folder_paths`, in folder order,
/// then shallow files first, then by path.
pub fn list_project_scripts(folder_paths: &[String]) -> Vec<ScriptSource> {
    let mut found: Vec<Found> = Vec::new();
    let mut seen: HashSet<PathBuf> = HashSet::new();
    for (workspace_index, folder_path) in folder_paths.iter().enumerate() {
        if found.len() >= MAX_FILES {
            break;
        }
        collect_folder(workspace_index, Path::new(folder_path), &mut found, &mut seen);
    }
    found.sort_by(|left, right| {
        (left.workspace_index, left.depth, &left.file_path).cmp(&(right.workspace_index, right.depth, &right.file_path))
    });
    found
        .into_iter()
        .filter_map(|file| read_source(&file, &folder_paths[file.workspace_index]))
        .collect()
}

fn collect_folder(workspace_index: usize, folder: &Path, found: &mut Vec<Found>, seen: &mut HashSet<PathBuf>) {
    if !folder.is_dir() {
        return;
    }
    let walker = WalkBuilder::new(folder)
        // Hidden entries are skipped by `keep_entry`, which lets `.justfile` through.
        .hidden(false)
        // A plain folder's .gitignore still says what is generated.
        .require_git(false)
        .follow_links(false)
        .max_depth(Some(MAX_DEPTH))
        .sort_by_file_name(|left, right| left.cmp(right))
        .filter_entry(keep_entry)
        .build();
    for entry in walker.flatten() {
        if found.len() >= MAX_FILES {
            return;
        }
        let is_file = entry.file_type().map(|kind| kind.is_file()).unwrap_or(false);
        if !is_file {
            continue;
        }
        let Some(kind) = entry.file_name().to_str().and_then(kind_of) else {
            continue;
        };
        let too_big = entry.metadata().map(|metadata| metadata.len() > MAX_FILE_BYTES).unwrap_or(true);
        if too_big {
            continue;
        }
        let file_path = entry.path().to_path_buf();
        // A workspace folder inside another one would list its files twice.
        let canonical = std::fs::canonicalize(&file_path).unwrap_or_else(|_| file_path.clone());
        if !seen.insert(canonical) {
            continue;
        }
        found.push(Found {
            workspace_index,
            depth: entry.depth(),
            kind,
            file_path,
        });
    }
}

fn keep_entry(entry: &DirEntry) -> bool {
    if entry.depth() == 0 {
        return true;
    }
    let Some(name) = entry.file_name().to_str() else {
        return false;
    };
    let is_dir = entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false);
    if is_dir {
        return !name.starts_with('.') && !SKIPPED_DIRS.contains(&name);
    }
    !name.starts_with('.') || name == ".justfile"
}

fn read_source(file: &Found, workspace_folder: &str) -> Option<ScriptSource> {
    let file_name = file.file_path.file_name().and_then(|name| name.to_str()).unwrap_or_default();
    let folder = file.file_path.parent().unwrap_or(Path::new(""));
    let parsed = std::fs::read(&file.file_path)
        .map_err(|err| err.to_string())
        .and_then(|bytes| parse_file(file.kind, &String::from_utf8_lossy(&bytes)));
    let (package_name, package_manager, node_in_manifest, scripts, error) = match parsed {
        Ok(parsed) => {
            if parsed.scripts.is_empty() {
                return None;
            }
            (parsed.package_name, parsed.package_manager, parsed.node_wanted, parsed.scripts, None)
        }
        Err(reason) => (None, None, None, Vec::new(), Some(format!("Could not read {file_name}: {reason}"))),
    };
    let node_version = match file.kind {
        ScriptKind::Npm => node_wanted::find(folder, Path::new(workspace_folder)).or_else(|| {
            node_in_manifest.map(|(spec, source)| NodeWanted {
                spec,
                source: source.to_string(),
                file_path: file.file_path.to_string_lossy().into_owned(),
            })
        }),
        _ => None,
    };
    let runner = match file.kind {
        ScriptKind::Npm => {
            package_json::runner(package_manager.as_deref(), folder, Path::new(workspace_folder))
        }
        ScriptKind::Composer => "composer".to_string(),
        ScriptKind::Make => "make".to_string(),
        ScriptKind::Deno => "deno".to_string(),
        ScriptKind::Just => "just".to_string(),
    };
    Some(ScriptSource {
        kind: file.kind,
        file_path: file.file_path.to_string_lossy().into_owned(),
        folder_path: folder.to_string_lossy().into_owned(),
        workspace_folder: workspace_folder.to_string(),
        runner,
        package_name,
        scripts,
        error,
        node_version,
    })
}

fn parse_file(kind: ScriptKind, text: &str) -> Result<Parsed, String> {
    match kind {
        ScriptKind::Npm => package_json::parse(text),
        ScriptKind::Composer => composer::parse(text),
        ScriptKind::Deno => deno::parse(text),
        ScriptKind::Make => Ok(makefile::parse(text)),
        ScriptKind::Just => Ok(justfile::parse(text)),
    }
}

/// JSON manifests: a repeated key wins, as with `JSON.parse`, but keeps its first place.
fn set_script(scripts: &mut Vec<ProjectScript>, script: ProjectScript) {
    match scripts.iter_mut().find(|existing| existing.name == script.name) {
        Some(existing) => {
            *existing = script;
        }
        None => {
            scripts.push(script);
        }
    }
}

fn string_field(manifest: &json::Value, key: &str) -> Option<String> {
    manifest.get(key).and_then(json::Value::as_str).map(str::to_string)
}
