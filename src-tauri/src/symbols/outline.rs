//! The symbols of one file, for Quick Open's "@" mode (VS Code's Go to Symbol
//! in Editor): the scanners of the symbol index run on the editor's text, so
//! unsaved edits count, plus the headings of Markdown files. Nothing is kept:
//! the list is built per request and the frontend filters it.

use serde::Serialize;

use super::extract::{self, SymbolKind};
use super::MAX_NAME;

/// More symbols than this in one file are not worth listing.
pub const MAX_OUTLINE_ITEMS: usize = 5_000;
/// Bigger texts are generated or data: the outline stays empty.
pub const MAX_OUTLINE_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum HeadingKind {
    Heading,
}

/// A code definition's kind, or "heading" for Markdown.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum OutlineKind {
    Symbol(SymbolKind),
    Heading(HeadingKind),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineItem {
    pub name: String,
    pub kind: OutlineKind,
    pub container: Option<String>,
    /// 1-based.
    pub line: u32,
    /// 1-based, in UTF-16 code units like the editor.
    pub column: u32,
    /// Nesting for indentation: a heading's level minus one, 1 for a member of a class.
    pub depth: u8,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineResult {
    pub items: Vec<OutlineItem>,
    /// The file's language has a scanner (or is Markdown).
    pub supported: bool,
    /// Stopped at `MAX_OUTLINE_ITEMS`, or the text was too big to scan.
    pub truncated: bool,
}

fn is_markdown(file_path: &str) -> bool {
    let name = file_path.rsplit('/').next().unwrap_or(file_path);
    let Some((_, extension)) = name.rsplit_once('.') else {
        return false;
    };
    matches!(extension.to_ascii_lowercase().as_str(), "md" | "markdown" | "mdx")
}

/// The outline of `text`, read as the language of `file_path`.
pub fn outline(file_path: &str, text: &str) -> OutlineResult {
    let markdown = is_markdown(file_path);
    let language = if markdown { None } else { extract::language_for(file_path) };
    if !markdown && language.is_none() {
        return OutlineResult::default();
    }
    if text.len() > MAX_OUTLINE_BYTES {
        return OutlineResult { items: Vec::new(), supported: true, truncated: true };
    }
    let mut items = Vec::new();
    let mut truncated = false;
    if markdown {
        truncated = markdown_headings(text, &mut items);
    } else if let Some(language) = language {
        extract::extract(language, text, &mut |definition| {
            if definition.name.len() > MAX_NAME || definition.name == "_" {
                return;
            }
            if items.len() >= MAX_OUTLINE_ITEMS {
                truncated = true;
                return;
            }
            let container = definition.container.filter(|container| container.len() <= MAX_NAME);
            items.push(OutlineItem {
                name: definition.name.to_string(),
                kind: OutlineKind::Symbol(definition.kind),
                container: container.map(str::to_string),
                line: definition.line,
                column: definition.column.saturating_add(1),
                depth: u8::from(container.is_some()),
            });
        });
    }
    // The scanners report in text order; a stable sort keeps that promise for every language.
    items.sort_by_key(|item| (item.line, item.column));
    OutlineResult { items, supported: true, truncated }
}

/// ATX headings ("## Title") outside fenced code and front matter; true when capped.
fn markdown_headings(text: &str, items: &mut Vec<OutlineItem>) -> bool {
    let mut fence: Option<(u8, usize)> = None;
    let mut in_front_matter = false;
    for (index, raw) in text.lines().enumerate() {
        let line_number = index as u32 + 1;
        let line = raw.strip_suffix('\r').unwrap_or(raw);
        if index == 0 && line.trim_end() == "---" {
            in_front_matter = true;
            continue;
        }
        if in_front_matter {
            if line.trim_end() == "---" || line.trim_end() == "..." {
                in_front_matter = false;
            }
            continue;
        }
        let indent = line.len() - line.trim_start_matches(' ').len();
        let body = &line[indent..];
        if indent <= 3 {
            if let Some((marker, length)) = fence_marker(body) {
                match fence {
                    None => fence = Some((marker, length)),
                    Some((open, open_length)) if open == marker && length >= open_length && body.trim_end().len() == length => {
                        fence = None;
                    }
                    Some(_) => {}
                }
                continue;
            }
        }
        if fence.is_some() || indent > 3 {
            continue;
        }
        let level = body.bytes().take_while(|byte| *byte == b'#').count();
        if level == 0 || level > 6 {
            continue;
        }
        let rest = &body[level..];
        if !(rest.is_empty() || rest.starts_with(' ') || rest.starts_with('\t')) {
            continue;
        }
        let title = rest.trim().trim_end_matches('#').trim_end();
        if title.is_empty() || title.len() > MAX_NAME {
            continue;
        }
        if items.len() >= MAX_OUTLINE_ITEMS {
            return true;
        }
        items.push(OutlineItem {
            name: title.to_string(),
            kind: OutlineKind::Heading(HeadingKind::Heading),
            container: None,
            line: line_number,
            column: indent as u32 + 1,
            depth: (level - 1) as u8,
        });
    }
    false
}

/// "```" or "~~~" (three or more) at the start of a line: its byte and length.
fn fence_marker(body: &str) -> Option<(u8, usize)> {
    let marker = *body.as_bytes().first()?;
    if marker != b'`' && marker != b'~' {
        return None;
    }
    let length = body.bytes().take_while(|byte| *byte == marker).count();
    (length >= 3).then_some((marker, length))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(result: &OutlineResult) -> Vec<(String, u32, u8)> {
        result.items.iter().map(|item| (item.name.clone(), item.line, item.depth)).collect()
    }

    #[test]
    fn lists_code_definitions_in_text_order_with_members_nested() {
        let text = "export class Cart {\n  add(item: Item) {}\n}\n\nexport function total() {}\n";
        let result = outline("/repo/src/cart.ts", text);
        assert!(result.supported);
        assert!(!result.truncated);
        assert_eq!(
            names(&result),
            vec![("Cart".to_string(), 1, 0), ("add".to_string(), 2, 1), ("total".to_string(), 5, 0)]
        );
        let add = &result.items[1];
        assert_eq!(add.kind, OutlineKind::Symbol(SymbolKind::Method));
        assert_eq!(add.container.as_deref(), Some("Cart"));
        assert_eq!(add.column, 3);
    }

    #[test]
    fn unknown_languages_are_unsupported() {
        let result = outline("/repo/notes.txt", "class Nope {}\n");
        assert!(!result.supported);
        assert!(result.items.is_empty());
    }

    #[test]
    fn markdown_lists_headings_but_not_code_or_front_matter() {
        let text = "---\ntitle: x\n# not a heading\n---\n# Title\n\nText #tag\n```sh\n# comment\n```\n## Install ##\n####### too deep\n#hashtag\n   ### Indented\n";
        let result = outline("/repo/README.md", text);
        assert!(result.supported);
        assert_eq!(
            names(&result),
            vec![("Title".to_string(), 5, 0), ("Install".to_string(), 11, 1), ("Indented".to_string(), 14, 2)]
        );
        assert_eq!(result.items[2].column, 4);
        let json = serde_json::to_value(&result.items[0]).expect("serialize");
        assert_eq!(json["kind"], "heading");
        let code = outline("/repo/a.rs", "fn main() {}\n");
        assert_eq!(serde_json::to_value(&code.items[0]).expect("serialize")["kind"], "function");
    }

    #[test]
    fn caps_the_number_of_items() {
        let text: String = (0..MAX_OUTLINE_ITEMS + 10).map(|number| format!("function f{number}() {{}}\n")).collect();
        let result = outline("/repo/many.js", &text);
        assert!(result.truncated);
        assert_eq!(result.items.len(), MAX_OUTLINE_ITEMS);
    }

    #[test]
    fn too_big_texts_are_skipped() {
        let text = "a".repeat(MAX_OUTLINE_BYTES + 1);
        let result = outline("/repo/big.ts", &text);
        assert!(result.supported);
        assert!(result.truncated);
        assert!(result.items.is_empty());
    }
}
