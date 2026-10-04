use std::collections::HashMap;
use std::hash::{DefaultHasher, Hash, Hasher};

use git2::{Commit, DiffFindOptions, Delta, Oid, Repository, Sort};
use serde::Serialize;

use super::repo::{path_text, short_id};
use crate::error::AppResult;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RefKind {
    Head,
    Local,
    Remote,
    Tag,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefLabel {
    pub name: String,
    pub kind: RefKind,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitSummary {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    pub author_name: String,
    pub author_email: String,
    /// Seconds since the epoch.
    pub time: i64,
    pub parents: Vec<String>,
    pub refs: Vec<RefLabel>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    pub path: String,
    pub orig_path: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetails {
    pub id: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub author_time: i64,
    pub committer_name: String,
    pub committer_time: i64,
    pub parents: Vec<String>,
    pub files: Vec<ChangedFile>,
}

fn ref_labels(repo: &Repository) -> HashMap<Oid, Vec<RefLabel>> {
    let mut labels: HashMap<Oid, Vec<RefLabel>> = HashMap::new();
    let head_branch = repo
        .head()
        .ok()
        .filter(|head| head.is_branch())
        .and_then(|head| head.shorthand().ok().map(str::to_string));
    if let Ok(head) = repo.head() {
        if !head.is_branch() {
            if let Some(oid) = head.target() {
                labels.entry(oid).or_default().push(RefLabel {
                    name: "HEAD".to_string(),
                    kind: RefKind::Head,
                });
            }
        }
    }
    let Ok(references) = repo.references() else {
        return labels;
    };
    for reference in references.flatten() {
        let Ok(name) = reference.name() else {
            continue;
        };
        let (kind, short) = if let Some(short) = name.strip_prefix("refs/heads/") {
            let kind = if Some(short) == head_branch.as_deref() {
                RefKind::Head
            } else {
                RefKind::Local
            };
            (kind, short.to_string())
        } else if let Some(short) = name.strip_prefix("refs/remotes/") {
            if short.ends_with("/HEAD") {
                continue;
            }
            (RefKind::Remote, short.to_string())
        } else if let Some(short) = name.strip_prefix("refs/tags/") {
            (RefKind::Tag, short.to_string())
        } else {
            continue;
        };
        if let Ok(commit) = reference.peel_to_commit() {
            labels.entry(commit.id()).or_default().push(RefLabel { name: short, kind });
        }
    }
    labels
}

/// A fingerprint of everything a history walk and its labels depend on: HEAD
/// and every branch, remote branch and tag (commits never change). The same
/// fingerprint means the same log, so a reload can skip the walk.
pub fn tips(repo: &Repository, all_refs: bool) -> String {
    let mode = if all_refs { "all" } else { "head" };
    format!("{mode}:{}", tips_hash(repo))
}

/// `tips` for both walks: what the Log shows changes only when this does.
pub fn tips_hash(repo: &Repository) -> String {
    let mut hasher = DefaultHasher::new();
    if let Ok(head) = repo.find_reference("HEAD") {
        head.symbolic_target_bytes().hash(&mut hasher);
        head.target().hash(&mut hasher);
    }
    repo.head().ok().and_then(|head| head.target()).hash(&mut hasher);
    let mut targets: Vec<(Vec<u8>, Option<Oid>)> = Vec::new();
    if let Ok(references) = repo.references() {
        for reference in references.flatten() {
            let name = reference.name_bytes();
            let shown = [b"refs/heads/".as_slice(), b"refs/remotes/", b"refs/tags/"]
                .iter()
                .any(|prefix| name.starts_with(prefix));
            if shown {
                targets.push((name.to_vec(), reference.target()));
            }
        }
    }
    // Packing refs changes the iteration order, not the log.
    targets.sort_unstable_by(|left, right| left.0.cmp(&right.0));
    targets.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// One page of history in topological + date order. When `all_refs` is set,
/// every local and remote branch is included, like `git log HEAD --branches --remotes`.
/// Unlike `git log --all`, tags and stashes are not followed.
pub fn page(repo: &Repository, offset: usize, limit: usize, all_refs: bool) -> AppResult<Vec<CommitSummary>> {
    let mut walk = repo.revwalk()?;
    walk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;
    if repo.head().is_ok() {
        walk.push_head()?;
    }
    if all_refs {
        walk.push_glob("refs/heads")?;
        walk.push_glob("refs/remotes")?;
    }
    let mut labels = ref_labels(repo);
    let mut commits = Vec::with_capacity(limit);
    for oid in walk.skip(offset).take(limit) {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        commits.push(summarize(&commit, labels.remove(&oid).unwrap_or_default()));
    }
    Ok(commits)
}

pub fn summarize(commit: &Commit, refs: Vec<RefLabel>) -> CommitSummary {
    let author = commit.author();
    CommitSummary {
        id: commit.id().to_string(),
        short_id: short_id(commit.id()),
        summary: commit.summary().ok().flatten().unwrap_or_default().to_string(),
        author_name: author.name().unwrap_or_default().to_string(),
        author_email: author.email().unwrap_or_default().to_string(),
        time: author.when().seconds(),
        parents: commit.parent_ids().map(|parent| parent.to_string()).collect(),
        refs,
    }
}

/// `--format` of the CLI logs read by `parse_cli_commit`: fields split by 0x1f.
pub const CLI_COMMIT_FORMAT: &str = "%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s";

/// One commit header printed with `CLI_COMMIT_FORMAT`; None for anything else.
pub fn parse_cli_commit(header: &str) -> Option<CommitSummary> {
    let fields: Vec<&str> = header.trim_start_matches('\n').split('\u{1f}').collect();
    if fields.len() < 6 {
        return None;
    }
    let id = fields[0].trim();
    if id.len() < 4 || !id.chars().all(|character| character.is_ascii_hexdigit()) {
        return None;
    }
    Some(CommitSummary {
        id: id.to_string(),
        short_id: id[..8.min(id.len())].to_string(),
        summary: fields[5..].join("\u{1f}"),
        author_name: fields[2].to_string(),
        author_email: fields[3].to_string(),
        time: fields[4].trim().parse().unwrap_or_default(),
        parents: fields[1].split_whitespace().map(str::to_string).collect(),
        refs: Vec::new(),
    })
}

pub fn delta_status(delta: Delta) -> &'static str {
    match delta {
        Delta::Added => "added",
        Delta::Deleted => "deleted",
        Delta::Renamed => "renamed",
        Delta::Copied => "copied",
        Delta::Typechange => "typechange",
        _ => "modified",
    }
}

pub fn details(repo: &Repository, commit_id: &str) -> AppResult<CommitDetails> {
    let commit = repo.find_commit(Oid::from_str(commit_id)?)?;
    let tree = commit.tree()?;
    let parent_tree = commit.parent(0).ok().and_then(|parent| parent.tree().ok());
    let mut diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)?;
    diff.find_similar(Some(DiffFindOptions::new().renames(true)))?;

    let mut files = Vec::new();
    for delta in diff.deltas() {
        let new_path = delta.new_file().path_bytes().map(path_text);
        let old_path = delta.old_file().path_bytes().map(path_text);
        let path = new_path.clone().or_else(|| old_path.clone()).unwrap_or_default();
        let orig_path = if delta.status() == Delta::Renamed { old_path } else { None };
        files.push(ChangedFile {
            path,
            orig_path,
            status: delta_status(delta.status()).to_string(),
        });
    }

    let author = commit.author();
    let committer = commit.committer();
    Ok(CommitDetails {
        id: commit.id().to_string(),
        message: commit.message().unwrap_or_default().to_string(),
        author_name: author.name().unwrap_or_default().to_string(),
        author_email: author.email().unwrap_or_default().to_string(),
        author_time: author.when().seconds(),
        committer_name: committer.name().unwrap_or_default().to_string(),
        committer_time: committer.when().seconds(),
        parents: commit.parent_ids().map(|parent| parent.to_string()).collect(),
        files,
    })
}
