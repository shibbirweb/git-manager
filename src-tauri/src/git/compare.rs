//! Compares any two files of the workspace, or a file with text the editor has (an unsaved
//! buffer, the clipboard): Compare Selected, Compare with Clipboard and Compare with... in
//! the Files panel and the editor tab menu. Same hunks, binary detection and size limit as
//! the Git diffs (diff.rs); a refresh with the version it already has costs only two stats.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;

use serde::{Deserialize, Serialize};

use super::diff::{self, FileDiff};
use super::files::stat_version;
use crate::error::{AppError, AppResult};
use crate::merge::model::Eol;

/// Sides above this size are not read: the same limit as the editor and the Git diffs.
pub const MAX_COMPARE_BYTES: u64 = 4 * 1024 * 1024;

/// One side: a file on disk (absolute path) or text the frontend sends.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareSide {
    pub file_path: Option<String>,
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileCompare {
    pub diff: FileDiff,
    /// Both sides' versions, passed back as `known_version` to skip an unchanged refresh.
    pub version: String,
    pub left_missing: bool,
    pub right_missing: bool,
    /// The bytes are equal. None when a side was too large to read.
    pub identical: Option<bool>,
}

enum Loaded {
    Missing,
    TooLarge,
    Bytes(Vec<u8>),
}

fn text_version(text: &str) -> String {
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    format!("text-{}-{:x}", text.len(), hasher.finish())
}

/// The side's version without reading a file: its stat, or a hash of the text.
fn side_version(side: &CompareSide) -> AppResult<String> {
    if let Some(text) = &side.text {
        return Ok(text_version(text));
    }
    let file_path = side_path(side)?;
    match std::fs::metadata(file_path) {
        Ok(meta) if meta.is_dir() => Err(AppError::invalid(format!("{} is a folder", file_path.display()))),
        Ok(meta) => Ok(stat_version(&meta)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok("missing".to_string()),
        Err(error) => Err(error.into()),
    }
}

fn side_path(side: &CompareSide) -> AppResult<&Path> {
    let file_path = side.file_path.as_deref().unwrap_or_default();
    let path = Path::new(file_path);
    if file_path.is_empty() || !path.is_absolute() {
        return Err(AppError::invalid(format!("Not an absolute file path: {file_path}")));
    }
    Ok(path)
}

/// Reads a side, checking its size before reading so a huge file is never loaded.
fn load(side: &CompareSide) -> AppResult<Loaded> {
    if let Some(text) = &side.text {
        if text.len() as u64 > MAX_COMPARE_BYTES {
            return Ok(Loaded::TooLarge);
        }
        return Ok(Loaded::Bytes(text.as_bytes().to_vec()));
    }
    let file_path = side_path(side)?;
    let meta = match std::fs::metadata(file_path) {
        Ok(meta) => meta,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Loaded::Missing),
        Err(error) => return Err(error.into()),
    };
    if meta.is_dir() {
        return Err(AppError::invalid(format!("{} is a folder", file_path.display())));
    }
    if meta.len() > MAX_COMPARE_BYTES {
        return Ok(Loaded::TooLarge);
    }
    match std::fs::read(file_path) {
        Ok(bytes) => Ok(Loaded::Bytes(bytes)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Loaded::Missing),
        Err(error) => Err(error.into()),
    }
}

/// The name the diff gets, for its language: a file side's path, else plain text.
fn diff_path(left: &CompareSide, right: &CompareSide) -> String {
    right
        .file_path
        .clone()
        .filter(|_| right.text.is_none())
        .or_else(|| left.file_path.clone().filter(|_| left.text.is_none()))
        .or_else(|| right.file_path.clone())
        .or_else(|| left.file_path.clone())
        .unwrap_or_else(|| "text.txt".to_string())
}

fn too_large(path: String) -> FileDiff {
    FileDiff {
        path,
        original: String::new(),
        modified: String::new(),
        original_eol: Eol::Lf,
        modified_eol: Eol::Lf,
        binary: false,
        too_large: true,
        lfs: None,
        hunks: Vec::new(),
        version: None,
    }
}

/// Compares `left` with `right`. None when both still have `known_version`.
pub fn compare_files(left: &CompareSide, right: &CompareSide, known_version: Option<&str>) -> AppResult<Option<FileCompare>> {
    // The versions are taken before reading: a write in between shows up next time.
    let version = format!("{}|{}", side_version(left)?, side_version(right)?);
    if known_version == Some(version.as_str()) {
        return Ok(None);
    }
    let path = diff_path(left, right);
    let (original, modified) = (load(left)?, load(right)?);
    let left_missing = matches!(original, Loaded::Missing);
    let right_missing = matches!(modified, Loaded::Missing);
    let bytes = |loaded: Loaded| match loaded {
        Loaded::Bytes(bytes) => Some(bytes),
        _ => None,
    };
    let (diff, identical) = if matches!(original, Loaded::TooLarge) || matches!(modified, Loaded::TooLarge) {
        (too_large(path), None)
    } else {
        let (original, modified) = (bytes(original), bytes(modified));
        let identical = original.as_deref().unwrap_or_default() == modified.as_deref().unwrap_or_default();
        // A missing side reads as empty, so the other side shows as added or deleted.
        let diff = diff::from_bytes(&path, Some(original.unwrap_or_default()), Some(modified.unwrap_or_default()));
        (diff, Some(identical))
    };
    Ok(Some(FileCompare {
        diff,
        version,
        left_missing,
        right_missing,
        identical,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::{image_bytes, TestDir};

    fn file(dir: &TestDir, relative_path: &str) -> CompareSide {
        CompareSide {
            file_path: Some(dir.file_string(relative_path)),
            text: None,
        }
    }

    fn text(content: &str) -> CompareSide {
        CompareSide {
            file_path: None,
            text: Some(content.to_string()),
        }
    }

    #[test]
    fn compares_two_files_with_hunks() {
        let dir = TestDir::new();
        dir.write("a.txt", "one\ntwo\nthree\n");
        dir.write("sub/b.txt", "one\nTWO\nthree\nfour\n");
        let compared = compare_files(&file(&dir, "a.txt"), &file(&dir, "sub/b.txt"), None).unwrap().unwrap();
        assert_eq!(compared.diff.original, "one\ntwo\nthree\n");
        assert_eq!(compared.diff.modified, "one\nTWO\nthree\nfour\n");
        assert!(!compared.diff.hunks.is_empty());
        assert_eq!(compared.identical, Some(false));
        assert!(!compared.left_missing && !compared.right_missing);
        assert!(compared.diff.path.ends_with("sub/b.txt"));
    }

    #[test]
    fn answers_none_while_nothing_changed() {
        let dir = TestDir::new();
        dir.write("a.txt", "same\n");
        dir.write("b.txt", "same\n");
        let (left, right) = (file(&dir, "a.txt"), file(&dir, "b.txt"));
        let first = compare_files(&left, &right, None).unwrap().unwrap();
        assert_eq!(first.identical, Some(true));
        assert!(compare_files(&left, &right, Some(&first.version)).unwrap().is_none());
        dir.write("b.txt", "changed and longer\n");
        let changed = compare_files(&left, &right, Some(&first.version)).unwrap().unwrap();
        assert_eq!(changed.diff.modified, "changed and longer\n");
        assert_ne!(changed.version, first.version);
    }

    #[test]
    fn compares_a_file_with_text() {
        let dir = TestDir::new();
        dir.write("a.rs", "fn main() {}\n");
        let (left, right) = (text("fn main() {\n}\n"), file(&dir, "a.rs"));
        let compared = compare_files(&left, &right, None).unwrap().unwrap();
        assert_eq!(compared.diff.original, "fn main() {\n}\n");
        assert!(compared.diff.path.ends_with("a.rs"));
        assert!(compare_files(&left, &right, Some(&compared.version)).unwrap().is_none());
        // New text is a new version.
        assert!(compare_files(&text("other"), &right, Some(&compared.version)).unwrap().is_some());
        // Two texts are plain text.
        let texts = compare_files(&text("a"), &text("b"), None).unwrap().unwrap();
        assert_eq!(texts.diff.path, "text.txt");
    }

    #[test]
    fn reads_a_missing_file_as_empty() {
        let dir = TestDir::new();
        dir.write("a.txt", "here\n");
        let compared = compare_files(&file(&dir, "a.txt"), &file(&dir, "gone.txt"), None).unwrap().unwrap();
        assert!(compared.right_missing);
        assert_eq!(compared.diff.modified, "");
        assert_eq!(compared.diff.original, "here\n");
    }

    #[test]
    fn marks_binary_and_too_large_sides() {
        let dir = TestDir::new();
        dir.write("a.png", image_bytes(&[1, 2]));
        dir.write("b.png", image_bytes(&[3, 4]));
        let binary = compare_files(&file(&dir, "a.png"), &file(&dir, "b.png"), None).unwrap().unwrap();
        assert!(binary.diff.binary);
        assert_eq!(binary.identical, Some(false));

        dir.write("big.txt", vec![b'x'; MAX_COMPARE_BYTES as usize + 1]);
        let large = compare_files(&file(&dir, "a.png"), &file(&dir, "big.txt"), None).unwrap().unwrap();
        assert!(large.diff.too_large);
        assert_eq!(large.identical, None);
        assert!(large.diff.modified.is_empty());
        let large_text = "y".repeat(MAX_COMPARE_BYTES as usize + 1);
        assert!(compare_files(&text(&large_text), &file(&dir, "a.png"), None).unwrap().unwrap().diff.too_large);
    }

    #[test]
    fn refuses_folders_and_relative_paths() {
        let dir = TestDir::new();
        dir.mkdir("folder");
        dir.write("a.txt", "a\n");
        assert!(compare_files(&file(&dir, "folder"), &file(&dir, "a.txt"), None).is_err());
        let relative = CompareSide {
            file_path: Some("a.txt".to_string()),
            text: None,
        };
        assert!(compare_files(&relative, &file(&dir, "a.txt"), None).is_err());
        assert!(compare_files(&CompareSide::default(), &file(&dir, "a.txt"), None).is_err());
    }
}
