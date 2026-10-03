//! Git LFS: whether it is installed and used, which files it stores, pointer
//! detection for diffs, and its commands through the git CLI.

use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::Path;
use std::sync::{Mutex, PoisonError};

use git2::Repository;
use serde::Serialize;

use super::cli;
use super::files::path_stamp;
use crate::error::{AppError, AppResult};

/// Pointer files are small text files; anything bigger is real content.
const MAX_POINTER_BYTES: usize = 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LfsPointer {
    /// `sha256:<hex>`.
    pub oid: String,
    pub size: u64,
}

/// Parses a Git LFS pointer file (https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md):
/// a `version` line first, then sorted `key value` lines with an `oid` and a `size`.
pub fn parse_pointer(bytes: &[u8]) -> Option<LfsPointer> {
    if bytes.len() > MAX_POINTER_BYTES || !bytes.starts_with(b"version ") {
        return None;
    }
    let text = std::str::from_utf8(bytes).ok()?;
    let mut lines = text.lines();
    let version = lines.next()?.strip_prefix("version ")?;
    if !version.starts_with("https://git-lfs.github.com/spec/") && !version.starts_with("https://hawser.github.com/spec/") {
        return None;
    }
    let mut oid = None;
    let mut size = None;
    for line in lines {
        if line.is_empty() {
            continue;
        }
        let (key, value) = line.split_once(' ')?;
        match key {
            "oid" => {
                let hex = value.strip_prefix("sha256:")?;
                if hex.len() != 64 || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
                    return None;
                }
                oid = Some(value.to_string());
            }
            "size" => size = value.parse::<u64>().ok(),
            _ => {}
        }
    }
    Some(LfsPointer { oid: oid?, size: size? })
}

/// Patterns that `.gitattributes` text routes through LFS (`filter=lfs`).
pub fn lfs_patterns(attributes: &str) -> Vec<String> {
    attributes
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let pattern = parts.next()?;
            parts.any(|attribute| attribute == "filter=lfs").then(|| pattern.to_string())
        })
        .collect()
}

/// The `.gitattributes` files of the repository: the root one, every tracked
/// one below it, and `.git/info/attributes`; with the repo-relative paths of the
/// tracked ones below the root.
fn attribute_texts(repo: &Repository) -> (Vec<String>, Vec<String>) {
    let mut texts = Vec::new();
    let mut nested = Vec::new();
    let Some(root) = repo.workdir() else {
        return (texts, nested);
    };
    let mut read = |path: &Path| {
        if let Ok(text) = std::fs::read_to_string(path) {
            texts.push(text);
        }
    };
    read(&root.join(".gitattributes"));
    read(&repo.path().join("info").join("attributes"));
    if let Ok(index) = repo.index() {
        for entry in index.iter() {
            let path = String::from_utf8_lossy(&entry.path).into_owned();
            if path.ends_with("/.gitattributes") {
                read(&root.join(&path));
                nested.push(path);
            }
        }
    }
    (texts, nested)
}

/// Everything an LFS state depends on, without reading the index or running git-lfs: HEAD,
/// the index file, every attributes file (the tracked ones below the root are the `nested`
/// paths found by the last full read: adding one changes the index) and what is known about
/// the git-lfs install. The nested paths follow the hash, one per line, so a later check
/// needs nothing else.
fn lfs_stamp(repo: &Repository, nested: &[String], install: &Option<Option<String>>) -> String {
    let mut hasher = DefaultHasher::new();
    match repo.head().ok().and_then(|head| head.target()) {
        Some(oid) => oid.to_string().hash(&mut hasher),
        None => "unborn".hash(&mut hasher),
    }
    path_stamp(&repo.path().join("index")).hash(&mut hasher);
    path_stamp(&repo.path().join("info").join("attributes")).hash(&mut hasher);
    if let Some(root) = repo.workdir() {
        path_stamp(&root.join(".gitattributes")).hash(&mut hasher);
        for path in nested {
            path.hash(&mut hasher);
            path_stamp(&root.join(path)).hash(&mut hasher);
        }
    }
    install.hash(&mut hasher);
    let mut stamp = format!("{:016x}", hasher.finish());
    for path in nested {
        stamp.push('\n');
        stamp.push_str(path);
    }
    stamp
}

/// The nested attribute paths a stamp carries.
fn stamp_paths(stamp: &str) -> Vec<String> {
    stamp.split('\n').skip(1).map(str::to_string).collect()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LfsStatus {
    /// `git lfs version` output, or None when git-lfs is not installed or was not checked yet.
    pub version: Option<String>,
    /// Some attributes file routes paths through LFS.
    pub used: bool,
    /// The patterns of the root `.gitattributes` (what Track/Untrack change).
    pub patterns: Vec<String>,
    /// Repo-relative paths stored in LFS (`git lfs ls-files`); empty when not installed.
    pub files: Vec<String>,
    /// The state this answer was read at, passed back as the known stamp next time.
    pub stamp: String,
    /// Nothing changed since the known stamp: no other field is filled in.
    pub unchanged: bool,
}

/// `git lfs version`, or None when the `git-lfs` binary is missing.
pub fn version(repo_path: &Path) -> Option<String> {
    let output = cli::run_raw(repo_path, &["lfs", "version"], None).ok()?;
    if !output.success {
        return None;
    }
    let text = output.stdout.trim().to_string();
    (!text.is_empty()).then_some(text)
}

/// What `git lfs version` said, kept for the app run so status refreshes cost no process for it.
struct InstallCache(Mutex<Option<Option<String>>>);

impl InstallCache {
    const fn new() -> Self {
        Self(Mutex::new(None))
    }

    /// The installed version. `probe` runs only when the answer is `needed` and still unknown,
    /// or on `recheck` while git-lfs is not known to be installed (it may have been installed since).
    fn get(&self, needed: bool, recheck: bool, probe: impl FnOnce() -> Option<String>) -> Option<String> {
        let mut known = self.0.lock().unwrap_or_else(PoisonError::into_inner);
        let stale = match known.as_ref() {
            None => needed || recheck,
            Some(None) => recheck,
            Some(Some(_)) => false,
        };
        if stale {
            *known = Some(probe());
        }
        known.clone().flatten()
    }

    /// What is known now, without probing.
    fn snapshot(&self) -> Option<Option<String>> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner).clone()
    }
}

static INSTALLED: InstallCache = InstallCache::new();

/// The LFS state of a repository. The install check only runs for a repository that uses LFS
/// (once per app run) or with `check_install` (an LFS action is about to run). With the
/// `known_stamp` of the state the caller has, an unchanged repository answers `unchanged`
/// after a few file checks, with no git-lfs process and without reading the index.
pub fn status(repo_path: &str, check_install: bool, known_stamp: Option<&str>) -> AppResult<LfsStatus> {
    let root = Path::new(repo_path);
    status_with(repo_path, check_install, known_stamp, &INSTALLED, || version(root))
}

fn status_with(
    repo_path: &str,
    check_install: bool,
    known_stamp: Option<&str>,
    installed: &InstallCache,
    probe: impl FnOnce() -> Option<String>,
) -> AppResult<LfsStatus> {
    let repo = Repository::open(repo_path)?;
    if let (Some(known), false) = (known_stamp, check_install) {
        if lfs_stamp(&repo, &stamp_paths(known), &installed.snapshot()) == known {
            return Ok(LfsStatus {
                version: None,
                used: false,
                patterns: Vec::new(),
                files: Vec::new(),
                stamp: known.to_string(),
                unchanged: true,
            });
        }
    }
    let (texts, nested) = attribute_texts(&repo);
    let used = texts.iter().any(|text| !lfs_patterns(text).is_empty());
    let patterns = repo
        .workdir()
        .and_then(|root| std::fs::read_to_string(root.join(".gitattributes")).ok())
        .map(|text| lfs_patterns(&text))
        .unwrap_or_default();
    let version = installed.get(used, check_install, probe);
    // Taken before the file list: a change in between shows up as a change next time.
    let stamp = lfs_stamp(&repo, &nested, &installed.snapshot());
    drop(repo);
    let root = Path::new(repo_path);
    let files = if version.is_some() && used { ls_files(root).unwrap_or_default() } else { Vec::new() };
    Ok(LfsStatus {
        version,
        used,
        patterns,
        files,
        stamp,
        unchanged: false,
    })
}

/// `git lfs ls-files --name-only`: the checked-out files stored in LFS.
pub fn ls_files(repo_path: &Path) -> AppResult<Vec<String>> {
    let output = cli::run(repo_path, &["lfs", "ls-files", "--name-only"])?;
    Ok(output
        .stdout
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect())
}

fn checked_pattern(pattern: &str) -> AppResult<&str> {
    let trimmed = pattern.trim();
    if trimmed.is_empty() {
        return Err(AppError::invalid("Enter a pattern, for example *.psd"));
    }
    if trimmed.starts_with('-') || trimmed.contains('\n') {
        return Err(AppError::invalid(format!("Invalid pattern: {trimmed}")));
    }
    Ok(trimmed)
}

/// `git lfs track <pattern>`: adds the pattern to `.gitattributes`.
pub fn track(repo_path: &str, pattern: &str) -> AppResult<String> {
    let pattern = checked_pattern(pattern)?;
    Ok(cli::run(Path::new(repo_path), &["lfs", "track", pattern])?.text())
}

/// `git lfs untrack <pattern>`: removes the pattern from `.gitattributes`.
pub fn untrack(repo_path: &str, pattern: &str) -> AppResult<String> {
    let pattern = checked_pattern(pattern)?;
    Ok(cli::run(Path::new(repo_path), &["lfs", "untrack", pattern])?.text())
}

/// `git lfs pull` or `git lfs fetch`, streaming git-lfs's progress lines.
pub fn transfer(repo_path: &str, pull: bool, on_progress: impl FnMut(&str)) -> AppResult<String> {
    let command = if pull { "pull" } else { "fetch" };
    Ok(cli::run_streaming(Path::new(repo_path), &["lfs", command], on_progress)?.text())
}

/// `git lfs prune`: deletes local copies of old LFS files already on the remote.
pub fn prune(repo_path: &str) -> AppResult<String> {
    Ok(cli::run(Path::new(repo_path), &["lfs", "prune"])?.text())
}

/// `git lfs install --local`: the LFS hooks and filters for this repository only.
pub fn install(repo_path: &str) -> AppResult<String> {
    Ok(cli::run(Path::new(repo_path), &["lfs", "install", "--local"])?.text())
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;

    use super::*;
    use crate::test_support::TestRepo;

    const OID: &str = "sha256:4d7a214614ab2935c943f9e0ff69d22eadbb8f32b1258daaa5e2ca24d17e2393";

    fn pointer_text(size: &str) -> String {
        format!("version https://git-lfs.github.com/spec/v1\noid {OID}\nsize {size}\n")
    }

    #[test]
    fn detects_lfs_pointers() {
        assert_eq!(
            parse_pointer(pointer_text("12345").as_bytes()),
            Some(LfsPointer { oid: OID.to_string(), size: 12345 })
        );
        // Extension lines are allowed; the legacy hawser URL too.
        let extended = format!("version https://git-lfs.github.com/spec/v1\next-0-foo sha256:00\noid {OID}\nsize 1\n");
        assert_eq!(parse_pointer(extended.as_bytes()).map(|pointer| pointer.size), Some(1));
        let legacy = format!("version https://hawser.github.com/spec/v1\noid {OID}\nsize 7\n");
        assert!(parse_pointer(legacy.as_bytes()).is_some());

        assert!(parse_pointer(b"hello world\n").is_none());
        assert!(parse_pointer(pointer_text("big").as_bytes()).is_none());
        assert!(parse_pointer(b"version https://git-lfs.github.com/spec/v1\nsize 3\n").is_none());
        assert!(parse_pointer(format!("version https://example.com/v1\noid {OID}\nsize 3\n").as_bytes()).is_none());
        assert!(parse_pointer(b"version https://git-lfs.github.com/spec/v1\noid sha256:xyz\nsize 3\n").is_none());
        let mut large = pointer_text("3").into_bytes();
        large.resize(large.len() + 2000, b'x');
        assert!(parse_pointer(&large).is_none());
    }

    #[test]
    fn reads_lfs_patterns_from_attributes() {
        let text = "# comment\n*.psd filter=lfs diff=lfs merge=lfs -text\n*.txt text eol=lf\n\n\"assets/**\" filter=lfs diff=lfs merge=lfs -text\n";
        assert_eq!(lfs_patterns(text), vec!["*.psd".to_string(), "\"assets/**\"".to_string()]);
        assert!(lfs_patterns("*.png binary\n").is_empty());
    }

    #[test]
    fn status_finds_lfs_use_in_nested_attributes_without_git_lfs() {
        let repo = TestRepo::new();
        repo.write("a.txt", "a\n");
        repo.commit_all("base");
        let installed = InstallCache::new();
        let probes = Cell::new(0);
        let missing = || {
            probes.set(probes.get() + 1);
            None
        };
        let plain = status_with(&repo.path_string(), false, None, &installed, missing).unwrap();
        assert!(!plain.used);
        assert!(plain.patterns.is_empty());
        // A repository without LFS runs no git process for the install check.
        assert_eq!(probes.get(), 0);

        repo.write("art/.gitattributes", "*.psd filter=lfs diff=lfs merge=lfs -text\n");
        repo.commit_all("lfs in a folder");
        let nested = status_with(&repo.path_string(), false, None, &installed, missing).unwrap();
        assert!(nested.used);
        assert_eq!(nested.version, None);
        // Only the root file's patterns are the ones Track and Untrack edit.
        assert!(nested.patterns.is_empty());
        assert_eq!(probes.get(), 1);

        // Later refreshes reuse the answer, so the not-installed notice still has it.
        let again = status_with(&repo.path_string(), false, None, &installed, missing).unwrap();
        assert!(again.used && again.version.is_none());
        assert_eq!(probes.get(), 1);
    }

    #[test]
    fn a_known_stamp_answers_unchanged_until_head_the_index_or_attributes_change() {
        let repo = TestRepo::new();
        repo.write("a.txt", "a\n");
        repo.write("art/.gitattributes", "*.psd filter=lfs diff=lfs merge=lfs -text\n");
        repo.commit_all("base");
        let installed = InstallCache::new();
        let probes = Cell::new(0);
        let missing = || {
            probes.set(probes.get() + 1);
            None
        };
        let root = repo.path_string();
        let first = status_with(&root, false, None, &installed, missing).unwrap();
        assert!(first.used && !first.unchanged);
        // The nested attributes file rides along, so the check needs no index read.
        assert_eq!(stamp_paths(&first.stamp), vec!["art/.gitattributes".to_string()]);
        let check = |stamp: &str| status_with(&root, false, Some(stamp), &installed, || None).unwrap();

        let same = check(&first.stamp);
        assert!(same.unchanged && same.files.is_empty());
        assert_eq!(same.stamp, first.stamp);
        // Editing a plain file leaves it alone.
        repo.write("a.txt", "edited\n");
        assert!(check(&first.stamp).unchanged);
        // An install check always reads in full.
        assert!(!status_with(&root, true, Some(&first.stamp), &installed, || None).unwrap().unchanged);

        let mut stamp = check(&first.stamp).stamp;
        let mut expect_change = |what: &str, change: &dyn Fn()| {
            change();
            let next = check(&stamp);
            assert!(!next.unchanged, "{what} kept the stamp");
            stamp = next.stamp;
        };
        expect_change("the nested attributes file", &|| repo.write("art/.gitattributes", "*.png filter=lfs -text\n"));
        expect_change("the root attributes file", &|| repo.write(".gitattributes", "*.zip filter=lfs -text\n"));
        expect_change("info/attributes", &|| repo.write(".git/info/attributes", "*.bin filter=lfs -text\n"));
        expect_change("the index", &|| {
            repo.git(&["add", "a.txt"]);
        });
        expect_change("HEAD", &|| {
            repo.commit_all("next");
        });
        assert!(check(&stamp).unchanged);
        assert_eq!(probes.get(), 1);
    }

    #[test]
    fn install_check_runs_once_and_again_only_on_request_while_missing() {
        let installed = InstallCache::new();
        let probes = Cell::new(0);
        let answer = |result: Option<&str>| {
            probes.set(probes.get() + 1);
            result.map(str::to_string)
        };
        assert_eq!(installed.get(false, false, || answer(None)), None);
        assert_eq!(probes.get(), 0);
        assert_eq!(installed.get(true, false, || answer(None)), None);
        assert_eq!(installed.get(true, false, || answer(None)), None);
        assert_eq!(probes.get(), 1);

        // An LFS action asks again: git-lfs may have been installed since.
        assert_eq!(installed.get(false, true, || answer(Some("git-lfs/3.5.1"))).as_deref(), Some("git-lfs/3.5.1"));
        assert_eq!(probes.get(), 2);
        assert_eq!(installed.get(true, true, || answer(None)).as_deref(), Some("git-lfs/3.5.1"));
        assert_eq!(installed.get(false, false, || answer(None)).as_deref(), Some("git-lfs/3.5.1"));
        assert_eq!(probes.get(), 2);
    }

    fn lfs_installed() -> bool {
        version(&std::env::temp_dir()).is_some()
    }

    #[test]
    fn tracks_and_untracks_patterns_with_git_lfs() {
        if !lfs_installed() {
            eprintln!("git-lfs is not installed: skipping");
            return;
        }
        let repo = TestRepo::new();
        repo.write("a.txt", "a\n");
        repo.commit_all("base");
        let root = repo.path_string();
        install(&root).unwrap();
        track(&root, "*.psd").unwrap();
        assert!(repo.read_text(".gitattributes").contains("*.psd filter=lfs"));
        let tracked = status(&root, true, None).unwrap();
        assert!(tracked.used);
        assert_eq!(tracked.patterns, vec!["*.psd".to_string()]);

        repo.write("art.psd", vec![0u8, 1, 2, 3, 255]);
        repo.commit_all("art");
        assert_eq!(status(&root, false, None).unwrap().files, vec!["art.psd".to_string()]);
        let pointer = parse_pointer(&repo.index_bytes("art.psd")).expect("the index holds a pointer");
        assert_eq!(pointer.size, 5);

        untrack(&root, "*.psd").unwrap();
        assert!(!repo.read_text(".gitattributes").contains("*.psd"));
        assert!(track(&root, "--force").is_err());
    }
}

#[cfg(test)]
mod diff_tests {
    use crate::git::diff::{self, DiffArea};
    use crate::test_support::TestRepo;

    fn pointer(size: u64) -> String {
        format!(
            "version https://git-lfs.github.com/spec/v1\noid sha256:{}\nsize {size}\n",
            "a".repeat(64)
        )
    }

    #[test]
    fn diffs_of_pointer_files_carry_the_lfs_sizes() {
        let repo = TestRepo::new();
        repo.write("plain.txt", "text\n");
        repo.write("art.psd", pointer(2048));
        repo.commit_all("base");
        repo.write("art.psd", pointer(4096));
        repo.git(&["add", "art.psd"]);
        let staged = diff::working_file(&repo.open(), "art.psd", None, DiffArea::Staged).unwrap();
        let lfs = staged.lfs.expect("lfs sizes");
        assert_eq!((lfs.original_size, lfs.modified_size), (Some(2048), Some(4096)));
        assert!(lfs.original_oid.is_some());

        // The work tree side holds the real content: its size is its length.
        repo.write("art.psd", vec![7u8; 10]);
        let unstaged = diff::working_file(&repo.open(), "art.psd", None, DiffArea::Unstaged).unwrap();
        let lfs = unstaged.lfs.expect("lfs sizes");
        assert_eq!((lfs.original_size, lfs.modified_size), (Some(4096), Some(10)));
        assert!(lfs.modified_oid.is_none());

        repo.write("plain.txt", "changed\n");
        assert!(diff::working_file(&repo.open(), "plain.txt", None, DiffArea::Unstaged).unwrap().lfs.is_none());
    }
}
