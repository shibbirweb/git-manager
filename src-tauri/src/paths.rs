//! Absolute paths between the backend, git and the page.
//!
//! The page splits paths on "/" and git takes "/" paths on every platform, so on Windows an
//! absolute path leaves the backend as `C:/Users/me/repo`. `std::fs::canonicalize` returns the
//! verbatim form there (`\\?\C:\...`), which git and many tools reject, and `Path::join` adds `\`.
//! So real paths come from `real` or `RealPath::real_path` (clippy.toml forbids `canonicalize`),
//! and every absolute path for the page goes through `to_ui`.

use std::io;
use std::path::{Path, PathBuf};

/// The real path (symlinks and `..` resolved), without the `\\?\` prefix where Windows does not need it.
pub fn real(path: impl AsRef<Path>) -> io::Result<PathBuf> {
    dunce::canonicalize(path)
}

/// `real` as a method, where `canonicalize` was one.
pub trait RealPath {
    fn real_path(&self) -> io::Result<PathBuf>;
}

impl RealPath for Path {
    fn real_path(&self) -> io::Result<PathBuf> {
        real(self)
    }
}

/// A path as the page and git see it: on Windows `/` separators, an upper case drive letter and no `\\?\`.
pub fn to_ui(path: impl AsRef<Path>) -> String {
    ui_text(&dunce::simplified(path.as_ref()).to_string_lossy(), cfg!(windows))
}

/// `to_ui` for a serde field: `#[serde(serialize_with = "crate::paths::serialize_ui")]`.
pub fn serialize_ui<P: AsRef<Path>, S: serde::Serializer>(path: &P, serializer: S) -> Result<S::Ok, S::Error> {
    serializer.serialize_str(&to_ui(path))
}

fn ui_text(text: &str, windows: bool) -> String {
    if !windows {
        return text.to_string();
    }
    let mut text = text.replace('\\', "/");
    // One spelling of the drive, so `c:/repo` from one source and `C:/repo` from another compare equal.
    if text.as_bytes().get(1) == Some(&b':') && text.as_bytes()[0].is_ascii_lowercase() {
        text[..1].make_ascii_uppercase();
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unix_paths_are_left_alone() {
        assert_eq!(ui_text("/Users/me/repo", false), "/Users/me/repo");
        // A backslash is a valid file name character on Unix.
        assert_eq!(ui_text("/tmp/a\\b", false), "/tmp/a\\b");
    }

    #[test]
    fn windows_paths_get_slashes_and_an_upper_case_drive() {
        assert_eq!(ui_text(r"C:\Users\me\repo", true), "C:/Users/me/repo");
        assert_eq!(ui_text(r"c:\repo\src/main.rs", true), "C:/repo/src/main.rs");
        assert_eq!(ui_text(r"\\server\share\repo", true), "//server/share/repo");
        assert_eq!(ui_text("", true), "");
    }

    #[test]
    fn real_paths_resolve_dot_dot() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::create_dir(dir.path().join("a")).unwrap();
        let real_dir = real(dir.path()).unwrap();
        assert_eq!(dir.path().join("a").join("..").real_path().unwrap(), real_dir);
        assert!(!to_ui(&real_dir).starts_with(r"\\?\"));
        assert!(real(dir.path().join("missing")).is_err());
    }
}
