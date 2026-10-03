use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::Path;
use std::time::UNIX_EPOCH;

use git2::{BranchType, Oid, Repository};
use serde::Serialize;

use super::repo::short_id;
use crate::error::AppResult;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalBranch {
    pub name: String,
    pub is_head: bool,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub short_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBranch {
    /// Full short name, e.g. `origin/feature/x`.
    pub name: String,
    pub remote: String,
    /// Name without the remote prefix, e.g. `feature/x`.
    pub branch: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Refs {
    pub local: Vec<LocalBranch>,
    pub remote: Vec<RemoteBranch>,
    pub tags: Vec<String>,
    pub remotes: Vec<String>,
}

/// A ref's name, direct target and symbolic target, as the fingerprint hashes it.
type RefTarget = (Vec<u8>, Option<Oid>, Option<Vec<u8>>);

/// Modification time (ns) and size of a file, or None when it is missing.
fn file_stamp(path: &Path) -> Option<(u128, u64)> {
    let metadata = std::fs::metadata(path).ok()?;
    let modified = metadata.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_nanos();
    Some((modified, metadata.len()))
}

/// A fingerprint of everything the Branches sidebar reads for a repository:
/// every ref and HEAD (branches, ahead/behind, tags), the stash list, the
/// config (remotes, upstreams) and the linked work trees. The same
/// fingerprint means `read`, the stashes, the remotes and the work tree list
/// are unchanged, so a refresh after staging a file reads none of them.
pub fn fingerprint(repo: &Repository) -> String {
    let mut hasher = DefaultHasher::new();
    let mut targets: Vec<RefTarget> = Vec::new();
    if let Ok(references) = repo.references() {
        for reference in references.flatten() {
            let symbolic = reference.symbolic_target_bytes().map(<[u8]>::to_vec);
            targets.push((reference.name_bytes().to_vec(), reference.target(), symbolic));
        }
    }
    targets.sort_unstable_by(|left, right| left.0.cmp(&right.0));
    targets.hash(&mut hasher);
    if let Ok(head) = repo.find_reference("HEAD") {
        head.symbolic_target_bytes().hash(&mut hasher);
        head.target().hash(&mut hasher);
    }
    repo.head().ok().and_then(|head| head.target()).hash(&mut hasher);
    let common_dir = repo.commondir();
    // Dropping an older stash only rewrites the reflog that lists them.
    file_stamp(&common_dir.join("logs/refs/stash")).hash(&mut hasher);
    file_stamp(&common_dir.join("config")).hash(&mut hasher);
    file_stamp(&repo.path().join("config.worktree")).hash(&mut hasher);
    let mut admin_dirs: Vec<_> = std::fs::read_dir(common_dir.join("worktrees"))
        .map(|entries| entries.flatten().map(|entry| entry.path()).collect())
        .unwrap_or_default();
    admin_dirs.sort();
    for admin_dir in admin_dirs {
        admin_dir.hash(&mut hasher);
        for name in ["HEAD", "locked", "gitdir"] {
            std::fs::read(admin_dir.join(name)).ok().hash(&mut hasher);
        }
        // A deleted work tree folder makes the entry prunable.
        let gitdir = std::fs::read_to_string(admin_dir.join("gitdir")).unwrap_or_default();
        Path::new(gitdir.trim_end()).exists().hash(&mut hasher);
    }
    format!("{:016x}", hasher.finish())
}

pub fn read(repo: &Repository) -> AppResult<Refs> {
    let mut local = Vec::new();
    for branch in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = branch?;
        let Some(name) = branch.name()?.map(str::to_string) else {
            continue;
        };
        let target = branch.get().target();
        let mut upstream = None;
        let (mut ahead, mut behind) = (0, 0);
        if let Ok(upstream_branch) = branch.upstream() {
            upstream = upstream_branch.name().ok().flatten().map(str::to_string);
            if let (Some(local_oid), Some(remote_oid)) = (target, upstream_branch.get().target()) {
                if let Ok((a, b)) = repo.graph_ahead_behind(local_oid, remote_oid) {
                    ahead = a;
                    behind = b;
                }
            }
        }
        local.push(LocalBranch {
            is_head: branch.is_head(),
            name,
            upstream,
            ahead,
            behind,
            short_id: target.map(short_id),
        });
    }

    let remotes: Vec<String> = repo
        .remotes()?
        .iter()
        .filter_map(|name| name.ok().flatten())
        .map(str::to_string)
        .collect();

    let mut remote = Vec::new();
    for branch in repo.branches(Some(BranchType::Remote))? {
        let (branch, _) = branch?;
        let Some(name) = branch.name()?.map(str::to_string) else {
            continue;
        };
        if name.ends_with("/HEAD") {
            continue;
        }
        // Remote names may contain '/', so match against the configured list.
        let remote_name = remotes
            .iter()
            .filter(|remote_name| name.starts_with(&format!("{remote_name}/")))
            .max_by_key(|remote_name| remote_name.len())
            .cloned()
            .unwrap_or_else(|| name.split('/').next().unwrap_or_default().to_string());
        let short = name
            .strip_prefix(&format!("{remote_name}/"))
            .unwrap_or(&name)
            .to_string();
        remote.push(RemoteBranch {
            name,
            remote: remote_name,
            branch: short,
        });
    }

    let mut tags: Vec<String> = repo
        .tag_names(None)?
        .iter()
        .filter_map(|name| name.ok().flatten())
        .map(str::to_string)
        .collect();
    tags.sort();
    local.sort_by(|a, b| a.name.cmp(&b.name));
    remote.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(Refs {
        local,
        remote,
        tags,
        remotes,
    })
}
