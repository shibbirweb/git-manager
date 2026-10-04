//! Unsaved text kept across restarts (Settings > Editor > Remember unsaved changes), like
//! Sublime Text's hot exit: the text of an Untitled tab (File > New File) or of a file with
//! unsaved edits stays in `~/.gitmanager/unsaved/` until it is saved, reverted or discarded.
//!
//! One file per tab, `<40 hex>.txt`, named by the hash of the tab path: a line of JSON with
//! the tab path, the workspace and the time, a newline, then the text as the editor holds it
//! (LF line endings). That is the raw body the editor sends, so it is written as it arrives,
//! and listing reads only the first line of each file. Writes go through a temporary file and
//! a rename; nothing is kept in memory.

use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};

use git2::{ObjectType, Oid};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

pub const DIR_NAME: &str = "unsaved";
/// Bigger texts are not kept: the editor opens files up to 4 MB, and a paste this big is rare.
pub const MAX_TEXT_BYTES: usize = 16 * 1024 * 1024;
const MAX_TAB_PATH: usize = 4096;
/// Workspace ids are folder lists, so they may be long (the tab session allows the same).
const MAX_WORKSPACE_ID: usize = MAX_TAB_PATH * 4;
const UNTITLED_PREFIX: &str = "untitled:";
const EXTENSION: &str = "txt";

/// What each kept text belongs to.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsavedMeta {
    /// An absolute file path, or `untitled:<id>` for an Untitled tab.
    pub tab_path: String,
    /// The workspace the tab was open in; an Untitled tab comes back only there.
    pub workspace_id: String,
    /// Milliseconds since the epoch.
    pub saved_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsavedText {
    #[serde(flatten)]
    pub meta: UnsavedMeta,
    pub text: String,
}

/// An Untitled tab's path: `untitled:` and a short id of letters and digits.
pub fn is_untitled(tab_path: &str) -> bool {
    tab_path.strip_prefix(UNTITLED_PREFIX).is_some_and(|id| {
        !id.is_empty() && id.len() <= 32 && id.bytes().all(|byte| byte.is_ascii_alphanumeric())
    })
}

/// Tab paths come from the editor; anything else is refused before it names a file.
pub fn check_tab_path(tab_path: &str) -> AppResult<()> {
    let valid = !tab_path.is_empty()
        && tab_path.len() <= MAX_TAB_PATH
        && !tab_path.contains('\0')
        && (is_untitled(tab_path) || Path::new(tab_path).is_absolute());
    if valid {
        Ok(())
    } else {
        Err(AppError::invalid(format!("Not a tab path: {tab_path}")))
    }
}

fn file_for(dir: &Path, tab_path: &str) -> AppResult<PathBuf> {
    check_tab_path(tab_path)?;
    let hash = Oid::hash_object(ObjectType::Blob, tab_path.as_bytes())?;
    Ok(dir.join(format!("{hash}.{EXTENSION}")))
}

/// Keeps `text` for `meta.tab_path`, replacing what was kept before.
pub fn write(dir: &Path, meta: &UnsavedMeta, text: &[u8]) -> AppResult<()> {
    if text.len() > MAX_TEXT_BYTES {
        return Err(AppError::invalid("The text is too large to keep"));
    }
    if meta.workspace_id.len() > MAX_WORKSPACE_ID {
        return Err(AppError::invalid("The workspace id is too long"));
    }
    std::str::from_utf8(text).map_err(|_| AppError::invalid("The text is not valid UTF-8"))?;
    let path = file_for(dir, &meta.tab_path)?;
    let mut bytes = serde_json::to_vec(meta).map_err(|err| AppError::invalid(err.to_string()))?;
    bytes.push(b'\n');
    bytes.extend_from_slice(text);
    std::fs::create_dir_all(dir)?;
    write_atomic(&path, &bytes)
}

/// The text kept for `tab_path`, if any; a damaged file reads as nothing.
pub fn read(dir: &Path, tab_path: &str) -> AppResult<Option<UnsavedText>> {
    let path = file_for(dir, tab_path)?;
    let bytes = match std::fs::read(&path) {
        Ok(bytes) => bytes,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(err) => return Err(err.into()),
    };
    let Some(split) = memchr::memchr(b'\n', &bytes) else {
        return Ok(None);
    };
    let Ok(meta) = serde_json::from_slice::<UnsavedMeta>(&bytes[..split]) else {
        return Ok(None);
    };
    if meta.tab_path != tab_path {
        return Ok(None);
    }
    let Ok(text) = String::from_utf8(bytes[split + 1..].to_vec()) else {
        return Ok(None);
    };
    Ok(Some(UnsavedText { meta, text }))
}

/// Forgets the text kept for `tab_path`; nothing kept is fine.
pub fn remove(dir: &Path, tab_path: &str) -> AppResult<()> {
    match std::fs::remove_file(file_for(dir, tab_path)?) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(err.into()),
    }
}

/// Every kept text's details, oldest first, without the texts. Damaged and foreign files are skipped.
pub fn list(dir: &Path) -> Vec<UnsavedMeta> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut found: Vec<UnsavedMeta> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|extension| extension == EXTENSION))
        .filter_map(|path| {
            let meta = read_meta(&path)?;
            // A file whose name does not match its tab path was not written here.
            (file_for(dir, &meta.tab_path).ok()? == path).then_some(meta)
        })
        .collect();
    found.sort_by(|a, b| a.saved_at.cmp(&b.saved_at).then_with(|| a.tab_path.cmp(&b.tab_path)));
    found
}

fn read_meta(path: &Path) -> Option<UnsavedMeta> {
    let file = std::fs::File::open(path).ok()?;
    let mut line = Vec::new();
    // The first line is small; the limit keeps a damaged file from being read whole.
    BufReader::new(file)
        .take((MAX_WORKSPACE_ID + MAX_TAB_PATH + 256) as u64)
        .read_until(b'\n', &mut line)
        .ok()?;
    if line.last() != Some(&b'\n') {
        return None;
    }
    serde_json::from_slice(&line[..line.len() - 1]).ok()
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::TestDir;

    fn meta(tab_path: &str, saved_at: u64) -> UnsavedMeta {
        UnsavedMeta {
            tab_path: tab_path.to_string(),
            workspace_id: "/work/app".to_string(),
            saved_at,
        }
    }

    #[test]
    fn writes_reads_and_removes_a_text() {
        let dir = TestDir::new();
        let store = dir.file("unsaved");
        assert_eq!(read(&store, "/work/app/a.txt").unwrap(), None);
        write(&store, &meta("/work/app/a.txt", 5), "one\ntwo\n".as_bytes()).unwrap();
        let kept = read(&store, "/work/app/a.txt").unwrap().unwrap();
        assert_eq!(kept.meta, meta("/work/app/a.txt", 5));
        assert_eq!(kept.text, "one\ntwo\n");

        write(&store, &meta("/work/app/a.txt", 6), "three".as_bytes()).unwrap();
        assert_eq!(read(&store, "/work/app/a.txt").unwrap().unwrap().text, "three");
        assert_eq!(std::fs::read_dir(&store).unwrap().count(), 1, "one file per tab, no temporary left");

        remove(&store, "/work/app/a.txt").unwrap();
        assert_eq!(read(&store, "/work/app/a.txt").unwrap(), None);
        remove(&store, "/work/app/a.txt").unwrap();
    }

    #[test]
    fn keeps_empty_and_newline_texts_exactly() {
        let dir = TestDir::new();
        let store = dir.file("unsaved");
        for text in ["", "\n", "\n\nx", "unicode: \u{e9}\u{4e2d}"] {
            write(&store, &meta("untitled:abc1", 1), text.as_bytes()).unwrap();
            assert_eq!(read(&store, "untitled:abc1").unwrap().unwrap().text, text);
        }
    }

    #[test]
    fn lists_details_oldest_first_and_skips_strangers() {
        let dir = TestDir::new();
        let store = dir.file("unsaved");
        assert!(list(&store).is_empty(), "a missing folder lists nothing");
        write(&store, &meta("untitled:b", 20), b"later").unwrap();
        write(&store, &meta("/work/app/a.txt", 10), b"first").unwrap();
        std::fs::write(store.join("notes.txt"), "{\"tabPath\":\"/x\",\"workspaceId\":\"w\",\"savedAt\":1}\nhi").unwrap();
        std::fs::write(store.join("broken.txt"), "not json").unwrap();
        std::fs::write(store.join("other.json"), "{}").unwrap();
        let listed: Vec<String> = list(&store).into_iter().map(|meta| meta.tab_path).collect();
        assert_eq!(listed, ["/work/app/a.txt", "untitled:b"]);
    }

    #[test]
    fn a_damaged_file_reads_as_nothing() {
        let dir = TestDir::new();
        let store = dir.file("unsaved");
        write(&store, &meta("/work/app/a.txt", 1), b"text").unwrap();
        let path = file_for(&store, "/work/app/a.txt").unwrap();
        std::fs::write(&path, "no newline").unwrap();
        assert_eq!(read(&store, "/work/app/a.txt").unwrap(), None);
        std::fs::write(&path, "{\"tabPath\":\"/other\",\"workspaceId\":\"w\",\"savedAt\":1}\ntext").unwrap();
        assert_eq!(read(&store, "/work/app/a.txt").unwrap(), None, "a file for another tab is not this one's");
    }

    #[test]
    fn refuses_bad_tab_paths_and_big_texts() {
        let dir = TestDir::new();
        let store = dir.file("unsaved");
        for bad in ["", "relative/a.txt", "untitled:", "untitled:../x", "untitled:a b", "/a\0b"] {
            assert!(write(&store, &meta(bad, 1), b"x").is_err(), "{bad:?} was accepted");
            assert!(read(&store, bad).is_err(), "{bad:?} was read");
        }
        let big = vec![b'a'; MAX_TEXT_BYTES + 1];
        assert!(write(&store, &meta("untitled:a", 1), &big).is_err());
        assert!(write(&store, &meta("untitled:a", 1), &[0xff, 0xfe]).is_err(), "not UTF-8");
    }

    #[test]
    fn untitled_paths_are_short_ids() {
        assert!(is_untitled("untitled:k3j2x9"));
        assert!(!is_untitled("untitled:"));
        assert!(!is_untitled("untitled:a/b"));
        assert!(!is_untitled(&format!("untitled:{}", "a".repeat(33))));
        assert!(!is_untitled("/work/untitled:a"));
    }
}
