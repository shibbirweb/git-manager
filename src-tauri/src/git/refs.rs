use git2::{BranchType, Repository};
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
