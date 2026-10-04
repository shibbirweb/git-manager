//! Local History: a copy of a file's text on every save
//! from the app, when an open file changes outside it, and before Discard, Rollback and Revert.
//! Only on after the frontend switches it on (`configure`), so tests and the merge tool window
//! never write to `~/.gitmanager`.
//!
//! Writes are serialized by one lock and run off the main thread. Pruning (plan.rs) runs in the
//! background at start and again after enough new bytes or time; one file's own count and age
//! limits apply on every write.

pub mod plan;
pub mod store;
#[cfg(test)]
mod tests;

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use plan::Limits;
use store::{Label, Recorded, Store};

use crate::error::AppResult;

/// A destructive action snapshots at most this many files (a whole untracked folder)...
pub const MAX_FILES_PER_ACTION: usize = 300;
/// ...and at most this many bytes, so a big folder neither delays the action nor pushes older
/// versions out of the size limit.
pub const MAX_BYTES_PER_ACTION: u64 = 16 * 1024 * 1024;
/// Pruning runs again after this much time with writes, or after a twentieth of the size limit.
const PRUNE_INTERVAL_MS: u64 = 30 * 60 * 1000;

#[derive(Debug, Clone)]
struct Active {
    root: PathBuf,
    limits: Limits,
}

static ACTIVE: RwLock<Option<Active>> = RwLock::new(None);
/// Every write to the store holds this.
static WRITE_LOCK: Mutex<()> = Mutex::new(());
static PRUNING: AtomicBool = AtomicBool::new(false);
static BYTES_SINCE_PRUNE: AtomicU64 = AtomicU64::new(0);
static LAST_PRUNE_MS: AtomicU64 = AtomicU64::new(0);

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or_default()
}

/// Turns history on in `root` with `limits` (None: off) and prunes once in the background.
pub fn configure(root: Option<PathBuf>, limits: Limits) {
    let next = root.map(|root| Active { root, limits });
    let start = next.clone();
    *ACTIVE.write().unwrap_or_else(|poisoned| poisoned.into_inner()) = next;
    if let Some(active) = start {
        spawn_prune(active);
    }
}

fn active() -> Option<Active> {
    ACTIVE.read().unwrap_or_else(|poisoned| poisoned.into_inner()).clone()
}

pub fn is_on() -> bool {
    active().is_some()
}

/// The store, whether or not history is on (listing and restoring still work when it is off).
pub fn store_in(config_dir: &Path) -> Store {
    Store::in_config_dir(config_dir)
}

fn lock() -> std::sync::MutexGuard<'static, ()> {
    WRITE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Runs a write on the store under the lock.
pub fn with_write_lock<T>(work: impl FnOnce() -> AppResult<T>) -> AppResult<T> {
    let _guard = lock();
    work()
}

/// Records snapshots now (the caller is already off the main thread). Does nothing while off.
pub fn record(items: &[(String, Vec<u8>, Label)]) -> AppResult<()> {
    let Some(active) = active() else {
        return Ok(());
    };
    let store = Store::new(active.root.clone());
    let mut written = 0;
    {
        let _guard = lock();
        for (file_path, bytes, label) in items {
            if let Recorded::Added { stored_bytes, .. } = store.record(file_path, bytes, *label, now_ms(), &active.limits)? {
                written += stored_bytes;
            }
        }
    }
    after_write(active, written);
    Ok(())
}

/// A save from the app: what it replaced (when known) and what it wrote, recorded on a
/// background thread so the save answers at once. Failures only cost the snapshot.
pub fn record_save(file_path: String, before: Option<Vec<u8>>, after: Vec<u8>) {
    if !is_on() {
        return;
    }
    std::thread::spawn(move || {
        let mut items = Vec::with_capacity(2);
        if let Some(before) = before {
            items.push((file_path.clone(), before, Label::BeforeSave));
        }
        items.push((file_path, after, Label::Saved));
        let _ = record(&items);
    });
}

/// Before a destructive action: the current text of each existing file (folders walked, up to
/// `MAX_FILES_PER_ACTION` files). Runs before the action, on the caller's thread; failures never
/// stop the action.
pub fn snapshot_before(entry_paths: &[PathBuf], label: Label) {
    let Some(active) = active() else {
        return;
    };
    let items = read_for_snapshot(entry_paths, label, active.limits.max_file_bytes, MAX_BYTES_PER_ACTION);
    let _ = record(&items);
}

/// The files at or under `entry_paths` with their bytes, within the per-file and total budgets.
fn read_for_snapshot(entry_paths: &[PathBuf], label: Label, max_file_bytes: u64, max_total_bytes: u64) -> Vec<(String, Vec<u8>, Label)> {
    let mut files = Vec::new();
    for entry_path in entry_paths {
        collect_files(entry_path, &mut files, MAX_FILES_PER_ACTION);
    }
    let mut total = 0u64;
    let mut items = Vec::new();
    for file in files {
        let Ok(meta) = std::fs::symlink_metadata(&file) else {
            continue;
        };
        if !meta.is_file() || meta.len() > max_file_bytes {
            continue;
        }
        if total + meta.len() > max_total_bytes {
            break;
        }
        let Ok(bytes) = std::fs::read(&file) else {
            continue;
        };
        total += bytes.len() as u64;
        items.push((file.to_string_lossy().into_owned(), bytes, label));
    }
    items
}

/// Regular files at or under `entry_path`, skipping symbolic links and `.git` folders.
fn collect_files(entry_path: &Path, files: &mut Vec<PathBuf>, limit: usize) {
    if files.len() >= limit {
        return;
    }
    let Ok(meta) = std::fs::symlink_metadata(entry_path) else {
        return;
    };
    if meta.is_file() {
        files.push(entry_path.to_path_buf());
        return;
    }
    if !meta.is_dir() || entry_path.file_name().is_some_and(|name| name == ".git") {
        return;
    }
    let Ok(reader) = std::fs::read_dir(entry_path) else {
        return;
    };
    let mut children: Vec<PathBuf> = reader.filter_map(Result::ok).map(|entry| entry.path()).collect();
    children.sort();
    for child in children {
        collect_files(&child, files, limit);
        if files.len() >= limit {
            return;
        }
    }
}

/// Bytes read before a save overwrites a file, when history is on and the file is small enough.
pub fn read_before_save(file_path: &Path) -> Option<Vec<u8>> {
    let active = active()?;
    let meta = std::fs::symlink_metadata(file_path).ok()?;
    if !meta.is_file() || meta.len() > active.limits.max_file_bytes {
        return None;
    }
    std::fs::read(file_path).ok()
}

fn after_write(active: Active, written: u64) {
    if written == 0 {
        return;
    }
    let since = BYTES_SINCE_PRUNE.fetch_add(written, Ordering::SeqCst) + written;
    let elapsed = now_ms().saturating_sub(LAST_PRUNE_MS.load(Ordering::SeqCst));
    if since >= active.limits.max_total_bytes / 20 || elapsed >= PRUNE_INTERVAL_MS {
        spawn_prune(active);
    }
}

/// One prune at a time, on its own thread.
fn spawn_prune(active: Active) {
    if PRUNING.swap(true, Ordering::SeqCst) {
        return;
    }
    std::thread::spawn(move || {
        {
            let _guard = lock();
            let _ = Store::new(active.root).prune(now_ms(), &active.limits);
        }
        BYTES_SINCE_PRUNE.store(0, Ordering::SeqCst);
        LAST_PRUNE_MS.store(now_ms(), Ordering::SeqCst);
        PRUNING.store(false, Ordering::SeqCst);
    });
}
