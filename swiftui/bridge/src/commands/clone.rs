//! Clone, as src-tauri/src/commands/remote.rs clone_repository does it (its helpers are private there, so the checks
//! are repeated here): `git clone --progress` into a parent folder, refusing an unsafe name or a folder that is not
//! empty, with Cancel through git::cancel. Progress lines go to a slot the app reads with `clone_progress`.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Deserialize;

use crate::error::{AppError, AppResult};
use crate::git::cancel;
use crate::git::repo::strip_trailing_slash;
use crate::paths::RealPath;

/// What a clone stopped by Cancel fails with (CLONE_CANCELLED in gitOptions.ts).
const CLONE_CANCELLED: &str = "Clone cancelled";

static PROGRESS: Mutex<String> = Mutex::new(String::new());

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CloneArgs {
    url: String,
    parent_dir: String,
    folder_name: String,
    cancel_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CancelArgs {
    cancel_id: String,
}

/// Clones and answers the new folder's real path.
pub(super) fn clone_repository(args: CloneArgs) -> AppResult<String> {
    let target = clone_target(&args.url, &args.parent_dir, &args.folder_name)?;
    let existed_before = target.exists();
    set_progress("Starting...");
    let url = args.url.trim();
    let folder_name = args.folder_name.trim();
    let clone = ["clone", "--progress", "--", url, folder_name];
    let finished = cancel::run_streaming(Path::new(&args.parent_dir), &clone, &args.cancel_id, set_progress)?;
    if finished.is_none() {
        clean_cancelled_clone(&target, existed_before);
        return Err(AppError::invalid(CLONE_CANCELLED));
    }
    let cloned = target.real_path().unwrap_or(target);
    Ok(strip_trailing_slash(&cloned))
}

/// The latest line git printed while cloning.
pub(super) fn clone_progress() -> AppResult<String> {
    Ok(PROGRESS.lock().map(|line| line.clone()).unwrap_or_default())
}

/// Stops the clone started with `cancel_id`; false when none runs.
pub(super) fn cancel_git_command(args: CancelArgs) -> AppResult<bool> {
    Ok(cancel::cancel(&args.cancel_id))
}

fn set_progress(line: &str) {
    if let Ok(mut progress) = PROGRESS.lock() {
        *progress = line.to_string();
    }
}

fn clone_target(url: &str, parent_dir: &str, folder_name: &str) -> AppResult<PathBuf> {
    let url = url.trim();
    if url.is_empty() {
        return Err(AppError::invalid("Enter a URL"));
    }
    if url.starts_with('-') {
        return Err(AppError::invalid(format!("A URL cannot start with '-': {url}")));
    }
    let folder_name = folder_name.trim();
    if folder_name.is_empty() || folder_name == "." || folder_name == ".." || folder_name.contains(['/', '\\', '\0'])
    {
        return Err(AppError::invalid(format!("Not a valid folder name: {folder_name}")));
    }
    let parent = Path::new(parent_dir);
    if !parent.is_dir() {
        return Err(AppError::invalid(format!("The folder {parent_dir} does not exist")));
    }
    let target = parent.join(folder_name);
    if target.exists() {
        let empty = target.is_dir() && std::fs::read_dir(&target)?.next().is_none();
        if !empty {
            return Err(AppError::invalid(format!("{} already exists and is not an empty folder", target.display())));
        }
    }
    Ok(target)
}

/// Removes what a cancelled clone left: the folder it made, or what it put in a folder that was empty.
fn clean_cancelled_clone(target: &Path, existed_before: bool) {
    if !target.exists() {
        return;
    }
    if !existed_before {
        let _ = std::fs::remove_dir_all(target);
        return;
    }
    if let Ok(entries) = std::fs::read_dir(target) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && !path.is_symlink() {
                let _ = std::fs::remove_dir_all(&path);
            } else {
                let _ = std::fs::remove_file(&path);
            }
        }
    }
}
