//! Workspace browsing for the file explorer: one directory level at a time,
//! so large folders never load their whole tree.

use std::collections::{BinaryHeap, HashMap};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::{Path, PathBuf};

use git2::Repository;
use serde::Serialize;

use super::repo::bytes_to_text;
use super::workspace::{deepest_repo_index, relative_slash_path};
use crate::error::{AppError, AppResult};
use crate::merge::model::{into_lf, Eol};

/// Files above this size are not opened in the editor.
const MAX_OPEN_BYTES: u64 = 4 * 1024 * 1024;
/// Very large directories are cut off to keep the UI responsive.
const MAX_ENTRIES: usize = 5000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    /// The entry's name; its path is the listed folder joined with it.
    pub name: String,
    pub is_dir: bool,
    /// Matched by the .gitignore of the deepest repository containing it.
    pub ignored: bool,
    /// The root of one of the workspace repositories.
    pub is_repo: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirListing {
    pub entries: Vec<DirEntry>,
    pub truncated: bool,
}

/// One folder of a `FolderLister` answer.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderListing {
    /// As asked: workspace-relative with `/` separators, "" for the workspace folder itself.
    pub dir_path: String,
    /// The folder's state (see `FolderLister::stamp`), passed back as the known stamp next time.
    pub stamp: String,
    /// The folder still has the known stamp: it was not read and `entries` is empty.
    pub unchanged: bool,
    pub entries: Vec<DirEntry>,
    pub truncated: bool,
    /// The folder could not be read (deleted, not a folder, outside the workspace folder).
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub eol: Eol,
    pub binary: bool,
    pub too_large: bool,
    pub size: u64,
    /// The file's state on disk (see `stat_version`), passed back as `known_version`.
    pub version: String,
    /// The file still has `known_version`: nothing else is filled in and the text is not sent.
    pub unchanged: bool,
}

fn is_ignored(repo: &Repository, relative: &str, is_dir: bool) -> bool {
    // Directory-only patterns such as `target/` need the trailing slash.
    let candidate = if is_dir { format!("{relative}/") } else { relative.to_string() };
    repo.is_path_ignored(Path::new(&candidate)).unwrap_or(false)
}

/// Sort order of the listing: folders first, then by name ignoring case.
#[derive(PartialEq, Eq, PartialOrd, Ord)]
pub struct Candidate {
    is_file: bool,
    folded: String,
    pub name: String,
}

impl Candidate {
    pub fn is_dir(&self) -> bool {
        !self.is_file
    }
}

/// Follows symlinks so a linked folder can be expanded; only links need the extra stat.
fn is_dir_following_links(entry: &std::fs::DirEntry) -> bool {
    match entry.file_type() {
        Ok(kind) if kind.is_symlink() => std::fs::metadata(entry.path()).map(|meta| meta.is_dir()).unwrap_or(false),
        Ok(kind) => kind.is_dir(),
        Err(_) => false,
    }
}

/// The first `limit` entries of `full_dir` in listing order (without `.git`), and how many
/// there are in all. A cut-off listing still holds the first entries in sorted order, not
/// whichever ones the file system returned first.
pub fn sorted_candidates(full_dir: &Path, limit: usize) -> AppResult<(Vec<Candidate>, usize)> {
    // A max-heap of the smallest `limit` entries: memory stays bounded however large the
    // folder is, and nothing beyond the limit is checked for ignores.
    let mut kept: BinaryHeap<Candidate> = BinaryHeap::new();
    let mut total = 0usize;
    for entry in std::fs::read_dir(full_dir)? {
        let Ok(entry) = entry else {
            continue;
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        if name == ".git" {
            continue;
        }
        total += 1;
        let candidate = Candidate {
            is_file: !is_dir_following_links(&entry),
            folded: name.to_lowercase(),
            name,
        };
        if kept.len() < limit {
            kept.push(candidate);
        } else if kept.peek().is_some_and(|largest| candidate < *largest) {
            kept.pop();
            kept.push(candidate);
        }
    }
    Ok((kept.into_sorted_vec(), total))
}

/// The entries of `full_dir` with their flags. Only `owner`, the deepest repository containing
/// `full_dir`, decides what is ignored: every entry below it that is not itself a repository
/// root belongs to it.
pub fn describe(
    full_dir: &Path,
    candidates: impl IntoIterator<Item = Candidate>,
    repo_roots: &[PathBuf],
    owner: Option<(&Repository, &Path)>,
) -> Vec<DirEntry> {
    candidates
        .into_iter()
        .map(|candidate| {
            let is_dir = candidate.is_dir();
            let full_path = full_dir.join(&candidate.name);
            let is_repo = is_dir && repo_roots.iter().any(|repo_root| repo_root == &full_path);
            let ignored = match owner {
                Some((repo, repo_root)) if !is_repo => {
                    is_ignored(repo, &relative_slash_path(repo_root, &full_path), is_dir)
                }
                _ => false,
            };
            DirEntry {
                name: candidate.name,
                is_dir,
                ignored,
                is_repo,
            }
        })
        .collect()
}

/// A path's state on disk for a stamp, without reading it; "-" when it is missing.
pub fn path_stamp(path: &Path) -> String {
    std::fs::metadata(path)
        .map(|meta| stat_version(&meta))
        .unwrap_or_else(|_| "-".to_string())
}

/// git's per-user ignore file: `core.excludesFile`, else `$XDG_CONFIG_HOME/git/ignore`
/// or `~/.config/git/ignore`.
fn excludes_file(repo: &Repository) -> Option<PathBuf> {
    if let Some(path) = repo.config().ok().and_then(|config| config.get_path("core.excludesFile").ok()) {
        return Some(path);
    }
    let xdg = std::env::var_os("XDG_CONFIG_HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from);
    let config_home = xdg.or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))?;
    Some(config_home.join("git").join("ignore"))
}

/// A repository that owns listed folders, opened once per `FolderLister`.
struct Owner {
    repo: Repository,
    /// `info/exclude` and the per-user ignore file (its path too, as config may point elsewhere).
    ignore_stamp: String,
}

impl Owner {
    fn open(repo_root: &Path) -> Option<Owner> {
        let repo = Repository::open(repo_root).ok()?;
        let mut ignore_stamp = path_stamp(&repo.commondir().join("info").join("exclude"));
        if let Some(file) = excludes_file(&repo) {
            ignore_stamp.push_str(&format!("|{}={}", file.to_string_lossy(), path_stamp(&file)));
        }
        Some(Owner { repo, ignore_stamp })
    }
}

/// Lists several folders of one workspace folder in one call (the Files panel's refresh).
/// Each repository is opened and each `.gitignore` looked at once per lister, however many
/// folders below it are asked for. A folder whose stamp the caller already has answers
/// `unchanged` without being read.
pub struct FolderLister<'a> {
    /// Canonical roots of the workspace repositories.
    repo_roots: &'a [PathBuf],
    owners: HashMap<usize, Option<Owner>>,
    gitignores: HashMap<PathBuf, String>,
}

impl<'a> FolderLister<'a> {
    pub fn new(repo_roots: &'a [PathBuf]) -> Self {
        FolderLister {
            repo_roots,
            owners: HashMap::new(),
            gitignores: HashMap::new(),
        }
    }

    fn owner(&mut self, index: usize) -> Option<&Owner> {
        let repo_roots = self.repo_roots;
        self.owners
            .entry(index)
            .or_insert_with(|| Owner::open(&repo_roots[index]))
            .as_ref()
    }

    /// Everything a listing depends on, without reading the folder: the folder itself (its
    /// modification time changes when entries come or go, its inode when it is replaced),
    /// which repositories sit right inside it, and the owning repository's ignore inputs:
    /// the `.gitignore` of every folder from the repository root down to this one,
    /// `info/exclude` and the per-user ignore file. Hashed, so the answer stays small.
    fn stamp(&mut self, full_dir: &Path, meta: &std::fs::Metadata) -> String {
        let repo_roots = self.repo_roots;
        let mut hasher = DefaultHasher::new();
        stat_version(meta).hash(&mut hasher);
        for repo_root in repo_roots {
            if repo_root.parent() == Some(full_dir) {
                repo_root.hash(&mut hasher);
            }
        }
        if let Some(index) = deepest_repo_index(repo_roots, full_dir) {
            let repo_root = &repo_roots[index];
            repo_root.hash(&mut hasher);
            match self.owner(index) {
                Some(owner) => owner.ignore_stamp.hash(&mut hasher),
                None => "-".hash(&mut hasher),
            }
            for folder in full_dir.ancestors().take_while(|folder| folder.starts_with(repo_root)) {
                let stamp = self
                    .gitignores
                    .entry(folder.join(".gitignore"))
                    .or_insert_with_key(|gitignore| path_stamp(gitignore));
                stamp.hash(&mut hasher);
            }
        }
        format!("{:016x}", hasher.finish())
    }

    /// `full_dir` is the canonical workspace root joined with `dir_path`, or why it is not allowed.
    pub fn list(&mut self, dir_path: String, full_dir: AppResult<PathBuf>, known_stamp: Option<&str>) -> FolderListing {
        let answer = full_dir.and_then(|full_dir| self.list_folder(&full_dir, known_stamp));
        match answer {
            Ok((stamp, listing)) => {
                let unchanged = listing.is_none();
                let listing = listing.unwrap_or(DirListing {
                    entries: Vec::new(),
                    truncated: false,
                });
                FolderListing {
                    dir_path,
                    stamp,
                    unchanged,
                    entries: listing.entries,
                    truncated: listing.truncated,
                    error: None,
                }
            }
            Err(err) => FolderListing {
                dir_path,
                stamp: String::new(),
                unchanged: false,
                entries: Vec::new(),
                truncated: false,
                error: Some(err.to_string()),
            },
        }
    }

    /// The stamp is taken before the read: a change in between shows up as a change next time.
    fn list_folder(&mut self, full_dir: &Path, known_stamp: Option<&str>) -> AppResult<(String, Option<DirListing>)> {
        let meta = std::fs::metadata(full_dir)?;
        if !meta.is_dir() {
            return Err(AppError::invalid(format!("Not a folder: {}", full_dir.display())));
        }
        let stamp = self.stamp(full_dir, &meta);
        if known_stamp == Some(stamp.as_str()) {
            return Ok((stamp, None));
        }
        let (candidates, total) = sorted_candidates(full_dir, MAX_ENTRIES)?;
        let repo_roots = self.repo_roots;
        let owner = match deepest_repo_index(repo_roots, full_dir) {
            Some(index) => self
                .owner(index)
                .map(|owner| (&owner.repo, repo_roots[index].as_path())),
            None => None,
        };
        let listing = DirListing {
            entries: describe(full_dir, candidates, repo_roots, owner),
            truncated: total > MAX_ENTRIES,
        };
        Ok((stamp, Some(listing)))
    }
}

/// One state of a file on disk, without reading it: its size and modification time and, on
/// Unix, its inode and change time, so a rewrite of the same size within one clock tick or a
/// file renamed over it still counts as a change.
pub fn stat_version(meta: &std::fs::Metadata) -> String {
    let modified = meta
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default();
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        format!("{}-{modified}-{}-{}.{}", meta.len(), meta.ino(), meta.ctime(), meta.ctime_nsec())
    }
    #[cfg(not(unix))]
    {
        format!("{}-{modified}", meta.len())
    }
}

/// Reads a file for the editor. With the `known_version` the editor already has, an unchanged
/// file comes back with `unchanged` set and no text, so a refresh costs only a stat.
pub fn read_file(full_path: &Path, file_path: &str, known_version: Option<&str>) -> AppResult<FileContent> {
    // The version is taken before the read: a write in between shows up as a change next time.
    let meta = std::fs::metadata(full_path)?;
    let size = meta.len();
    let version = stat_version(&meta);
    let unchanged = known_version == Some(version.as_str());
    let mut file = FileContent {
        path: file_path.to_string(),
        content: String::new(),
        eol: Eol::Lf,
        binary: false,
        too_large: size > MAX_OPEN_BYTES,
        size,
        version,
        unchanged,
    };
    if file.too_large || unchanged {
        return Ok(file);
    }
    match bytes_to_text(std::fs::read(full_path)?) {
        Some(text) => {
            file.eol = Eol::detect(&text);
            file.content = into_lf(text);
        }
        None => file.binary = true,
    }
    Ok(file)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(listing: &DirListing) -> Vec<&str> {
        listing.entries.iter().map(|entry| entry.name.as_str()).collect()
    }

    fn folder_with(dirs: &[&str], files: &[&str]) -> tempfile::TempDir {
        let dir = tempfile::TempDir::new().unwrap();
        for name in dirs {
            std::fs::create_dir_all(dir.path().join(name)).unwrap();
        }
        for name in files {
            std::fs::write(dir.path().join(name), "x").unwrap();
        }
        dir
    }

    fn listing(dir: &tempfile::TempDir, limit: usize) -> DirListing {
        let (candidates, total) = sorted_candidates(dir.path(), limit).unwrap();
        DirListing {
            entries: describe(dir.path(), candidates, &[], None),
            truncated: total > limit,
        }
    }

    #[test]
    fn cut_off_listings_keep_the_first_entries_in_sorted_order() {
        let dir = folder_with(&["zeta", "Alpha", ".git"], &["b.txt", "A.txt", "c.txt"]);
        let cut = listing(&dir, 3);
        assert_eq!(names(&cut), vec!["Alpha", "zeta", "A.txt"]);
        assert!(cut.truncated);
        assert!(cut.entries[0].is_dir && !cut.entries[2].is_dir);

        let all = listing(&dir, 10);
        assert_eq!(names(&all), vec!["Alpha", "zeta", "A.txt", "b.txt", "c.txt"]);
        assert!(!all.truncated);
        // .git neither shows nor counts toward the limit.
        assert!(!listing(&dir, 5).truncated);
    }

    #[test]
    fn a_folder_past_the_limit_still_lists_its_folders_first() {
        let files: Vec<String> = (0..=MAX_ENTRIES).map(|index| format!("f{index:05}")).collect();
        let dir = folder_with(&["zz-folder"], &[]);
        for name in &files {
            std::fs::write(dir.path().join(name), "").unwrap();
        }
        let result = listing(&dir, MAX_ENTRIES);
        assert!(result.truncated);
        assert_eq!(result.entries.len(), MAX_ENTRIES);
        assert_eq!(result.entries[0].name, "zz-folder");
        assert_eq!(result.entries[1].name, "f00000");
        assert_eq!(result.entries[MAX_ENTRIES - 1].name, files[MAX_ENTRIES - 2]);
    }

    #[cfg(unix)]
    #[test]
    fn linked_folders_count_as_folders() {
        let dir = folder_with(&["target-dir"], &["a.txt"]);
        std::os::unix::fs::symlink(dir.path().join("target-dir"), dir.path().join("link")).unwrap();
        let result = listing(&dir, 10);
        assert_eq!(names(&result), vec!["link", "target-dir", "a.txt"]);
        assert!(result.entries[0].is_dir);
    }
}
