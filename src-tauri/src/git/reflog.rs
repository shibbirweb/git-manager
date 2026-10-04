//! Reads reflogs (where HEAD and each branch pointed before) with git2, names the action
//! behind each entry from git's message, and gathers what Undo needs to know about the
//! latest one.

use git2::{BranchType, Oid, Repository};
use serde::Serialize;

use super::repo::short_id;
use crate::error::{AppError, AppResult};

/// What moved the ref, read from the start of the reflog message.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ReflogAction {
    Commit,
    InitialCommit,
    Amend,
    Merge,
    Checkout,
    Reset,
    Rebase,
    Pull,
    CherryPick,
    Revert,
    Branch,
    Clone,
    Other,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReflogEntry {
    /// 0 is the newest: `HEAD@{0}`.
    pub index: usize,
    /// `HEAD@{3}`, `main@{0}`.
    pub selector: String,
    /// All zeros when the ref did not exist before.
    pub old_id: String,
    pub new_id: String,
    pub old_short_id: String,
    pub new_short_id: String,
    pub action: ReflogAction,
    /// The message without its action prefix ("moving from main to topic").
    pub detail: String,
    /// The whole message, as `git reflog` shows it.
    pub message: String,
    /// Seconds since the epoch.
    pub time: i64,
    pub committer_name: String,
    /// For a checkout: the branch or commit it moved away from.
    pub checkout_from: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReflogPage {
    pub ref_name: String,
    pub entries: Vec<ReflogEntry>,
    /// Entries in the whole reflog.
    pub total: usize,
}

/// The latest HEAD movement and what Undo needs around it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastAction {
    pub entry: Option<ReflogEntry>,
    /// The current branch, None when detached or unborn.
    pub branch: Option<String>,
    /// The entry's new commit is on a remote branch already: undoing it rewrites published history.
    pub pushed: bool,
    /// For a checkout: `checkout_from` names a local branch that still exists.
    pub from_branch_exists: bool,
}

/// `(action, detail)` for a reflog message such as "commit (amend): Fix the title".
pub fn classify(message: &str) -> (ReflogAction, String) {
    let (head, detail) = match message.split_once(": ") {
        Some((head, detail)) => (head, detail.to_string()),
        None => (message.trim_end_matches(':'), String::new()),
    };
    let head = head.trim();
    let action = if head == "commit" {
        ReflogAction::Commit
    } else if head == "commit (initial)" {
        ReflogAction::InitialCommit
    } else if head == "commit (amend)" {
        ReflogAction::Amend
    } else if head == "commit (merge)" {
        ReflogAction::Merge
    } else if head == "commit (cherry-pick)" || head == "cherry-pick" {
        ReflogAction::CherryPick
    } else if head == "revert" || head == "commit (revert)" {
        ReflogAction::Revert
    } else if head == "checkout" || head == "switch" {
        ReflogAction::Checkout
    } else if head == "reset" {
        ReflogAction::Reset
    } else if head.starts_with("pull") && head.contains("--rebase") {
        // `pull --rebase` writes rebase steps: undoing it is undoing a rebase.
        ReflogAction::Rebase
    } else if head.starts_with("pull") {
        ReflogAction::Pull
    } else if head.starts_with("merge") {
        ReflogAction::Merge
    } else if head.starts_with("rebase") {
        ReflogAction::Rebase
    } else if head == "branch" {
        ReflogAction::Branch
    } else if head == "clone" {
        ReflogAction::Clone
    } else {
        ReflogAction::Other
    };
    (action, detail)
}

/// "moving from main to topic" gives "main".
fn checkout_from(detail: &str) -> Option<String> {
    let rest = detail.strip_prefix("moving from ")?;
    let end = rest.rfind(" to ")?;
    let from = rest[..end].trim();
    (!from.is_empty()).then(|| from.to_string())
}

/// "HEAD", or a branch as `main` / `refs/heads/main`; other refs are refused.
fn full_ref_name(ref_name: &str) -> AppResult<String> {
    let name = ref_name.trim();
    if name.is_empty() || name == "HEAD" {
        return Ok("HEAD".to_string());
    }
    if name.starts_with('-') || name.contains("..") {
        return Err(AppError::invalid(format!("Not a branch: {name}")));
    }
    if name.starts_with("refs/") {
        return Ok(name.to_string());
    }
    Ok(format!("refs/heads/{name}"))
}

fn selector_name(full: &str) -> &str {
    full.strip_prefix("refs/heads/").unwrap_or(full)
}

fn entry_at(reflog: &git2::Reflog, index: usize, selector: &str) -> Option<ReflogEntry> {
    let entry = reflog.get(index)?;
    let message = String::from_utf8_lossy(entry.message_bytes().unwrap_or_default()).into_owned();
    let (action, detail) = classify(&message);
    let checkout = if action == ReflogAction::Checkout {
        checkout_from(&detail)
    } else {
        None
    };
    let committer = entry.committer();
    Some(ReflogEntry {
        index,
        selector: format!("{selector}@{{{index}}}"),
        old_id: entry.id_old().to_string(),
        new_id: entry.id_new().to_string(),
        old_short_id: short_id(entry.id_old()),
        new_short_id: short_id(entry.id_new()),
        action,
        detail,
        message,
        time: committer.when().seconds(),
        committer_name: committer.name().unwrap_or_default().to_string(),
        checkout_from: checkout,
    })
}

/// One page of a reflog, newest first. A ref without a reflog has an empty one.
pub fn read_page(repo: &Repository, ref_name: &str, offset: usize, limit: usize) -> AppResult<ReflogPage> {
    let full = full_ref_name(ref_name)?;
    let reflog = repo.reflog(&full)?;
    let total = reflog.len();
    let selector = selector_name(&full).to_string();
    let end = offset.saturating_add(limit).min(total);
    let entries = (offset.min(end)..end)
        .filter_map(|index| entry_at(&reflog, index, &selector))
        .collect();
    Ok(ReflogPage {
        ref_name: full,
        entries,
        total,
    })
}

/// True when `commit` is the tip of a remote branch or behind one.
pub fn is_on_remote(repo: &Repository, commit: Oid) -> bool {
    let Ok(branches) = repo.branches(Some(BranchType::Remote)) else {
        return false;
    };
    for (branch, _) in branches.flatten() {
        let Some(tip) = branch.get().target() else {
            continue;
        };
        if tip == commit || repo.graph_descendant_of(tip, commit).unwrap_or(false) {
            return true;
        }
    }
    false
}

pub fn last_action(repo: &Repository) -> AppResult<LastAction> {
    let head = repo.head().ok();
    let branch = head
        .as_ref()
        .filter(|head| head.is_branch())
        .and_then(|head| head.shorthand().ok().map(str::to_string));
    let reflog = repo.reflog("HEAD")?;
    let entry = entry_at(&reflog, 0, "HEAD");
    let pushed = entry
        .as_ref()
        .and_then(|entry| Oid::from_str(&entry.new_id).ok())
        .is_some_and(|oid| !oid.is_zero() && is_on_remote(repo, oid));
    let from_branch_exists = entry
        .as_ref()
        .and_then(|entry| entry.checkout_from.as_deref())
        .is_some_and(|name| repo.find_branch(name, BranchType::Local).is_ok());
    Ok(LastAction {
        entry,
        branch,
        pushed,
        from_branch_exists,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_the_messages_git_writes() {
        let cases = [
            ("commit: Add login", ReflogAction::Commit, "Add login"),
            ("commit (initial): First", ReflogAction::InitialCommit, "First"),
            ("commit (amend): Add login, fixed", ReflogAction::Amend, "Add login, fixed"),
            ("commit (merge): Merge branch 'x'", ReflogAction::Merge, "Merge branch 'x'"),
            ("checkout: moving from main to topic", ReflogAction::Checkout, "moving from main to topic"),
            ("reset: moving to HEAD~1", ReflogAction::Reset, "moving to HEAD~1"),
            ("merge topic: Fast-forward", ReflogAction::Merge, "Fast-forward"),
            ("pull: Fast-forward", ReflogAction::Pull, "Fast-forward"),
            ("pull --rebase (finish): returning to refs/heads/main", ReflogAction::Rebase, "returning to refs/heads/main"),
            ("rebase (finish): returning to refs/heads/topic", ReflogAction::Rebase, "returning to refs/heads/topic"),
            ("rebase -i (pick): Second", ReflogAction::Rebase, "Second"),
            ("cherry-pick: Port the fix", ReflogAction::CherryPick, "Port the fix"),
            ("revert: Revert \"Oops\"", ReflogAction::Revert, "Revert \"Oops\""),
            ("branch: Created from HEAD", ReflogAction::Branch, "Created from HEAD"),
            ("clone: from /tmp/remote.git", ReflogAction::Clone, "from /tmp/remote.git"),
            ("something else", ReflogAction::Other, ""),
        ];
        for (message, action, detail) in cases {
            assert_eq!(classify(message), (action, detail.to_string()), "{message}");
        }
    }

    #[test]
    fn reads_where_a_checkout_came_from() {
        assert_eq!(checkout_from("moving from main to topic"), Some("main".to_string()));
        assert_eq!(checkout_from("moving from feature/a to b to c"), Some("feature/a to b".to_string()));
        assert_eq!(checkout_from("moving to x"), None);
    }

    #[test]
    fn refuses_odd_ref_names() {
        assert_eq!(full_ref_name("").unwrap(), "HEAD");
        assert_eq!(full_ref_name("main").unwrap(), "refs/heads/main");
        assert_eq!(full_ref_name("refs/heads/a/b").unwrap(), "refs/heads/a/b");
        assert!(full_ref_name("--all").is_err());
        assert!(full_ref_name("a..b").is_err());
    }
}
