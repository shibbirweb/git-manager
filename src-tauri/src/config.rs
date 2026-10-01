//! User configuration in `~/.gitmanager/`, like VS Code's `~/.vscode/`:
//! `settings.json` holds preferences, `state.json` holds UI state such as
//! recent folders and panel sizes. The folder is created on first save.

use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::error::{AppError, AppResult};

pub const DIR_NAME: &str = ".gitmanager";

/// Config files the frontend may read and write, by logical name.
const FILES: [(&str, &str); 2] = [("settings", "settings.json"), ("state", "state.json")];

pub fn home_dir() -> AppResult<PathBuf> {
    std::env::var_os("HOME")
        .filter(|home| !home.is_empty())
        .map(PathBuf::from)
        .ok_or_else(|| AppError::invalid("Could not find your home folder"))
}

pub fn config_dir_in(home: &Path) -> PathBuf {
    home.join(DIR_NAME)
}

fn file_name(config_name: &str) -> AppResult<&'static str> {
    FILES
        .iter()
        .find(|(name, _)| *name == config_name)
        .map(|(_, file)| *file)
        .ok_or_else(|| AppError::invalid(format!("Unknown config file: {config_name}")))
}

/// Reads a config file. Missing files return None; unreadable JSON is an error
/// so a hand-edited typo is reported instead of silently reset.
pub fn load_in(dir: &Path, config_name: &str) -> AppResult<Option<Value>> {
    let path = dir.join(file_name(config_name)?);
    let text = match std::fs::read_to_string(&path) {
        Ok(text) => text,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(err) => return Err(err.into()),
    };
    if text.trim().is_empty() {
        return Ok(None);
    }
    serde_json::from_str(&text)
        .map(Some)
        .map_err(|err| AppError::invalid(format!("{} is not valid JSON: {err}", path.display())))
}

/// Writes a config file atomically (temp file + rename), creating the folder.
pub fn save_in(dir: &Path, config_name: &str, value: &Value) -> AppResult<()> {
    let file = file_name(config_name)?;
    std::fs::create_dir_all(dir)?;
    let path = dir.join(file);
    let temp = dir.join(format!(".{file}.tmp"));
    let mut text = serde_json::to_string_pretty(value).map_err(|err| AppError::invalid(err.to_string()))?;
    text.push('\n');
    std::fs::write(&temp, text)?;
    std::fs::rename(&temp, &path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_files_load_as_none_and_the_folder_is_created_on_save() {
        let home = tempfile::TempDir::new().unwrap();
        let dir = config_dir_in(home.path());
        assert_eq!(load_in(&dir, "settings").unwrap(), None);
        assert!(!dir.exists());

        save_in(&dir, "settings", &json!({ "theme": "dark", "tabSize": 2 })).unwrap();
        assert!(dir.join("settings.json").is_file());
        assert_eq!(load_in(&dir, "settings").unwrap(), Some(json!({ "theme": "dark", "tabSize": 2 })));
        assert!(!dir.join(".settings.json.tmp").exists());
    }

    #[test]
    fn files_are_pretty_printed_and_kept_separate() {
        let home = tempfile::TempDir::new().unwrap();
        let dir = config_dir_in(home.path());
        save_in(&dir, "state", &json!({ "recentFolders": ["/a"] })).unwrap();
        let text = std::fs::read_to_string(dir.join("state.json")).unwrap();
        assert!(text.contains("\n  \"recentFolders\""));
        assert_eq!(load_in(&dir, "settings").unwrap(), None);
    }

    #[test]
    fn unknown_names_and_bad_json_are_errors() {
        let home = tempfile::TempDir::new().unwrap();
        let dir = config_dir_in(home.path());
        assert!(load_in(&dir, "../secrets").is_err());
        assert!(save_in(&dir, "other", &json!({})).is_err());

        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("settings.json"), "{ not json").unwrap();
        assert!(matches!(load_in(&dir, "settings"), Err(AppError::Invalid(_))));
        std::fs::write(dir.join("settings.json"), "  \n").unwrap();
        assert_eq!(load_in(&dir, "settings").unwrap(), None);
    }
}
