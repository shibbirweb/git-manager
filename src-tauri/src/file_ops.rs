//! File operations for the Files panel: create, rename, copy, move and Move to Trash.
//!
//! These are plain file system writes, not git commands: git notices renames itself.
//! Every path is absolute and must stay inside one of the open workspace folders. The
//! folders themselves and anything inside `.git` are never touched, and symlinks are
//! handled as links: they are renamed, moved, copied and trashed, never followed.
//! Results use the caller's paths (not the canonical ones) so open tabs keep matching.

use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;

use crate::error::{AppError, AppResult};

/// One entry moved by `move_entries`: absolute paths before and after.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMove {
    pub from: String,
    pub to: String,
}

/// An existing entry the caller named: its path as given and its real location.
/// `real` has a canonical parent but keeps its own last component, so a symlink
/// stays the link itself.
#[derive(Debug, Clone)]
pub struct Entry {
    pub given: String,
    pub real: PathBuf,
    pub name: String,
    /// A real folder (a symlink to a folder is not).
    pub is_dir: bool,
}

/// The canonical workspace folder roots every path is checked against.
#[derive(Debug)]
pub struct WorkspaceRoots {
    roots: Vec<PathBuf>,
}

impl WorkspaceRoots {
    /// Roots that no longer exist are left out; with none left there is nothing to change.
    pub fn new(workspace_roots: &[String]) -> AppResult<WorkspaceRoots> {
        let roots: Vec<PathBuf> = workspace_roots
            .iter()
            .filter_map(|workspace_root| Path::new(workspace_root).canonicalize().ok())
            .filter(|root| root.is_dir())
            .collect();
        if roots.is_empty() {
            return Err(AppError::invalid("Open a workspace folder first"));
        }
        Ok(WorkspaceRoots { roots })
    }

    fn is_root(&self, real_path: &Path) -> bool {
        self.roots.iter().any(|root| root == real_path)
    }

    /// Inside (or equal to) a root and not inside `.git` below any root that holds it.
    fn check_inside(&self, real_path: &Path, shown: &str) -> AppResult<()> {
        let mut inside = false;
        for root in &self.roots {
            if let Ok(relative) = real_path.strip_prefix(root) {
                inside = true;
                if has_git_component(relative) {
                    return Err(AppError::invalid("Files inside .git cannot be changed"));
                }
            }
        }
        if !inside {
            return Err(AppError::invalid(format!("{shown} is outside the workspace")));
        }
        Ok(())
    }

    /// A path that is about to be created or replaced: inside, and not a root.
    fn check_new(&self, real_path: &Path) -> AppResult<()> {
        let shown = display_name(real_path);
        self.check_inside(real_path, &shown)?;
        if self.is_root(real_path) {
            return Err(AppError::invalid(format!("{shown} is a workspace folder")));
        }
        Ok(())
    }

    /// An existing folder to create, copy or move into. Symlinks are resolved here, so a
    /// link that leads out of the workspace is refused. The folder may be a root.
    pub fn folder(&self, dir_path: &str) -> AppResult<PathBuf> {
        let given = checked_absolute(dir_path)?;
        let shown = display_name(given);
        let real = given
            .canonicalize()
            .map_err(|_| AppError::invalid(format!("{shown} does not exist")))?;
        self.check_inside(&real, dir_path)?;
        if !real.is_dir() {
            return Err(AppError::invalid(format!("{shown} is not a folder")));
        }
        Ok(real)
    }

    /// An existing file, folder or symlink below a root (never a root itself).
    pub fn entry(&self, entry_path: &str) -> AppResult<Entry> {
        let given = checked_absolute(entry_path)?;
        let (Some(parent), Some(file_name)) = (given.parent(), given.file_name()) else {
            return Err(AppError::invalid(format!("Invalid path: {entry_path}")));
        };
        let name = file_name.to_string_lossy().into_owned();
        let missing = || AppError::invalid(format!("{name} does not exist"));
        let real_parent = parent.canonicalize().map_err(|_| missing())?;
        let real = real_parent.join(file_name);
        let metadata = fs::symlink_metadata(&real).map_err(|_| missing())?;
        self.check_inside(&real, entry_path)?;
        if self.is_root(&real) {
            return Err(AppError::invalid(format!("{name} is a workspace folder")));
        }
        Ok(Entry {
            given: entry_path.to_string(),
            real,
            name,
            is_dir: metadata.is_dir(),
        })
    }

    /// Renaming, moving or trashing a folder that holds a workspace folder would pull
    /// that folder out from under the workspace.
    fn refuse_holding_root(&self, entry: &Entry) -> AppResult<()> {
        if !entry.is_dir {
            return Ok(());
        }
        let held = self.roots.iter().find(|root| root.starts_with(&entry.real));
        if let Some(root) = held {
            return Err(AppError::invalid(format!(
                "{} holds the workspace folder {}",
                entry.name,
                display_name(root),
            )));
        }
        Ok(())
    }

    fn entries(&self, entry_paths: &[String], may_hold_root: bool) -> AppResult<Vec<Entry>> {
        let mut entries = Vec::with_capacity(entry_paths.len());
        for entry_path in entry_paths {
            let entry = self.entry(entry_path)?;
            if !may_hold_root {
                self.refuse_holding_root(&entry)?;
            }
            entries.push(entry);
        }
        Ok(entries)
    }
}

/// Absolute, with no `..`: the UI always sends full paths.
fn checked_absolute(path_text: &str) -> AppResult<&Path> {
    let path = Path::new(path_text);
    let climbs = path
        .components()
        .any(|component| matches!(component, Component::ParentDir));
    if path_text.is_empty() || !path.is_absolute() || climbs {
        return Err(AppError::invalid(format!("Invalid path: {path_text}")));
    }
    Ok(path)
}

/// The last component for messages, or the whole path when there is none.
fn display_name(path: &Path) -> String {
    path.file_name()
        .map(|file_name| file_name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

/// Whether any component is `.git` (any case: macOS and Windows ignore it).
pub fn has_git_component(relative_path: &Path) -> bool {
    relative_path.components().any(|component| match component {
        Component::Normal(part) => part
            .to_str()
            .is_some_and(|part| part.eq_ignore_ascii_case(".git")),
        _ => false,
    })
}

/// Checks one file or folder name typed by the user.
pub fn validate_name(name: &str) -> AppResult<()> {
    if name.trim().is_empty() {
        return Err(AppError::invalid("Enter a name"));
    }
    if name == "." || name == ".." {
        return Err(AppError::invalid("A name cannot be . or .."));
    }
    if name.contains('/') {
        return Err(AppError::invalid("A name cannot contain /"));
    }
    if name.contains('\0') {
        return Err(AppError::invalid("A name cannot contain a null character"));
    }
    #[cfg(windows)]
    {
        if let Some(bad) = name.chars().find(|c| "\\<>:\"|?*".contains(*c)) {
            return Err(AppError::invalid(format!("A name cannot contain {bad}")));
        }
        if name.ends_with('.') || name.ends_with(' ') {
            return Err(AppError::invalid("A name cannot end with a dot or a space"));
        }
    }
    Ok(())
}

/// Splits a New File or New Folder name like VS Code: "a/b/c.ts" creates the folders
/// `a` and `b`. Empty parts ("a//b", a trailing "/") are ignored.
pub fn split_new_path(name: &str) -> AppResult<Vec<&str>> {
    let parts: Vec<&str> = name.split('/').filter(|part| !part.is_empty()).collect();
    if parts.is_empty() {
        return Err(AppError::invalid("Enter a name"));
    }
    for part in &parts {
        validate_name(part)?;
    }
    Ok(parts)
}

/// `("cart", ".ts")` for "cart.ts"; a leading dot is part of the name (".env").
pub fn split_extension(name: &str) -> (&str, &str) {
    match name.rfind('.') {
        Some(index) if index > 0 => (&name[..index], &name[index..]),
        _ => (name, ""),
    }
}

/// "cart copy" is ("cart", 2) and "cart copy 4" is ("cart", 5): the next copy number.
fn strip_copy_suffix(stem: &str) -> (&str, u32) {
    if let Some(base) = stem.strip_suffix(" copy") {
        if !base.is_empty() {
            return (base, 2);
        }
    }
    if let Some(index) = stem.rfind(" copy ") {
        let digits = &stem[index + " copy ".len()..];
        let all_digits = !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit());
        if index > 0 && all_digits {
            if let Ok(number) = digits.parse::<u32>() {
                return (&stem[..index], number.saturating_add(1));
            }
        }
    }
    (stem, 1)
}

/// VS Code's copy names: "cart.ts", then "cart copy.ts", "cart copy 2.ts"; folders
/// "src copy". Copying "cart copy.ts" again gives "cart copy 2.ts", not "cart copy copy.ts".
pub fn copy_name(name: &str, is_dir: bool, taken: impl Fn(&str) -> bool) -> String {
    if !taken(name) {
        return name.to_string();
    }
    let (stem, extension) = if is_dir { (name, "") } else { split_extension(name) };
    let (base, mut number) = strip_copy_suffix(stem);
    loop {
        let candidate = if number == 1 {
            format!("{base} copy{extension}")
        } else {
            format!("{base} copy {number}{extension}")
        };
        if !taken(&candidate) {
            return candidate;
        }
        number += 1;
    }
}

/// Drops repeated entries and entries inside another selected folder, which go with it.
pub fn drop_nested(entries: Vec<Entry>) -> Vec<Entry> {
    let mut kept: Vec<Entry> = Vec::with_capacity(entries.len());
    for entry in entries {
        if kept.iter().any(|other| other.real == entry.real) {
            continue;
        }
        if entries_inside(&kept, &entry) {
            continue;
        }
        kept.retain(|other| !(entry.is_dir && other.real.starts_with(&entry.real)));
        kept.push(entry);
    }
    kept
}

fn entries_inside(folders: &[Entry], entry: &Entry) -> bool {
    folders
        .iter()
        .any(|folder| folder.is_dir && entry.real != folder.real && entry.real.starts_with(&folder.real))
}

/// Names that the file system may treat as one: case-insensitive on macOS and Windows.
fn same_name(first: &str, second: &str) -> bool {
    if cfg!(any(target_os = "macos", windows)) {
        first.to_lowercase() == second.to_lowercase()
    } else {
        first == second
    }
}

/// Plans a move into `target_dir` (canonical) before anything changes: the moves to
/// make, in order, as indexes into `entries` with their real targets. Entries already
/// in `target_dir` are skipped. Any conflict refuses the whole move.
pub fn plan_moves(
    entries: &[Entry],
    target_dir: &Path,
    exists: impl Fn(&Path) -> bool,
) -> AppResult<Vec<(usize, PathBuf)>> {
    let folder_name = display_name(target_dir);
    let mut planned: Vec<(usize, PathBuf)> = Vec::new();
    for (index, entry) in entries.iter().enumerate() {
        if entry.real.parent() == Some(target_dir) {
            continue;
        }
        if entry.is_dir && target_dir.starts_with(&entry.real) {
            return Err(AppError::invalid(format!("Cannot move {} into itself", entry.name)));
        }
        let clashes_with_planned = planned
            .iter()
            .any(|(other, _)| same_name(&entries[*other].name, &entry.name));
        let target = target_dir.join(&entry.name);
        if clashes_with_planned || exists(&target) {
            return Err(AppError::invalid(format!("{} already exists in {folder_name}", entry.name)));
        }
        planned.push((index, target));
    }
    Ok(planned)
}

fn exists_no_follow(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok()
}

fn failed(action: &str, name: &str, err: io::Error) -> AppError {
    if err.kind() == io::ErrorKind::AlreadyExists {
        return AppError::invalid(format!("{name} already exists"));
    }
    AppError::invalid(format!("Could not {action} {name}: {err}"))
}

/// Creates a file or folder in `parent_dir`, with any missing folders of a nested name.
/// Returns the new path in the caller's form.
pub fn create_entry(workspace_roots: &[String], parent_dir: &str, name: &str, is_dir: bool) -> AppResult<String> {
    let workspace = WorkspaceRoots::new(workspace_roots)?;
    let mut real_dir = workspace.folder(parent_dir)?;
    let parts = split_new_path(name)?;
    let (last, folders) = parts.split_last().ok_or_else(|| AppError::invalid("Enter a name"))?;
    let mut creates_folders = false;
    for folder in folders {
        let next = real_dir.join(folder);
        if !creates_folders && exists_no_follow(&next) {
            // An existing part may be a symlink: resolve it so nothing lands outside.
            let resolved = next
                .canonicalize()
                .map_err(|_| AppError::invalid(format!("{folder} does not exist")))?;
            workspace.check_inside(&resolved, folder)?;
            if !resolved.is_dir() {
                return Err(AppError::invalid(format!("{folder} is not a folder")));
            }
            real_dir = resolved;
        } else {
            creates_folders = true;
            real_dir = next;
        }
    }
    let target = real_dir.join(last);
    workspace.check_new(&target)?;
    if exists_no_follow(&target) {
        return Err(AppError::invalid(format!("{last} already exists")));
    }
    if creates_folders {
        fs::create_dir_all(&real_dir).map_err(|err| failed("create", &display_name(&real_dir), err))?;
    }
    let created = if is_dir {
        fs::create_dir(&target)
    } else {
        fs::OpenOptions::new().write(true).create_new(true).open(&target).map(|_| ())
    };
    created.map_err(|err| failed("create", last, err))?;
    let mut result = PathBuf::from(parent_dir);
    for part in &parts {
        result.push(part);
    }
    Ok(result.to_string_lossy().into_owned())
}

/// Whether two paths name the same file system entry (a case-only rename).
#[cfg(unix)]
fn is_same_entry(first: &Path, second: &Path) -> bool {
    use std::os::unix::fs::MetadataExt;
    match (fs::symlink_metadata(first), fs::symlink_metadata(second)) {
        (Ok(a), Ok(b)) => a.dev() == b.dev() && a.ino() == b.ino(),
        _ => false,
    }
}

/// Without inode numbers: the folder has no entry with exactly the new name, so the
/// existing path is the old entry seen through a case-insensitive file system.
#[cfg(not(unix))]
fn is_same_entry(first: &Path, second: &Path) -> bool {
    let (Some(parent), Some(new_name)) = (second.parent(), second.file_name()) else {
        return false;
    };
    if first.parent() != Some(parent) {
        return false;
    }
    match fs::read_dir(parent) {
        Ok(children) => !children
            .filter_map(Result::ok)
            .any(|child| child.file_name() == new_name),
        Err(_) => false,
    }
}

/// A free temporary name next to `real_path` for a two-step rename.
fn temporary_sibling(real_path: &Path, name: &str) -> PathBuf {
    let parent = real_path.parent().unwrap_or(real_path);
    let mut attempt = 0u32;
    loop {
        let candidate = parent.join(format!(".{name}.gm-rename-{}-{attempt}", std::process::id()));
        if !exists_no_follow(&candidate) {
            return candidate;
        }
        attempt += 1;
    }
}

/// Renames in place. A case-only rename ("cart.ts" to "Cart.ts") goes through a
/// temporary name, since a case-insensitive file system sees the target as taken.
pub fn rename_entry(workspace_roots: &[String], entry_path: &str, new_name: &str) -> AppResult<String> {
    let workspace = WorkspaceRoots::new(workspace_roots)?;
    let entry = workspace.entry(entry_path)?;
    workspace.refuse_holding_root(&entry)?;
    validate_name(new_name)?;
    let given_parent = Path::new(entry_path).parent().unwrap_or(Path::new(entry_path));
    let result = given_parent.join(new_name).to_string_lossy().into_owned();
    if new_name == entry.name {
        return Ok(result);
    }
    let real_parent = entry.real.parent().unwrap_or(&entry.real);
    let target = real_parent.join(new_name);
    workspace.check_new(&target)?;
    if exists_no_follow(&target) {
        let case_only = entry.name.to_lowercase() == new_name.to_lowercase();
        if !(case_only && is_same_entry(&entry.real, &target)) {
            return Err(AppError::invalid(format!("{new_name} already exists")));
        }
        let temporary = temporary_sibling(&entry.real, &entry.name);
        fs::rename(&entry.real, &temporary).map_err(|err| failed("rename", &entry.name, err))?;
        if let Err(err) = fs::rename(&temporary, &target) {
            let _ = fs::rename(&temporary, &entry.real);
            return Err(failed("rename", &entry.name, err));
        }
        return Ok(result);
    }
    fs::rename(&entry.real, &target).map_err(|err| failed("rename", &entry.name, err))?;
    Ok(result)
}

#[cfg(unix)]
fn copy_symlink(source: &Path, target: &Path) -> io::Result<()> {
    std::os::unix::fs::symlink(fs::read_link(source)?, target)
}

#[cfg(windows)]
fn copy_symlink(source: &Path, target: &Path) -> io::Result<()> {
    let link = fs::read_link(source)?;
    if fs::metadata(source).map(|metadata| metadata.is_dir()).unwrap_or(false) {
        std::os::windows::fs::symlink_dir(link, target)
    } else {
        std::os::windows::fs::symlink_file(link, target)
    }
}

#[cfg(not(any(unix, windows)))]
fn copy_symlink(_source: &Path, _target: &Path) -> io::Result<()> {
    Err(io::Error::other("symlinks cannot be copied on this system"))
}

/// Copies a file, a symlink (as a link) or a folder with everything in it. Sockets,
/// pipes and devices are skipped: reading a pipe would block forever.
fn copy_tree(source: &Path, target: &Path) -> io::Result<()> {
    let metadata = fs::symlink_metadata(source)?;
    let file_type = metadata.file_type();
    if file_type.is_symlink() {
        return copy_symlink(source, target);
    }
    if file_type.is_dir() {
        fs::create_dir(target)?;
        for child in fs::read_dir(source)? {
            let child = child?;
            copy_tree(&child.path(), &target.join(child.file_name()))?;
        }
        // After the children, so a read-only folder can still be filled.
        fs::set_permissions(target, metadata.permissions())?;
        return Ok(());
    }
    if file_type.is_file() {
        fs::copy(source, target)?;
    }
    Ok(())
}

/// Removes what a failed copy left behind at a path that did not exist before it.
fn remove_partial(target: &Path) {
    match fs::symlink_metadata(target) {
        Ok(metadata) if metadata.is_dir() => {
            let _ = fs::remove_dir_all(target);
        }
        Ok(_) => {
            let _ = fs::remove_file(target);
        }
        Err(_) => {}
    }
}

fn copy_or_clean(source: &Path, target: &Path, name: &str) -> AppResult<()> {
    if let Err(err) = copy_tree(source, target) {
        remove_partial(target);
        return Err(failed("copy", name, err));
    }
    Ok(())
}

/// Copies into `target_dir`; a taken name gets a copy name. Returns the new paths
/// in source order, in the caller's form.
pub fn copy_entries(workspace_roots: &[String], source_paths: &[String], target_dir: &str) -> AppResult<Vec<String>> {
    let workspace = WorkspaceRoots::new(workspace_roots)?;
    let real_dir = workspace.folder(target_dir)?;
    let entries = workspace.entries(source_paths, true)?;
    for entry in &entries {
        if entry.is_dir && real_dir.starts_with(&entry.real) {
            return Err(AppError::invalid(format!("Cannot copy {} into itself", entry.name)));
        }
    }
    let mut copied = Vec::with_capacity(entries.len());
    for entry in &entries {
        let name = copy_name(&entry.name, entry.is_dir, |candidate| exists_no_follow(&real_dir.join(candidate)));
        let target = real_dir.join(&name);
        workspace.check_new(&target)?;
        copy_or_clean(&entry.real, &target, &entry.name)?;
        copied.push(Path::new(target_dir).join(&name).to_string_lossy().into_owned());
    }
    Ok(copied)
}

fn remove_entry(real_path: &Path, is_dir: bool) -> io::Result<()> {
    if is_dir {
        fs::remove_dir_all(real_path)
    } else {
        fs::remove_file(real_path)
    }
}

/// A rename, or a copy then delete when the target is on another volume.
fn move_entry(entry: &Entry, target: &Path) -> AppResult<()> {
    match fs::rename(&entry.real, target) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == io::ErrorKind::CrossesDevices => {
            copy_or_clean(&entry.real, target, &entry.name)?;
            remove_entry(&entry.real, entry.is_dir).map_err(|err| failed("move", &entry.name, err))
        }
        Err(err) => Err(failed("move", &entry.name, err)),
    }
}

/// Moves into `target_dir`. Everything is checked before the first move.
pub fn move_entries(
    workspace_roots: &[String],
    source_paths: &[String],
    target_dir: &str,
) -> AppResult<Vec<FileMove>> {
    let workspace = WorkspaceRoots::new(workspace_roots)?;
    let real_dir = workspace.folder(target_dir)?;
    let entries = drop_nested(workspace.entries(source_paths, false)?);
    let planned = plan_moves(&entries, &real_dir, exists_no_follow)?;
    for (_, target) in &planned {
        workspace.check_new(target)?;
    }
    let mut moved = Vec::with_capacity(planned.len());
    for (index, target) in planned {
        let entry = &entries[index];
        move_entry(entry, &target)?;
        moved.push(FileMove {
            from: entry.given.clone(),
            to: Path::new(target_dir).join(&entry.name).to_string_lossy().into_owned(),
        });
    }
    Ok(moved)
}

/// Checks the entries and hands their real paths to `remove`, which is the system
/// Trash in the app and a stand-in in tests.
pub fn trash_entries(
    workspace_roots: &[String],
    entry_paths: &[String],
    remove: impl FnOnce(Vec<PathBuf>) -> AppResult<()>,
) -> AppResult<()> {
    let workspace = WorkspaceRoots::new(workspace_roots)?;
    let entries = drop_nested(workspace.entries(entry_paths, false)?);
    if entries.is_empty() {
        return Ok(());
    }
    remove(entries.into_iter().map(|entry| entry.real).collect())
}

/// At most this many paths are checked per call; the terminal asks for one line at a time.
pub const MAX_EXISTS_CHECKS: usize = 64;

/// Which of `file_paths` are regular files inside an open workspace folder (not inside
/// `.git`), for the terminal's clickable paths. Symlinks are followed, so a link that
/// leads out of the workspace counts as missing. Never fails: anything odd is `false`,
/// and paths past `MAX_EXISTS_CHECKS` are not looked at.
pub fn existing_files(workspace_roots: &[String], file_paths: &[String]) -> Vec<bool> {
    let Ok(workspace) = WorkspaceRoots::new(workspace_roots) else {
        return vec![false; file_paths.len()];
    };
    file_paths
        .iter()
        .enumerate()
        .map(|(index, file_path)| {
            if index >= MAX_EXISTS_CHECKS {
                return false;
            }
            let Ok(given) = checked_absolute(file_path) else {
                return false;
            };
            let Ok(real) = given.canonicalize() else {
                return false;
            };
            workspace.check_inside(&real, file_path).is_ok() && real.is_file()
        })
        .collect()
}

/// The system Trash. On macOS this is NSFileManager: the Finder method runs AppleScript,
/// which asks for automation permission and plays a sound.
pub fn move_to_trash(real_paths: Vec<PathBuf>) -> AppResult<()> {
    #[cfg_attr(not(target_os = "macos"), allow(unused_mut))]
    let mut context = trash::TrashContext::default();
    #[cfg(target_os = "macos")]
    {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        context.set_delete_method(DeleteMethod::NsFileManager);
    }
    context
        .delete_all(&real_paths)
        .map_err(|err| AppError::invalid(format!("Could not move to the Trash: {err}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(real_path: &str, is_dir: bool) -> Entry {
        let real = PathBuf::from(real_path);
        Entry {
            given: real_path.to_string(),
            name: display_name(&real),
            real,
            is_dir,
        }
    }

    fn message(result: AppResult<impl std::fmt::Debug>) -> String {
        result.expect_err("expected an error").to_string()
    }

    #[test]
    fn validates_names() {
        assert!(validate_name("cart.ts").is_ok());
        assert!(validate_name(".env").is_ok());
        assert!(validate_name("with space").is_ok());
        assert_eq!(message(validate_name("")), "Enter a name");
        assert_eq!(message(validate_name("   ")), "Enter a name");
        assert_eq!(message(validate_name(".")), "A name cannot be . or ..");
        assert_eq!(message(validate_name("..")), "A name cannot be . or ..");
        assert_eq!(message(validate_name("a/b")), "A name cannot contain /");
        assert_eq!(message(validate_name("a\0b")), "A name cannot contain a null character");
    }

    #[test]
    fn splits_nested_new_names() {
        assert_eq!(split_new_path("cart.ts").unwrap(), vec!["cart.ts"]);
        assert_eq!(split_new_path("a/b/c.ts").unwrap(), vec!["a", "b", "c.ts"]);
        assert_eq!(split_new_path("/a//b/").unwrap(), vec!["a", "b"]);
        assert_eq!(message(split_new_path("//")), "Enter a name");
        assert_eq!(message(split_new_path("a/../b")), "A name cannot be . or ..");
    }

    #[test]
    fn splits_extensions() {
        assert_eq!(split_extension("cart.ts"), ("cart", ".ts"));
        assert_eq!(split_extension("cart.test.ts"), ("cart.test", ".ts"));
        assert_eq!(split_extension(".env"), (".env", ""));
        assert_eq!(split_extension("Makefile"), ("Makefile", ""));
    }

    #[test]
    fn makes_copy_names_like_vs_code() {
        let taken = |names: &'static [&'static str]| move |candidate: &str| names.contains(&candidate);
        assert_eq!(copy_name("cart.ts", false, taken(&[])), "cart.ts");
        assert_eq!(copy_name("cart.ts", false, taken(&["cart.ts"])), "cart copy.ts");
        assert_eq!(
            copy_name("cart.ts", false, taken(&["cart.ts", "cart copy.ts"])),
            "cart copy 2.ts",
        );
        assert_eq!(
            copy_name("cart.ts", false, taken(&["cart.ts", "cart copy.ts", "cart copy 2.ts"])),
            "cart copy 3.ts",
        );
        assert_eq!(
            copy_name("cart copy.ts", false, taken(&["cart copy.ts"])),
            "cart copy 2.ts",
        );
        assert_eq!(
            copy_name("cart copy 7.ts", false, taken(&["cart copy 7.ts"])),
            "cart copy 8.ts",
        );
        assert_eq!(copy_name("src", true, taken(&["src"])), "src copy");
        assert_eq!(copy_name("v1.2", true, taken(&["v1.2"])), "v1.2 copy");
        assert_eq!(copy_name(".env", false, taken(&[".env"])), ".env copy");
        assert_eq!(copy_name("copy", false, taken(&["copy"])), "copy copy");
        assert_eq!(copy_name("a copy x", false, taken(&["a copy x"])), "a copy x copy");
    }

    #[test]
    fn finds_git_components() {
        assert!(has_git_component(Path::new(".git")));
        assert!(has_git_component(Path::new("sub/.git/config")));
        assert!(has_git_component(Path::new("sub/.GIT")));
        assert!(!has_git_component(Path::new(".github/workflows")));
        assert!(!has_git_component(Path::new("")));
    }

    #[test]
    fn drops_repeated_and_nested_entries() {
        let kept = drop_nested(vec![
            entry("/w/src/a.ts", false),
            entry("/w/src", true),
            entry("/w/src/lib/b.ts", false),
            entry("/w/src", true),
            entry("/w/srcs", true),
            entry("/w/link", false),
            entry("/w/link/x", false),
        ]);
        let paths: Vec<&str> = kept.iter().map(|entry| entry.given.as_str()).collect();
        assert_eq!(paths, vec!["/w/src", "/w/srcs", "/w/link", "/w/link/x"]);
    }

    #[test]
    fn plans_moves_and_refuses_conflicts_before_moving() {
        let entries = vec![entry("/w/a/cart.ts", false), entry("/w/b", true), entry("/w/src/c.ts", false)];
        let planned = plan_moves(&entries, Path::new("/w/src"), |_| false).unwrap();
        assert_eq!(
            planned,
            vec![(0, PathBuf::from("/w/src/cart.ts")), (1, PathBuf::from("/w/src/b"))],
        );

        let exists = |path: &Path| path == Path::new("/w/src/b");
        assert_eq!(
            message(plan_moves(&entries, Path::new("/w/src"), exists)),
            "b already exists in src",
        );

        let into_itself = vec![entry("/w/b", true)];
        assert_eq!(
            message(plan_moves(&into_itself, Path::new("/w/b/inner"), |_| false)),
            "Cannot move b into itself",
        );
        assert_eq!(
            message(plan_moves(&into_itself, Path::new("/w/b"), |_| false)),
            "Cannot move b into itself",
        );

        let same_name = vec![entry("/w/a/x.ts", false), entry("/w/b/x.ts", false)];
        assert_eq!(
            message(plan_moves(&same_name, Path::new("/w/c"), |_| false)),
            "x.ts already exists in c",
        );
    }
}
