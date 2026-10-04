//! Workspace files: a saved set of folders, compatible with the
//! `.code-workspace` format (`{"folders": [{"path": "..."}]}`, JSON with
//! comments). Paths are stored relative to the file when they share a parent.

use crate::paths::RealPath;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use serde_json::{json, Map, Value};

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFile {
    /// Workspace name: the file name without its extension.
    pub name: String,
    /// Canonical absolute folder paths that exist.
    pub folders: Vec<String>,
    /// Folders listed in the file that could not be found.
    pub missing: Vec<String>,
}

/// Removes `//` and `/* */` comments and trailing commas, leaving strings intact.
pub fn strip_jsonc(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let chars: Vec<char> = text.chars().collect();
    let mut index = 0;
    let mut in_string = false;
    while index < chars.len() {
        let current = chars[index];
        let next = chars.get(index + 1).copied();
        if in_string {
            out.push(current);
            if current == '\\' {
                if let Some(escaped) = next {
                    out.push(escaped);
                    index += 2;
                    continue;
                }
            } else if current == '"' {
                in_string = false;
            }
            index += 1;
            continue;
        }
        match (current, next) {
            ('"', _) => {
                in_string = true;
                out.push(current);
                index += 1;
            }
            ('/', Some('/')) => {
                while index < chars.len() && chars[index] != '\n' {
                    index += 1;
                }
            }
            ('/', Some('*')) => {
                index += 2;
                while index + 1 < chars.len() && !(chars[index] == '*' && chars[index + 1] == '/') {
                    index += 1;
                }
                index += 2;
            }
            (',', _) => {
                // Drop a comma that only has whitespace before a closing bracket.
                let mut lookahead = index + 1;
                while lookahead < chars.len() && chars[lookahead].is_whitespace() {
                    lookahead += 1;
                }
                if !matches!(chars.get(lookahead), Some(']') | Some('}')) {
                    out.push(current);
                }
                index += 1;
            }
            _ => {
                out.push(current);
                index += 1;
            }
        }
    }
    out
}

fn parse(text: &str, file: &Path) -> AppResult<Value> {
    serde_json::from_str(&strip_jsonc(text))
        .map_err(|err| AppError::invalid(format!("{} is not a valid workspace file: {err}", file.display())))
}

/// `target` relative to `base` when they share more than the filesystem root.
pub fn relative_path(base: &Path, target: &Path) -> Option<String> {
    let base: Vec<Component> = base.components().collect();
    let target: Vec<Component> = target.components().collect();
    let common = base.iter().zip(&target).take_while(|(a, b)| a == b).count();
    if common <= 1 {
        return None;
    }
    let mut parts: Vec<String> = vec!["..".to_string(); base.len() - common];
    parts.extend(target[common..].iter().map(|part| part.as_os_str().to_string_lossy().into_owned()));
    Some(if parts.is_empty() { ".".to_string() } else { parts.join("/") })
}

fn name_of(file: &Path) -> String {
    let name = file.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
    for suffix in [".gitmanager-workspace", ".code-workspace"] {
        if let Some(stem) = name.strip_suffix(suffix) {
            return stem.to_string();
        }
    }
    name
}

/// Canonical path of an existing folder entry, relative to the workspace file's folder.
fn resolve_folder(base: &Path, path: &str) -> Option<String> {
    let expanded = match path.strip_prefix("~/") {
        Some(rest) => crate::config::home_dir().unwrap_or_default().join(rest),
        None => PathBuf::from(path),
    };
    let full = if expanded.is_absolute() { expanded } else { base.join(expanded) };
    match full.real_path() {
        Ok(canonical) if canonical.is_dir() => Some(crate::paths::to_ui(&canonical)),
        _ => None,
    }
}

pub fn read(file: &Path) -> AppResult<WorkspaceFile> {
    let text = std::fs::read_to_string(file)?;
    let value = parse(&text, file)?;
    let base = file.parent().unwrap_or_else(|| Path::new("/"));
    let mut folders = Vec::new();
    let mut missing = Vec::new();
    for entry in value.get("folders").and_then(Value::as_array).cloned().unwrap_or_default() {
        let Some(path) = entry.get("path").and_then(Value::as_str) else {
            continue;
        };
        match resolve_folder(base, path) {
            Some(text) => {
                if !folders.contains(&text) {
                    folders.push(text);
                }
            }
            None => missing.push(path.to_string()),
        }
    }
    Ok(WorkspaceFile {
        name: name_of(file),
        folders,
        missing,
    })
}

/// The `folders` array for `folders`, reusing each existing entry that points
/// at one of them so other keys like `name` survive. Entries the app does not
/// open (missing folders, `uri` folders) are kept at the end: they never appear
/// in the folder list, so the user had no way to remove them.
fn folder_entries(existing: &[Value], base: &Path, folders: &[String]) -> Vec<Value> {
    let resolved: Vec<Option<String>> = existing
        .iter()
        .map(|entry| entry.get("path").and_then(Value::as_str).and_then(|path| resolve_folder(base, path)))
        .collect();
    let mut used = vec![false; existing.len()];
    let mut entries = Vec::new();
    for folder in folders {
        let canonical = Path::new(folder)
            .real_path()
            .map(crate::paths::to_ui)
            .unwrap_or_else(|_| folder.clone());
        let reused = (0..existing.len()).find(|&index| !used[index] && resolved[index].as_deref() == Some(canonical.as_str()));
        match reused {
            Some(index) => {
                used[index] = true;
                entries.push(existing[index].clone());
            }
            None => {
                let path = relative_path(base, Path::new(&canonical)).unwrap_or(canonical);
                entries.push(json!({ "path": path }));
            }
        }
    }
    for (index, entry) in existing.iter().enumerate() {
        if !used[index] && resolved[index].is_none() {
            entries.push(entry.clone());
        }
    }
    entries
}

/// Index just past whitespace and comments.
fn skip_trivia(bytes: &[u8], mut index: usize) -> usize {
    loop {
        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        let next = bytes.get(index + 1).copied();
        if bytes.get(index) == Some(&b'/') && next == Some(b'/') {
            while index < bytes.len() && bytes[index] != b'\n' {
                index += 1;
            }
        } else if bytes.get(index) == Some(&b'/') && next == Some(b'*') {
            index += 2;
            while index < bytes.len() && !(bytes[index] == b'*' && bytes.get(index + 1) == Some(&b'/')) {
                index += 1;
            }
            index = (index + 2).min(bytes.len());
        } else {
            return index;
        }
    }
}

/// Index just past the string that starts at `index`.
fn skip_string(bytes: &[u8], mut index: usize) -> usize {
    index += 1;
    while index < bytes.len() {
        match bytes[index] {
            b'\\' => index += 2,
            b'"' => return index + 1,
            _ => index += 1,
        }
    }
    bytes.len()
}

/// Index just past the bracket that closes the one at `open`.
fn matching_close(bytes: &[u8], open: usize) -> Option<usize> {
    let mut depth = 0usize;
    let mut index = open;
    while index < bytes.len() {
        index = skip_trivia(bytes, index);
        match bytes.get(index) {
            Some(b'"') => {
                index = skip_string(bytes, index);
                continue;
            }
            Some(b'[' | b'{') => depth += 1,
            Some(b']' | b'}') => {
                depth -= 1;
                if depth == 0 {
                    return Some(index + 1);
                }
            }
            Some(_) => {}
            None => return None,
        }
        index += 1;
    }
    None
}

/// Where the top-level `"folders"` array sits in the file text.
struct FoldersSpan {
    /// Byte range of the array value, brackets included.
    value: (usize, usize),
    /// Leading whitespace of the line with the `"folders"` key.
    indent: String,
}

fn folders_span(text: &str) -> Option<FoldersSpan> {
    let bytes = text.as_bytes();
    let mut depth = 0usize;
    let mut index = 0;
    while index < bytes.len() {
        index = skip_trivia(bytes, index);
        match bytes.get(index) {
            Some(b'"') => {
                let end = skip_string(bytes, index);
                let colon = skip_trivia(bytes, end);
                if depth == 1 && bytes.get(colon) == Some(&b':') && text.get(index + 1..end - 1) == Some("folders") {
                    let start = skip_trivia(bytes, colon + 1);
                    if bytes.get(start) != Some(&b'[') {
                        return None;
                    }
                    let line_start = text[..index].rfind('\n').map(|at| at + 1).unwrap_or(0);
                    let lead = &text[line_start..index];
                    let indent = if lead.chars().all(char::is_whitespace) { lead.to_string() } else { String::new() };
                    return Some(FoldersSpan {
                        value: (start, matching_close(bytes, start)?),
                        indent,
                    });
                }
                index = end;
                continue;
            }
            Some(b'[' | b'{') => depth += 1,
            Some(b']' | b'}') => depth = depth.saturating_sub(1),
            Some(_) => {}
            None => break,
        }
        index += 1;
    }
    None
}

/// Pretty JSON with `unit` as one indent level and `indent` before every line after the first.
fn pretty(value: &Value, unit: &str, indent: &str) -> AppResult<String> {
    let mut out = Vec::new();
    let formatter = serde_json::ser::PrettyFormatter::with_indent(unit.as_bytes());
    let mut serializer = serde_json::Serializer::with_formatter(&mut out, formatter);
    value.serialize(&mut serializer).map_err(|err| AppError::invalid(err.to_string()))?;
    let text = String::from_utf8(out).map_err(|err| AppError::invalid(err.to_string()))?;
    // Raw newlines only appear between tokens: JSON strings escape theirs.
    Ok(text.replace('\n', &format!("\n{indent}")))
}

/// Replaces only the `folders` array in the original text, so comments and the
/// layout of every other key stay as the user wrote them. Comments inside the
/// old array are lost. None when there is nothing safe to edit in place.
fn splice_folders(text: &str, entries: &Value, has_folders: bool) -> AppResult<Option<String>> {
    if let Some(span) = folders_span(text) {
        let unit = if span.indent.is_empty() { "  ".to_string() } else { span.indent.clone() };
        let array = pretty(entries, &unit, &span.indent)?;
        return Ok(Some(format!("{}{array}{}", &text[..span.value.0], &text[span.value.1..])));
    }
    if has_folders {
        // `folders` is there but not an array: inserting another would duplicate the key.
        return Ok(None);
    }
    let bytes = text.as_bytes();
    let open = skip_trivia(bytes, 0);
    if bytes.get(open) != Some(&b'{') {
        return Ok(None);
    }
    let array = pretty(entries, "  ", "  ")?;
    let empty = bytes.get(skip_trivia(bytes, open + 1)) == Some(&b'}');
    let inserted = if empty { format!("\n  \"folders\": {array}\n") } else { format!("\n  \"folders\": {array},") };
    Ok(Some(format!("{}{inserted}{}", &text[..=open], &text[open + 1..])))
}

/// Temp file then rename, like the config files, so a crash never leaves half a file.
fn write_atomically(file: &Path, text: &str) -> AppResult<()> {
    // Writing to a symlink's target keeps the link itself in place.
    let target = file.real_path().unwrap_or_else(|_| file.to_path_buf());
    let parent = target.parent().map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from("."));
    std::fs::create_dir_all(&parent)?;
    let name = target.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
    let temp = parent.join(format!(".{name}.tmp"));
    std::fs::write(&temp, text)?;
    if let Err(err) = std::fs::rename(&temp, &target) {
        let _ = std::fs::remove_file(&temp);
        return Err(err.into());
    }
    Ok(())
}

/// Writes `folders` into `file`, keeping every other key of an existing file,
/// the per-folder keys of folders that remain, and comments outside `folders`.
pub fn write(file: &Path, folders: &[String]) -> AppResult<()> {
    let existing = match std::fs::read_to_string(file) {
        Ok(text) => Some(text),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => None,
        Err(err) => return Err(err.into()),
    };
    let mut root = match &existing {
        Some(text) => match parse(text, file)? {
            Value::Object(map) => map,
            _ => Map::new(),
        },
        None => Map::new(),
    };
    if let Some(parent) = file.parent() {
        // Created first so the relative paths are computed from its canonical path.
        std::fs::create_dir_all(parent)?;
    }
    let base = file
        .parent()
        .map(|parent| parent.real_path().unwrap_or_else(|_| parent.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("/"));
    let old_entries = root.get("folders").and_then(Value::as_array).cloned().unwrap_or_default();
    let entries = Value::Array(folder_entries(&old_entries, &base, folders));

    if let Some(text) = &existing {
        if let Some(spliced) = splice_folders(text, &entries, root.contains_key("folders"))? {
            // Only trust the in-place edit when it reads back to the same folders.
            let same = parse(&spliced, file).ok().and_then(|value| value.get("folders").cloned()) == Some(entries.clone());
            if same {
                return write_atomically(file, &spliced);
            }
        }
    }

    // A new file, or one the in-place edit could not handle: write it out
    // whole, which drops comments.
    root.insert("folders".to_string(), entries);
    root.entry("settings".to_string()).or_insert_with(|| json!({}));
    let mut text = serde_json::to_string_pretty(&Value::Object(root)).map_err(|err| AppError::invalid(err.to_string()))?;
    text.push('\n');
    write_atomically(file, &text)
}

#[cfg(test)]
mod tests {
    use crate::test_support::UiText;
    use super::*;

    fn canonical(path: &Path) -> String {
        path.real_path().unwrap().ui()
    }

    #[test]
    fn strips_comments_and_trailing_commas_but_not_strings() {
        let text = r#"{
          // a comment
          "folders": [{ "path": "a//b" }, /* block */ { "path": "c,]" },],
        }"#;
        let value: Value = serde_json::from_str(&strip_jsonc(text)).unwrap();
        assert_eq!(value["folders"][0]["path"], "a//b");
        assert_eq!(value["folders"][1]["path"], "c,]");
    }

    #[test]
    fn relative_paths_need_a_shared_parent() {
        assert_eq!(relative_path(Path::new("/work/ws"), Path::new("/work/ws/apps/web")).unwrap(), "apps/web");
        assert_eq!(relative_path(Path::new("/work/ws"), Path::new("/work/other")).unwrap(), "../other");
        assert_eq!(relative_path(Path::new("/work/ws"), Path::new("/work/ws")).unwrap(), ".");
        assert_eq!(relative_path(Path::new("/work"), Path::new("/private/tmp")), None);
    }

    #[test]
    fn round_trips_folders_and_keeps_other_keys() {
        let dir = tempfile::TempDir::new().unwrap();
        let web = dir.path().join("apps/web");
        let api = dir.path().join("apps/api");
        std::fs::create_dir_all(&web).unwrap();
        std::fs::create_dir_all(&api).unwrap();
        let file = dir.path().join("team.gitmanager-workspace");
        std::fs::write(&file, "{ \"settings\": { \"editor.tabSize\": 2 }, // keep me\n \"extensions\": {} }").unwrap();

        write(&file, &[canonical(&web), canonical(&api)]).unwrap();
        let text = std::fs::read_to_string(&file).unwrap();
        assert!(text.contains("\"path\": \"apps/web\""), "{text}");
        assert!(text.contains("editor.tabSize"));
        assert!(text.contains("extensions"));

        let read_back = read(&file).unwrap();
        assert_eq!(read_back.name, "team");
        assert_eq!(read_back.folders, vec![canonical(&web), canonical(&api)]);
        assert!(read_back.missing.is_empty());
    }

    #[test]
    fn reads_vs_code_files_and_reports_missing_folders() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::create_dir_all(dir.path().join("server")).unwrap();
        let file = dir.path().join("project.code-workspace");
        std::fs::write(&file, r#"{ "folders": [ { "path": "server", "name": "Backend" }, { "path": "gone" }, ] }"#).unwrap();
        let workspace = read(&file).unwrap();
        assert_eq!(workspace.name, "project");
        assert_eq!(workspace.folders, vec![canonical(&dir.path().join("server"))]);
        assert_eq!(workspace.missing, vec!["gone".to_string()]);
    }

    #[test]
    fn invalid_files_are_errors() {
        let dir = tempfile::TempDir::new().unwrap();
        let file = dir.path().join("bad.gitmanager-workspace");
        std::fs::write(&file, "{ folders: nope").unwrap();
        assert!(matches!(read(&file), Err(AppError::Invalid(_))));
        // A file that does not parse is never overwritten.
        assert!(matches!(write(&file, &[]), Err(AppError::Invalid(_))));
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "{ folders: nope");
    }

    #[test]
    fn keeps_folder_names_comments_and_unknown_entries() {
        let dir = tempfile::TempDir::new().unwrap();
        for folder in ["server", "client", "docs"] {
            std::fs::create_dir_all(dir.path().join(folder)).unwrap();
        }
        let file = dir.path().join("project.code-workspace");
        let original = "{\n\t// Team workspace\n\t\"folders\": [\n\t\t{ \"path\": \"server\", \"name\": \"Backend\" },\n\t\t{ \"path\": \"client\", \"name\": \"Frontend\" },\n\t\t{ \"path\": \"gone\", \"name\": \"Old\" },\n\t\t{ \"uri\": \"vscode-remote://ssh/box\" },\n\t],\n\t/* editor */ \"settings\": { \"editor.tabSize\": 4 },\n}\n";
        std::fs::write(&file, original).unwrap();

        // Remove client, keep server, add docs.
        write(&file, &[canonical(&dir.path().join("server")), canonical(&dir.path().join("docs"))]).unwrap();
        let text = std::fs::read_to_string(&file).unwrap();
        // Tabs as in the original; serde_json writes an entry's keys sorted.
        assert!(text.starts_with("{\n\t// Team workspace\n\t\"folders\": [\n\t\t{\n\t\t\t\"name\": \"Backend\",\n\t\t\t\"path\": \"server\""), "{text}");
        assert!(text.contains("/* editor */ \"settings\": { \"editor.tabSize\": 4 },"), "{text}");
        let value: Value = serde_json::from_str(&strip_jsonc(&text)).unwrap();
        assert_eq!(
            value["folders"],
            json!([
                { "path": "server", "name": "Backend" },
                { "path": "docs" },
                { "path": "gone", "name": "Old" },
                { "uri": "vscode-remote://ssh/box" },
            ])
        );
        assert!(!text.contains("Frontend"), "{text}");
        assert!(!dir.path().join(".project.code-workspace.tmp").exists());
    }

    #[test]
    fn adds_folders_to_a_file_without_them_and_creates_new_files() {
        let dir = tempfile::TempDir::new().unwrap();
        let web = dir.path().join("web");
        std::fs::create_dir_all(&web).unwrap();

        let empty = dir.path().join("empty.code-workspace");
        std::fs::write(&empty, "// nothing yet\n{}\n").unwrap();
        write(&empty, &[canonical(&web)]).unwrap();
        let text = std::fs::read_to_string(&empty).unwrap();
        assert!(text.starts_with("// nothing yet\n"), "{text}");
        assert_eq!(read(&empty).unwrap().folders, vec![canonical(&web)]);

        // `folders` that is not an array cannot be edited in place: rewritten whole.
        let odd = dir.path().join("odd.code-workspace");
        std::fs::write(&odd, "{ \"folders\": null, \"extensions\": {} }").unwrap();
        write(&odd, &[canonical(&web)]).unwrap();
        let value: Value = serde_json::from_str(&std::fs::read_to_string(&odd).unwrap()).unwrap();
        assert_eq!(value["folders"], json!([{ "path": "web" }]));
        assert!(value.get("extensions").is_some());

        let fresh = dir.path().join("nested/new.gitmanager-workspace");
        write(&fresh, &[canonical(&web)]).unwrap();
        let value: Value = serde_json::from_str(&std::fs::read_to_string(&fresh).unwrap()).unwrap();
        assert_eq!(value, json!({ "folders": [{ "path": "../web" }], "settings": {} }));
    }

    #[cfg(unix)]
    #[test]
    fn writes_through_a_symlink_to_its_target() {
        let dir = tempfile::TempDir::new().unwrap();
        let web = dir.path().join("web");
        std::fs::create_dir_all(&web).unwrap();
        let target = dir.path().join("real.code-workspace");
        std::fs::write(&target, "{ \"folders\": [] }").unwrap();
        let link = dir.path().join("link.code-workspace");
        std::os::unix::fs::symlink(&target, &link).unwrap();

        write(&link, &[canonical(&web)]).unwrap();
        assert!(std::fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert_eq!(read(&target).unwrap().folders, vec![canonical(&web)]);
    }
}
