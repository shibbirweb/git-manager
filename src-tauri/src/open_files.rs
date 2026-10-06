//! The files each window has open in a tab, so the watcher can tell the page
//! when one of them changes even where git status cannot see it (an ignored
//! log file, say). Set by the frontend whenever its tabs change.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

use crate::paths::RealPath;

/// Per window label: each open file's real path, mapped to the path the page sent.
#[derive(Clone, Default)]
pub struct OpenFiles(Arc<RwLock<HashMap<String, HashMap<PathBuf, String>>>>);

impl OpenFiles {
    pub fn set(&self, window_label: &str, file_paths: &[String]) {
        let files = file_paths.iter().map(|file_path| (real_or_given(Path::new(file_path)), file_path.clone())).collect();
        self.0
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .insert(window_label.to_string(), files);
    }

    /// A copy, so a batch of watcher events does not hold the lock.
    pub fn get(&self, window_label: &str) -> HashMap<PathBuf, String> {
        self.0
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get(window_label)
            .cloned()
            .unwrap_or_default()
    }

    pub fn remove(&self, window_label: &str) {
        self.0.write().unwrap_or_else(|poisoned| poisoned.into_inner()).remove(window_label);
    }
}

/// The path as watcher events name it. A file that is gone keeps its folder's real path,
/// so it is still noticed when it comes back.
fn real_or_given(file_path: &Path) -> PathBuf {
    if let Ok(real) = file_path.real_path() {
        return real;
    }
    match (file_path.parent().and_then(|parent| parent.real_path().ok()), file_path.file_name()) {
        (Some(parent), Some(name)) => parent.join(name),
        _ => file_path.to_path_buf(),
    }
}

#[cfg(test)]
mod tests {
    use super::OpenFiles;
    use crate::paths::RealPath;

    #[test]
    fn open_files_are_kept_by_real_path_per_window() {
        let dir = tempfile::TempDir::new().unwrap();
        let file_path = dir.path().join("app.log");
        std::fs::write(&file_path, "one\n").unwrap();
        let shown = file_path.to_string_lossy().to_string();
        let missing = dir.path().join("later.log").to_string_lossy().to_string();

        let open = OpenFiles::default();
        open.set("main", &[shown.clone(), missing.clone()]);
        let files = open.get("main");
        assert_eq!(files.get(&file_path.real_path().unwrap()), Some(&shown));
        assert_eq!(files.get(&dir.path().real_path().unwrap().join("later.log")), Some(&missing));
        assert!(open.get("other").is_empty());

        open.remove("main");
        assert!(open.get("main").is_empty());
    }
}
