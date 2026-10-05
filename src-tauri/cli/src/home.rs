//! Where Git Manager keeps its files (`~/.gitmanager`), shared by the app and this tool so both
//! always look in the same folder.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

pub const DIR_NAME: &str = ".gitmanager";

pub fn home_dir() -> Result<PathBuf, String> {
    home_from(cfg!(windows), |name| std::env::var_os(name)).ok_or_else(|| "Could not find your home folder".to_string())
}

/// Windows reads USERPROFILE first: HOME is usually unset there, and when Git Bash sets it, an app
/// started from Explorer does not see it, so the app and the command line tool would disagree.
pub fn home_from(windows: bool, lookup: impl Fn(&str) -> Option<OsString>) -> Option<PathBuf> {
    let names: &[&str] = if windows { &["USERPROFILE", "HOME"] } else { &["HOME"] };
    names.iter().filter_map(|name| lookup(name)).find(|home| !home.is_empty()).map(PathBuf::from)
}

pub fn config_dir_in(home: &Path) -> PathBuf {
    home.join(DIR_NAME)
}

/// A path the way the app writes paths: on Windows `/` separators, an upper case drive and no
/// `\\?\` (the app's `paths::to_ui` does the same).
pub fn to_ui(path: &Path) -> String {
    ui_text(&dunce::simplified(path).to_string_lossy(), cfg!(windows))
}

pub fn ui_text(text: &str, windows: bool) -> String {
    if !windows {
        return text.to_string();
    }
    let mut text = text.replace('\\', "/");
    if text.as_bytes().get(1) == Some(&b':') && text.as_bytes()[0].is_ascii_lowercase() {
        text[..1].make_ascii_uppercase();
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lookup(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<OsString> {
        let pairs: Vec<(String, String)> = pairs.iter().map(|(name, value)| (name.to_string(), value.to_string())).collect();
        move |name| pairs.iter().find(|(key, _)| key == name).map(|(_, value)| OsString::from(value))
    }

    #[test]
    fn the_home_folder_comes_from_home_on_unix() {
        let env = lookup(&[("HOME", "/Users/someone"), ("USERPROFILE", "/elsewhere")]);
        assert_eq!(home_from(false, &env), Some(PathBuf::from("/Users/someone")));
        assert_eq!(home_from(false, lookup(&[("USERPROFILE", "/elsewhere")])), None);
        assert_eq!(home_from(false, lookup(&[("HOME", "")])), None);
    }

    #[test]
    fn windows_prefers_userprofile_and_falls_back_to_home() {
        let both = lookup(&[("HOME", "C:/msys/home"), ("USERPROFILE", r"C:\Users\someone")]);
        assert_eq!(home_from(true, &both), Some(PathBuf::from(r"C:\Users\someone")));
        assert_eq!(home_from(true, lookup(&[("HOME", r"D:\home"), ("USERPROFILE", "")])), Some(PathBuf::from(r"D:\home")));
        assert_eq!(home_from(true, lookup(&[])), None);
    }

    #[test]
    fn windows_paths_get_slashes_and_an_upper_case_drive() {
        assert_eq!(ui_text(r"c:\Users\me", true), "C:/Users/me");
        assert_eq!(ui_text("/tmp/a\\b", false), "/tmp/a\\b");
    }
}
