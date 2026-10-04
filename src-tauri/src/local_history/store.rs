//! Where Local History lives: `~/.gitmanager/local-history/`.
//!
//! - `objects/<2 hex>/<38 hex>`: one file text, zlib-compressed, named by its git blob id
//!   (SHA-1 of the content), so the same text is stored once whatever file and time it has.
//! - `index/<40 hex>.json`: one small index per tracked file, named by the hash of its absolute
//!   path: `{ "version": 1, "path": "/abs/file", "snapshots": [{ time, label, hash, size }] }`,
//!   oldest first. A save reads and writes only that one file.
//!
//! Writes go through a temporary file and a rename. The store holds nothing in memory: every
//! call reads what it needs from disk. Callers serialize writes (see `mod.rs`).

use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use flate2::Compression;
use git2::{ObjectType, Oid};
use serde::{Deserialize, Serialize};

use super::plan::{self, Limits, SnapshotRef};
use crate::error::{AppError, AppResult};

pub const DIR_NAME: &str = "local-history";
const FORMAT_VERSION: u32 = 1;
/// Recently Deleted lists at most this many files.
pub const MAX_DELETED: usize = 500;

/// Why a snapshot was taken; the UI words it (localHistoryModel.ts).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Label {
    /// Written by Save in the app.
    Saved,
    /// What a save replaced, when the history did not have it yet (the text as first opened).
    BeforeSave,
    /// The new text of a file changed outside the app.
    ExternalChange,
    /// What an outside change replaced, when the history did not have it yet.
    BeforeExternalChange,
    /// Before Discard (files or selected lines) in the Changes view.
    BeforeDiscard,
    /// Before Rollback.
    BeforeRollback,
    /// Unsaved edits that File > Revert threw away.
    BeforeRevert,
    /// A label a newer version wrote.
    #[serde(other)]
    Other,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    /// Milliseconds since the epoch; strictly increasing within a file.
    pub time: u64,
    pub label: Label,
    /// The git blob id of the text.
    pub hash: String,
    /// Uncompressed bytes.
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileIndex {
    #[serde(default)]
    version: u32,
    path: String,
    #[serde(default)]
    snapshots: Vec<Snapshot>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Recorded {
    Added { snapshot: Snapshot, stored_bytes: u64 },
    /// Same text as the newest snapshot of the file.
    Unchanged,
    /// Over the size limit.
    TooLarge,
}

/// A file with history that is no longer on disk (Recently Deleted).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedFile {
    pub file_path: String,
    /// The newest snapshot.
    pub latest: Snapshot,
    pub count: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub files: usize,
    pub snapshots: usize,
    /// Compressed bytes on disk.
    pub bytes: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct PruneReport {
    pub removed_snapshots: usize,
    pub removed_objects: usize,
    pub kept_bytes: u64,
}

/// The git blob id of `bytes`, the store's content address.
pub fn content_hash(bytes: &[u8]) -> AppResult<String> {
    Ok(Oid::hash_object(ObjectType::Blob, bytes)?.to_string())
}

/// Hashes come from the store; anything else from the UI is refused before touching a path.
pub fn check_hash(hash: &str) -> AppResult<()> {
    let valid = hash.len() == 40 && hash.bytes().all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte));
    if valid {
        Ok(())
    } else {
        Err(AppError::invalid(format!("Invalid snapshot id: {hash}")))
    }
}

/// History is kept for absolute, normalized file paths only.
pub fn check_file_path(file_path: &str) -> AppResult<()> {
    // Checked on the text: `Path::components` would quietly drop "." and repeated slashes.
    let clean = Path::new(file_path).is_absolute()
        && crate::paths::after_root(file_path)
            .is_some_and(|rest| rest.split('/').all(|segment| !segment.is_empty() && segment != "." && segment != ".."));
    if clean {
        Ok(())
    } else {
        Err(AppError::invalid(format!("Invalid file path: {file_path}")))
    }
}

fn is_inside(folder_path: &str, file_path: &str) -> bool {
    let folder = folder_path.trim_end_matches('/');
    file_path.len() > folder.len() && file_path.starts_with(folder) && file_path.as_bytes()[folder.len()] == b'/'
}

pub struct Store {
    root: PathBuf,
}

impl Store {
    pub fn new(root: PathBuf) -> Store {
        Store { root }
    }

    /// `<config dir>/local-history`.
    pub fn in_config_dir(config_dir: &Path) -> Store {
        Store::new(config_dir.join(DIR_NAME))
    }

    #[cfg(test)]
    pub fn root(&self) -> &Path {
        &self.root
    }

    fn objects_dir(&self) -> PathBuf {
        self.root.join("objects")
    }

    fn index_dir(&self) -> PathBuf {
        self.root.join("index")
    }

    fn object_path(&self, hash: &str) -> PathBuf {
        self.objects_dir().join(&hash[..2]).join(&hash[2..])
    }

    fn index_path(&self, file_path: &str) -> AppResult<PathBuf> {
        Ok(self.index_dir().join(format!("{}.json", content_hash(file_path.as_bytes())?)))
    }

    /// Adds a snapshot of `bytes` for `file_path` unless it is the newest one already, then
    /// applies the per-file rules (count and age) to that file.
    pub fn record(&self, file_path: &str, bytes: &[u8], label: Label, now_ms: u64, limits: &Limits) -> AppResult<Recorded> {
        check_file_path(file_path)?;
        if bytes.len() as u64 > limits.max_file_bytes {
            return Ok(Recorded::TooLarge);
        }
        let hash = content_hash(bytes)?;
        let index_path = self.index_path(file_path)?;
        let mut index = read_index(&index_path)
            .filter(|index| index.path == file_path)
            .unwrap_or_else(|| FileIndex {
                version: FORMAT_VERSION,
                path: file_path.to_string(),
                snapshots: Vec::new(),
            });
        let newest = index.snapshots.last();
        if newest.is_some_and(|snapshot| snapshot.hash == hash) {
            return Ok(Recorded::Unchanged);
        }
        let time = newest.map_or(now_ms, |snapshot| now_ms.max(snapshot.time + 1));
        let stored_bytes = self.write_object(&hash, bytes)?;
        let snapshot = Snapshot {
            time,
            label,
            hash,
            size: bytes.len() as u64,
        };
        index.snapshots.push(snapshot.clone());
        let refs = snapshot_refs(&index.snapshots);
        let keep = plan::keep_for_file(&refs, time, limits);
        if keep.len() != index.snapshots.len() {
            index.snapshots = keep.into_iter().map(|position| index.snapshots[position].clone()).collect();
        }
        index.version = FORMAT_VERSION;
        self.write_index(&index_path, &index)?;
        Ok(Recorded::Added { snapshot, stored_bytes })
    }

    /// The snapshots of a file, newest first.
    pub fn list(&self, file_path: &str) -> AppResult<Vec<Snapshot>> {
        check_file_path(file_path)?;
        let mut snapshots = read_index(&self.index_path(file_path)?)
            .filter(|index| index.path == file_path)
            .map(|index| index.snapshots)
            .unwrap_or_default();
        snapshots.reverse();
        Ok(snapshots)
    }

    /// The bytes of one snapshot of `file_path`, checked against its hash.
    pub fn read(&self, file_path: &str, hash: &str) -> AppResult<Vec<u8>> {
        check_hash(hash)?;
        if !self.list(file_path)?.iter().any(|snapshot| snapshot.hash == hash) {
            return Err(AppError::invalid("This version is no longer in the local history"));
        }
        self.read_object(hash)
    }

    fn read_object(&self, hash: &str) -> AppResult<Vec<u8>> {
        let compressed = std::fs::read(self.object_path(hash)).map_err(|_| AppError::invalid("This version is no longer in the local history"))?;
        let mut bytes = Vec::new();
        ZlibDecoder::new(compressed.as_slice())
            .read_to_end(&mut bytes)
            .map_err(|_| AppError::invalid("This version in the local history is damaged"))?;
        if content_hash(&bytes)? != hash {
            return Err(AppError::invalid("This version in the local history is damaged"));
        }
        Ok(bytes)
    }

    /// Writes a snapshot back to a path that no longer exists, creating its folders.
    pub fn restore(&self, file_path: &str, hash: &str) -> AppResult<()> {
        let bytes = self.read(file_path, hash)?;
        let target = Path::new(file_path);
        if target.exists() || target.is_symlink() {
            return Err(AppError::invalid("A file with this name exists again: open it and use Revert instead"));
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(target)?;
        file.write_all(&bytes)?;
        Ok(())
    }

    /// Files under one of `folder_paths` that have history but are gone from disk, newest first.
    pub fn deleted_under(&self, folder_paths: &[String]) -> AppResult<Vec<DeletedFile>> {
        let mut deleted: Vec<DeletedFile> = self
            .indexes()?
            .into_iter()
            .filter(|(_, index)| folder_paths.iter().any(|folder| is_inside(folder, &index.path)))
            .filter(|(_, index)| {
                let path = Path::new(&index.path);
                !path.exists() && !path.is_symlink()
            })
            .filter_map(|(_, index)| {
                let latest = index.snapshots.last()?.clone();
                Some(DeletedFile {
                    file_path: index.path,
                    latest,
                    count: index.snapshots.len(),
                })
            })
            .collect();
        deleted.sort_by(|left, right| right.latest.time.cmp(&left.latest.time).then_with(|| left.file_path.cmp(&right.file_path)));
        deleted.truncate(MAX_DELETED);
        Ok(deleted)
    }

    pub fn usage(&self) -> AppResult<Usage> {
        let indexes = self.indexes()?;
        let objects = self.object_sizes()?;
        Ok(Usage {
            files: indexes.len(),
            snapshots: indexes.iter().map(|(_, index)| index.snapshots.len()).sum(),
            bytes: objects.values().sum(),
        })
    }

    /// Removes everything.
    pub fn clear(&self) -> AppResult<()> {
        match std::fs::remove_dir_all(&self.root) {
            Ok(()) => Ok(()),
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(err) => Err(err.into()),
        }
    }

    /// Applies every rule (see plan.rs) to the whole store and removes what nothing uses.
    pub fn prune(&self, now_ms: u64, limits: &Limits) -> AppResult<PruneReport> {
        let indexes = self.indexes()?;
        let objects = self.object_sizes()?;
        let files: Vec<Vec<SnapshotRef>> = indexes.iter().map(|(_, index)| snapshot_refs(&index.snapshots)).collect();
        let prune_plan = plan::plan_prune(&files, &objects, now_ms, limits);
        let mut report = PruneReport {
            kept_bytes: prune_plan.kept_bytes,
            ..PruneReport::default()
        };
        for (position, (index_path, index)) in indexes.into_iter().enumerate() {
            if prune_plan.unchanged(position, index.snapshots.len()) {
                continue;
            }
            report.removed_snapshots += index.snapshots.len() - prune_plan.keep[position].len();
            if prune_plan.keep[position].is_empty() {
                remove_if_present(&index_path)?;
                continue;
            }
            let kept = FileIndex {
                version: FORMAT_VERSION,
                path: index.path.clone(),
                snapshots: prune_plan.keep[position].iter().map(|&at| index.snapshots[at].clone()).collect(),
            };
            self.write_index(&index_path, &kept)?;
        }
        for hash in &prune_plan.delete_objects {
            remove_if_present(&self.object_path(hash))?;
            report.removed_objects += 1;
        }
        self.remove_leftovers()?;
        Ok(report)
    }

    /// Every readable index with its path. Unreadable ones are skipped, never removed.
    fn indexes(&self) -> AppResult<Vec<(PathBuf, FileIndex)>> {
        let reader = match std::fs::read_dir(self.index_dir()) {
            Ok(reader) => reader,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(err) => return Err(err.into()),
        };
        let mut indexes: Vec<(PathBuf, FileIndex)> = reader
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.extension().is_some_and(|extension| extension == "json"))
            .filter_map(|path| {
                let index = read_index(&path)?;
                (index.version <= FORMAT_VERSION && check_file_path(&index.path).is_ok()).then_some((path, index))
            })
            .collect();
        indexes.sort_by(|left, right| left.0.cmp(&right.0));
        Ok(indexes)
    }

    /// The compressed size of every object, by hash.
    fn object_sizes(&self) -> AppResult<HashMap<String, u64>> {
        let mut sizes = HashMap::new();
        let reader = match std::fs::read_dir(self.objects_dir()) {
            Ok(reader) => reader,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(sizes),
            Err(err) => return Err(err.into()),
        };
        for shard in reader.filter_map(Result::ok) {
            let prefix = shard.file_name().to_string_lossy().into_owned();
            if prefix.len() != 2 || !shard.path().is_dir() {
                continue;
            }
            for object in std::fs::read_dir(shard.path())?.filter_map(Result::ok) {
                let hash = format!("{prefix}{}", object.file_name().to_string_lossy());
                if check_hash(&hash).is_err() {
                    continue;
                }
                if let Ok(meta) = object.metadata() {
                    sizes.insert(hash, meta.len());
                }
            }
        }
        Ok(sizes)
    }

    /// Temporary files of a write that never finished (the app quit in between).
    fn remove_leftovers(&self) -> AppResult<()> {
        let mut folders = vec![self.index_dir()];
        if let Ok(reader) = std::fs::read_dir(self.objects_dir()) {
            folders.extend(reader.filter_map(Result::ok).map(|entry| entry.path()).filter(|path| path.is_dir()));
        }
        for folder in folders {
            let Ok(reader) = std::fs::read_dir(&folder) else {
                continue;
            };
            for entry in reader.filter_map(Result::ok) {
                if entry.file_name().to_string_lossy().ends_with(".tmp") {
                    remove_if_present(&entry.path())?;
                }
            }
        }
        Ok(())
    }

    /// Stores the compressed bytes once; returns how many bytes were added to the disk.
    fn write_object(&self, hash: &str, bytes: &[u8]) -> AppResult<u64> {
        let path = self.object_path(hash);
        if path.is_file() {
            return Ok(0);
        }
        let mut encoder = ZlibEncoder::new(Vec::with_capacity(bytes.len() / 3 + 64), Compression::default());
        encoder.write_all(bytes)?;
        let compressed = encoder.finish()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        write_atomic(&path, &compressed)?;
        Ok(compressed.len() as u64)
    }

    fn write_index(&self, index_path: &Path, index: &FileIndex) -> AppResult<()> {
        std::fs::create_dir_all(self.index_dir())?;
        let json = serde_json::to_vec(index).map_err(|err| AppError::invalid(err.to_string()))?;
        write_atomic(index_path, &json)
    }
}

fn snapshot_refs(snapshots: &[Snapshot]) -> Vec<SnapshotRef> {
    snapshots
        .iter()
        .map(|snapshot| SnapshotRef {
            time: snapshot.time,
            hash: snapshot.hash.clone(),
        })
        .collect()
}

fn read_index(path: &Path) -> Option<FileIndex> {
    let bytes = std::fs::read(path).ok()?;
    let index: FileIndex = serde_json::from_slice(&bytes).ok()?;
    let valid = index.snapshots.iter().all(|snapshot| check_hash(&snapshot.hash).is_ok());
    valid.then_some(index)
}

fn write_atomic(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let mut name = path.file_name().map(|name| name.to_os_string()).unwrap_or_default();
    name.push(".tmp");
    let temporary = path.with_file_name(name);
    std::fs::write(&temporary, bytes)?;
    std::fs::rename(&temporary, path).inspect_err(|_| {
        let _ = std::fs::remove_file(&temporary);
    })?;
    Ok(())
}

fn remove_if_present(path: &Path) -> AppResult<()> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(err.into()),
    }
}
