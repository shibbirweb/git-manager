use std::path::Path;

use git2::{IndexEntry, Repository};
use serde::Serialize;

use super::opstate::{self, OpState};
use super::repo::{blob_text, path_text};
use crate::error::{AppError, AppResult};
use crate::merge::engine::compute_chunks;
use crate::merge::model::{normalize_eol, Eol, FileConflictKind, MergeDocument};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFile {
    pub path: String,
    pub kind: FileConflictKind,
    pub binary: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictSummary {
    pub op: OpState,
    pub files: Vec<ConflictFile>,
}

fn classify(ancestor: bool, ours: bool, theirs: bool) -> FileConflictKind {
    match (ancestor, ours, theirs) {
        (false, true, true) => FileConflictKind::BothAdded,
        (_, false, true) => FileConflictKind::DeletedByUs,
        (_, true, false) => FileConflictKind::DeletedByThem,
        _ => FileConflictKind::BothModified,
    }
}

fn entry_is_binary(repo: &Repository, entry: &Option<IndexEntry>) -> bool {
    match entry {
        Some(entry) => repo
            .find_blob(entry.id)
            .map(|blob| blob.is_binary())
            .unwrap_or(false),
        None => false,
    }
}

pub fn list(repo: &Repository) -> AppResult<ConflictSummary> {
    let index = repo.index()?;
    let mut files = Vec::new();
    if index.has_conflicts() {
        for conflict in index.conflicts()? {
            let conflict = conflict?;
            let path = [&conflict.our, &conflict.their, &conflict.ancestor]
                .iter()
                .find_map(|entry| entry.as_ref().map(|entry| path_text(&entry.path)))
                .unwrap_or_default();
            let binary = entry_is_binary(repo, &conflict.our) || entry_is_binary(repo, &conflict.their);
            files.push(ConflictFile {
                path,
                kind: classify(conflict.ancestor.is_some(), conflict.our.is_some(), conflict.their.is_some()),
                binary,
            });
        }
    }
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(ConflictSummary {
        op: opstate::read(repo),
        files,
    })
}

fn stage_text(repo: &Repository, entry: &Option<IndexEntry>) -> AppResult<Option<String>> {
    match entry {
        Some(entry) => blob_text(repo, entry.id),
        None => Ok(Some(String::new())),
    }
}

pub fn load(repo: &Repository, conflict_path: &str, ignore_whitespace: bool) -> AppResult<MergeDocument> {
    let index = repo.index()?;
    let conflict = index
        .conflicts()?
        .flatten()
        .find(|conflict| {
            [&conflict.our, &conflict.their, &conflict.ancestor]
                .iter()
                .any(|entry| entry.as_ref().map(|entry| path_text(&entry.path)) == Some(conflict_path.to_string()))
        })
        .ok_or_else(|| AppError::invalid(format!("{conflict_path} is not in conflict")))?;

    let kind = classify(conflict.ancestor.is_some(), conflict.our.is_some(), conflict.their.is_some());
    let op = opstate::read(repo);
    let texts = (
        stage_text(repo, &conflict.ancestor)?,
        stage_text(repo, &conflict.our)?,
        stage_text(repo, &conflict.their)?,
    );
    Ok(build_document(conflict_path, kind, texts, op.ours_label, op.theirs_label, ignore_whitespace))
}

pub fn build_document(
    path: &str,
    kind: FileConflictKind,
    texts: (Option<String>, Option<String>, Option<String>),
    ours_label: String,
    theirs_label: String,
    ignore_whitespace: bool,
) -> MergeDocument {
    let (base, ours, theirs) = texts;
    let binary = base.is_none() || ours.is_none() || theirs.is_none();
    let (base, ours, theirs) = (base.unwrap_or_default(), ours.unwrap_or_default(), theirs.unwrap_or_default());
    let eol = if ours.is_empty() { Eol::detect(&theirs) } else { Eol::detect(&ours) };
    let (base, ours, theirs) = (normalize_eol(&base), normalize_eol(&ours), normalize_eol(&theirs));
    let chunks = if binary {
        Vec::new()
    } else {
        compute_chunks(&base, &ours, &theirs, ignore_whitespace)
    };
    MergeDocument {
        path: path.to_string(),
        kind,
        binary,
        base,
        ours,
        theirs,
        ours_label,
        theirs_label,
        eol,
        ignore_whitespace,
        chunks,
    }
}

/// Mergetool mode: the four paths git passes to `mergetool.<tool>.cmd`.
pub fn load_files(base: &Path, local: &Path, remote: &Path, merged: &Path, ignore_whitespace: bool) -> MergeDocument {
    let read = |path: &Path| -> Option<String> {
        match std::fs::read(path) {
            Ok(bytes) => super::repo::bytes_to_text(bytes),
            // git passes an empty or missing BASE for add/add conflicts.
            Err(_) => Some(String::new()),
        }
    };
    let base_missing = std::fs::metadata(base).map(|meta| meta.len() == 0).unwrap_or(true);
    let kind = if base_missing {
        FileConflictKind::BothAdded
    } else {
        FileConflictKind::BothModified
    };
    build_document(
        &merged.to_string_lossy(),
        kind,
        (read(base), read(local), read(remote)),
        "Local (yours)".to_string(),
        "Remote (theirs)".to_string(),
        ignore_whitespace,
    )
}
