//! The file editor's reads, named and shaped like the Tauri commands in src-tauri/src/commands/files.rs and
//! editor.rs: a work tree file's text, and the blame of that text. The Tauri `blame_contents` takes the text as a raw
//! body after a JSON line; gm_call has no raw body, so the text comes as the `text` field instead.

use std::path::Path;

use serde::Deserialize;

use super::safe_join;
use crate::error::AppResult;
use crate::git::blame::{self, BlameRuns};
use crate::git::files::{self, FileContent};
use crate::merge::model::Eol;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadWorktreeFileArgs {
    repo_path: String,
    file_path: String,
    known_version: Option<String>,
}

/// Same as the Tauri command: reads a file for the editor; with the `known_version` of the text the caller has, an
/// unchanged file answers `unchanged` without its text.
pub fn read_worktree_file(args: ReadWorktreeFileArgs) -> AppResult<FileContent> {
    let full_path = safe_join(&args.repo_path, &args.file_path)?;
    files::read_file(&full_path, &args.file_path, args.known_version.as_deref())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlameContentsArgs {
    repo_path: String,
    file_path: String,
    eol: Eol,
    /// The editor's LF-normalized text.
    text: String,
}

/// Same as the Tauri command: blames the editor's text (`git blame --contents -`), unsaved edits included. git
/// compares the text with the committed file, so it gets the file's own line endings.
pub fn blame_contents(args: BlameContentsArgs) -> AppResult<BlameRuns> {
    let root = Path::new(&args.repo_path);
    let info = match args.eol {
        Eol::Lf => blame::blame(root, &args.file_path, None, Some(args.text.as_bytes()))?,
        Eol::Crlf => {
            let text = Eol::Crlf.apply(&args.text);
            blame::blame(root, &args.file_path, None, Some(text.as_bytes()))?
        }
    };
    Ok(info.into_runs())
}
