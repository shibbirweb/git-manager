//! The settings folder from the Git Manager days, moved once to its new name.

use std::path::Path;

use crate::config::config_dir_in;

/// The settings folder while the app was called Git Manager.
const LEGACY_DIR_NAME: &str = ".gitmanager";

/// Moves `~/.gitmanager` to `~/.nibtree` once, so settings, recent folders and layout carry over after the
/// rename. Nothing happens when the new folder exists or the old one does not; a failed move leaves both alone.
pub fn move_legacy_dir_in(home: &Path) -> bool {
    let legacy = home.join(LEGACY_DIR_NAME);
    let current = config_dir_in(home);
    if current.exists() || !legacy.is_dir() {
        return false;
    }
    std::fs::rename(&legacy, &current).is_ok()
}

#[cfg(test)]
mod legacy_dir_tests {
    use super::{config_dir_in, move_legacy_dir_in, LEGACY_DIR_NAME};

    #[test]
    fn moves_the_git_manager_folder_once() {
        let home = tempfile::TempDir::new().unwrap();
        let legacy = home.path().join(LEGACY_DIR_NAME);
        std::fs::create_dir_all(&legacy).unwrap();
        std::fs::write(legacy.join("settings.json"), "{}").unwrap();
        assert!(move_legacy_dir_in(home.path()));
        assert!(!legacy.exists());
        assert_eq!(std::fs::read_to_string(config_dir_in(home.path()).join("settings.json")).unwrap(), "{}");
        assert!(!move_legacy_dir_in(home.path()));
    }

    #[test]
    fn leaves_both_folders_when_the_new_one_exists() {
        let home = tempfile::TempDir::new().unwrap();
        std::fs::create_dir_all(home.path().join(LEGACY_DIR_NAME)).unwrap();
        std::fs::create_dir_all(config_dir_in(home.path())).unwrap();
        assert!(!move_legacy_dir_in(home.path()));
        assert!(home.path().join(LEGACY_DIR_NAME).exists());
    }

    #[test]
    fn does_nothing_without_an_old_folder() {
        let home = tempfile::TempDir::new().unwrap();
        assert!(!move_legacy_dir_in(home.path()));
        assert!(!config_dir_in(home.path()).exists());
    }
}
