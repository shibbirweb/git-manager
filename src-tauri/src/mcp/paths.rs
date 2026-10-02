//! Path safety: tools only reach the workspace folders open in the app.

use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};

use crate::git::workspace::relative_slash_path;

pub const OUTSIDE: &str = "Not inside an open workspace folder";

/// Canonical workspace folders; folders that no longer exist are left out.
pub fn canonical_folders(folder_paths: &[String]) -> Vec<PathBuf> {
    let mut folders: Vec<PathBuf> = Vec::new();
    for folder_path in folder_paths {
        if let Ok(canonical) = Path::new(folder_path).canonicalize() {
            if canonical.is_dir() && !folders.contains(&canonical) {
                folders.push(canonical);
            }
        }
    }
    folders
}

/// The canonical form of an absolute path that may not exist yet: its longest existing
/// ancestor is canonicalized (resolving symlinks) and the rest appended. `..` is refused.
pub fn resolve(path_text: &str) -> Result<PathBuf, String> {
    let path = Path::new(path_text);
    if path_text.is_empty() || !path.is_absolute() {
        return Err(format!("Use an absolute path: {path_text}"));
    }
    if path.components().any(|component| matches!(component, Component::ParentDir)) {
        return Err(OUTSIDE.to_string());
    }
    let mut existing = path;
    let mut rest: Vec<OsString> = Vec::new();
    loop {
        if let Ok(canonical) = existing.canonicalize() {
            let mut resolved = canonical;
            for part in rest.iter().rev() {
                resolved.push(part);
            }
            return Ok(resolved);
        }
        let (Some(name), Some(parent)) = (existing.file_name(), existing.parent()) else {
            return Err(OUTSIDE.to_string());
        };
        rest.push(name.to_os_string());
        existing = parent;
    }
}

pub fn is_inside(folders: &[PathBuf], path: &Path) -> bool {
    folders.iter().any(|folder| path.starts_with(folder))
}

/// An absolute file or folder path inside a workspace folder, canonical.
pub fn checked_path(folders: &[PathBuf], path_text: &str) -> Result<PathBuf, String> {
    let resolved = resolve(path_text)?;
    if is_inside(folders, &resolved) {
        Ok(resolved)
    } else {
        Err(OUTSIDE.to_string())
    }
}

/// Inside a workspace folder, or the repository a workspace folder was opened in.
fn repo_allowed(folders: &[PathBuf], path: &Path) -> bool {
    is_inside(folders, path) || folders.iter().any(|folder| folder.starts_with(path))
}

/// The work tree root of the repository at or above `repo_path`, canonical. The app lists
/// a repository that encloses a workspace folder too, so that one is allowed as well.
pub fn checked_repo(folders: &[PathBuf], repo_path: &str) -> Result<PathBuf, String> {
    let resolved = resolve(repo_path)?;
    if !repo_allowed(folders, &resolved) {
        return Err(OUTSIDE.to_string());
    }
    let repo = git2::Repository::discover(&resolved).map_err(|_| format!("Not a git repository: {repo_path}"))?;
    let root = repo
        .workdir()
        .and_then(|workdir| workdir.canonicalize().ok())
        .ok_or_else(|| "Bare repositories are not supported".to_string())?;
    if !repo_allowed(folders, &root) {
        return Err(OUTSIDE.to_string());
    }
    Ok(root)
}

/// A file of the repository at `repo_root`, given absolute or relative to it, as the
/// repo-relative `/` path git commands take.
pub fn repo_relative(repo_root: &Path, file_path: &str) -> Result<String, String> {
    let path = Path::new(file_path);
    if path.is_absolute() {
        let resolved = resolve(file_path)?;
        if resolved == repo_root {
            return Err(format!("Not a file in the repository: {file_path}"));
        }
        if !resolved.starts_with(repo_root) {
            return Err(format!("Not inside the repository: {file_path}"));
        }
        return Ok(relative_slash_path(repo_root, &resolved));
    }
    let escapes = file_path.is_empty()
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::Prefix(_) | Component::RootDir));
    if escapes {
        return Err(format!("Not inside the repository: {file_path}"));
    }
    Ok(file_path.trim_start_matches("./").to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::TestDir;

    #[test]
    fn only_paths_inside_the_workspace_pass() {
        let workspace = TestDir::new();
        workspace.write("inside.txt", "x");
        let outside = TestDir::new();
        outside.write("secret.txt", "x");
        let folders = canonical_folders(&[workspace.path_string(), "/definitely/missing".to_string()]);
        assert_eq!(folders.len(), 1);

        assert!(checked_path(&folders, &workspace.file_string("inside.txt")).is_ok());
        assert!(checked_path(&folders, &workspace.file_string("new/dir/file.txt")).is_ok(), "may not exist yet");
        assert_eq!(checked_path(&folders, &outside.file_string("secret.txt")).unwrap_err(), OUTSIDE);
        let sneaky = format!("{}/../../secret.txt", workspace.path_string());
        assert_eq!(checked_path(&folders, &sneaky).unwrap_err(), OUTSIDE);
        assert!(checked_path(&folders, "relative.txt").is_err());
        assert_eq!(checked_path(&[], &workspace.file_string("inside.txt")).unwrap_err(), OUTSIDE);
    }

    #[cfg(unix)]
    #[test]
    fn a_link_out_of_the_workspace_is_refused() {
        let workspace = TestDir::new();
        let outside = TestDir::new();
        outside.write("secret.txt", "x");
        std::os::unix::fs::symlink(outside.path.clone(), workspace.file("link")).unwrap();
        let folders = canonical_folders(&[workspace.path_string()]);
        assert_eq!(checked_path(&folders, &workspace.file_string("link/secret.txt")).unwrap_err(), OUTSIDE);
    }

    #[test]
    fn repositories_inside_or_enclosing_a_folder_are_allowed() {
        let workspace = TestDir::new();
        let repo_root = workspace.init_repo("repo");
        workspace.mkdir("repo/sub");
        let folders = canonical_folders(&[workspace.path_string()]);
        assert_eq!(checked_repo(&folders, &workspace.file_string("repo")).unwrap(), repo_root);
        assert_eq!(checked_repo(&folders, &workspace.file_string("repo/sub")).unwrap(), repo_root);
        assert!(checked_repo(&folders, &workspace.path_string()).unwrap_err().contains("Not a git repository"));

        // A folder opened inside a repository may use that repository.
        let inner = canonical_folders(&[workspace.file_string("repo/sub")]);
        assert_eq!(checked_repo(&inner, &workspace.file_string("repo")).unwrap(), repo_root);

        let other = TestDir::new();
        other.init_repo("elsewhere");
        assert_eq!(checked_repo(&folders, &other.file_string("elsewhere")).unwrap_err(), OUTSIDE);
    }

    #[test]
    fn repo_relative_paths_stay_in_the_repository() {
        let workspace = TestDir::new();
        let repo_root = workspace.init_repo("repo");
        workspace.write("repo/a.txt", "a");
        let absolute = workspace.file_string("repo/a.txt");
        assert_eq!(repo_relative(&repo_root, &absolute).unwrap(), "a.txt");
        assert_eq!(repo_relative(&repo_root, "dir/b.txt").unwrap(), "dir/b.txt");
        assert_eq!(repo_relative(&repo_root, &workspace.file_string("repo/gone.txt")).unwrap(), "gone.txt");
        assert!(repo_relative(&repo_root, "../x").is_err());
        assert!(repo_relative(&repo_root, &workspace.file_string("other.txt")).is_err());
    }
}
