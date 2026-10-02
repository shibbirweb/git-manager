//! Where the shelf lives: `<git dir>/gitmanager-shelf/`, so it stays with the repository,
//! is never committed and is not shared. Each shelved change list is `<id>.patch` (a
//! `git diff --binary` patch, one section per file) and `<id>.json` (name, date, branch and
//! the files in patch order).

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use git2::Repository;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

pub const SHELF_DIR: &str = "gitmanager-shelf";
const FORMAT_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ShelvedChange {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    Typechange,
}

impl ShelvedChange {
    /// The status letter of `git diff --raw`.
    pub fn from_letter(letter: u8) -> ShelvedChange {
        match letter {
            b'A' => ShelvedChange::Added,
            b'D' => ShelvedChange::Deleted,
            b'R' => ShelvedChange::Renamed,
            b'C' => ShelvedChange::Copied,
            b'T' => ShelvedChange::Typechange,
            _ => ShelvedChange::Modified,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShelvedFile {
    /// Repo-relative path after the change.
    pub path: String,
    /// The path before a rename or copy.
    #[serde(default)]
    pub old_path: Option<String>,
    pub change: ShelvedChange,
    #[serde(default)]
    pub binary: bool,
    /// The blob the change starts from, when known (Show Diff of a pure rename).
    #[serde(default)]
    pub old_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShelfEntry {
    #[serde(default)]
    pub version: u32,
    pub id: String,
    pub name: String,
    /// Milliseconds since the epoch.
    pub created_at: u64,
    /// The branch it was shelved from; None when detached.
    #[serde(default)]
    pub branch: Option<String>,
    /// HEAD when it was shelved.
    #[serde(default)]
    pub head_commit: Option<String>,
    #[serde(default)]
    pub files: Vec<ShelvedFile>,
}

impl ShelfEntry {
    pub fn new(id: String, name: String, branch: Option<String>, head_commit: Option<String>, files: Vec<ShelvedFile>) -> Self {
        ShelfEntry {
            version: FORMAT_VERSION,
            id,
            name,
            created_at: now_ms(),
            branch,
            head_commit,
            files,
        }
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or_default()
}

/// Ids are generated here; anything else from the UI is refused, so a path can never escape the folder.
pub fn check_id(shelf_id: &str) -> AppResult<()> {
    let valid = !shelf_id.is_empty()
        && shelf_id.len() <= 64
        && shelf_id.bytes().all(|byte| byte.is_ascii_digit() || byte.is_ascii_lowercase() || byte == b'-');
    if valid {
        Ok(())
    } else {
        Err(AppError::invalid(format!("Invalid shelf id: {shelf_id}")))
    }
}

pub fn clean_name(name: &str) -> AppResult<String> {
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if name.is_empty() {
        return Err(AppError::invalid("Enter a name for the shelved changes"));
    }
    Ok(name)
}

pub struct Shelf {
    dir: PathBuf,
}

impl Shelf {
    /// The shelf of a repository, in its common git dir so linked worktrees share it.
    pub fn of(repo: &Repository) -> Shelf {
        Shelf {
            dir: repo.commondir().join(SHELF_DIR),
        }
    }

    #[cfg(test)]
    pub fn dir(&self) -> &Path {
        &self.dir
    }

    fn patch_path(&self, shelf_id: &str) -> PathBuf {
        self.dir.join(format!("{shelf_id}.patch"))
    }

    fn meta_path(&self, shelf_id: &str) -> PathBuf {
        self.dir.join(format!("{shelf_id}.json"))
    }

    /// A new, unused id: the time plus a counter, so ids sort by age.
    pub fn new_id(&self) -> String {
        let base = now_ms();
        let mut counter = 0u32;
        loop {
            let candidate = format!("{base}-{counter}");
            if !self.meta_path(&candidate).exists() && !self.patch_path(&candidate).exists() {
                return candidate;
            }
            counter += 1;
        }
    }

    /// Every readable change list, newest first. Broken files are skipped, never removed.
    pub fn list(&self) -> AppResult<Vec<ShelfEntry>> {
        let reader = match std::fs::read_dir(&self.dir) {
            Ok(reader) => reader,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(err) => return Err(err.into()),
        };
        let mut entries: Vec<ShelfEntry> = reader
            .filter_map(Result::ok)
            .map(|item| item.path())
            .filter(|path| path.extension().is_some_and(|extension| extension == "json"))
            .filter_map(|path| read_meta(&path))
            .filter(|entry| check_id(&entry.id).is_ok() && self.patch_path(&entry.id).exists())
            .collect();
        entries.sort_by(|left, right| right.created_at.cmp(&left.created_at).then_with(|| right.id.cmp(&left.id)));
        Ok(entries)
    }

    pub fn load(&self, shelf_id: &str) -> AppResult<(ShelfEntry, Vec<u8>)> {
        check_id(shelf_id)?;
        let entry = read_meta(&self.meta_path(shelf_id))
            .filter(|entry| entry.id == shelf_id)
            .ok_or_else(|| AppError::invalid("These shelved changes no longer exist"))?;
        let patch = std::fs::read(self.patch_path(shelf_id))
            .map_err(|_| AppError::invalid("The patch of these shelved changes is missing"))?;
        Ok((entry, patch))
    }

    /// Writes the patch, then the description, each through a temporary file and a rename.
    pub fn save(&self, entry: &ShelfEntry, patch: &[u8]) -> AppResult<()> {
        check_id(&entry.id)?;
        std::fs::create_dir_all(&self.dir)?;
        write_atomic(&self.patch_path(&entry.id), patch)?;
        self.save_meta(entry)
    }

    pub fn save_meta(&self, entry: &ShelfEntry) -> AppResult<()> {
        check_id(&entry.id)?;
        let json = serde_json::to_vec_pretty(entry).map_err(|err| AppError::invalid(err.to_string()))?;
        write_atomic(&self.meta_path(&entry.id), &json)
    }

    pub fn delete(&self, shelf_id: &str) -> AppResult<()> {
        check_id(shelf_id)?;
        for path in [self.meta_path(shelf_id), self.patch_path(shelf_id)] {
            match std::fs::remove_file(&path) {
                Ok(()) => {}
                Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
                Err(err) => return Err(err.into()),
            }
        }
        Ok(())
    }
}

fn read_meta(path: &Path) -> Option<ShelfEntry> {
    let bytes = std::fs::read(path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn write_atomic(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let temporary = path.with_extension("tmp");
    std::fs::write(&temporary, bytes)?;
    std::fs::rename(&temporary, path).inspect_err(|_| {
        let _ = std::fs::remove_file(&temporary);
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_checked_before_touching_files() {
        assert!(check_id("1727780000000-0").is_ok());
        for bad in ["", "../x", "a/b", "A", "x.json", &"1".repeat(65)] {
            assert!(check_id(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn names_are_trimmed_and_required() {
        assert_eq!(clean_name("  my   changes \n").unwrap(), "my changes");
        assert!(clean_name("   ").is_err());
    }

    #[test]
    fn json_without_optional_fields_still_reads() {
        let json = r#"{"id":"1-0","name":"n","createdAt":5}"#;
        let entry: ShelfEntry = serde_json::from_str(json).unwrap();
        assert!(entry.files.is_empty());
        assert_eq!(entry.branch, None);
    }
}
