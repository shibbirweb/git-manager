//! The file editor's writes and change marks, named and shaped like the Tauri commands: `write_worktree_file`
//! (src-tauri/src/commands/status.rs, the editor's Save) and `line_change_marks` (src-tauri/src/commands/editor.rs,
//! the gutter's bars against HEAD). The Tauri `line_change_marks` takes the text as a raw body; gm_call has none,
//! so it comes as the `text` field. Local History is not configured in this app, so a save records none.

use serde::{Deserialize, Serialize};

use super::safe_join;
use crate::error::AppResult;
use crate::git::diff::{self, HeadVersion};
use crate::git::files;
use crate::git::repo as git_repo;
use crate::merge::line_diff::{change_marks, ChangeMark};
use crate::merge::model::Eol;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteWorktreeFileArgs {
    repo_path: String,
    file_path: String,
    content: String,
    eol: Eol,
}

/// Overwrites a work tree file with the editor's text in the file's own line endings; returns its new version.
pub fn write_worktree_file(args: WriteWorktreeFileArgs) -> AppResult<String> {
    let full = safe_join(&args.repo_path, &args.file_path)?;
    std::fs::write(&full, args.eol.apply(&args.content).into_bytes())?;
    Ok(files::stat_version(&std::fs::metadata(&full)?))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineChangeMarksArgs {
    repo_path: String,
    file_path: String,
    orig_path: Option<String>,
    /// The editor's LF-normalized text.
    text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LineMarks {
    head: HeadVersion,
    marks: Vec<ChangeMark>,
}

/// The editor's changes since the last commit: a binary or very large committed file gets none, a file HEAD does
/// not have is all added.
pub fn line_change_marks(args: LineChangeMarksArgs) -> AppResult<LineMarks> {
    let repo = git_repo::open(&args.repo_path)?;
    let head = diff::head_file(&repo, &args.file_path, args.orig_path.as_deref())?;
    let marks = if head.binary || head.too_large { Vec::new() } else { change_marks(&head.content, &args.text) };
    Ok(LineMarks { head: head.version, marks })
}
