//! Commit messages for the commit box: the current user's recent messages (its history
//! dropdown) and the `commit.template` file.

use std::io::Read;
use std::path::{Path, PathBuf};

use git2::Sort;
use serde::Serialize;

use crate::error::AppResult;
use crate::git::repo as git_repo;

/// Commits looked at for the history, newest first; enough for a busy month.
const SCAN_LIMIT: usize = 400;
/// A template larger than this is not a commit message template.
const MAX_TEMPLATE_BYTES: u64 = 64 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentMessage {
    pub message: String,
    /// Commit time in milliseconds since the epoch.
    pub time: i64,
}

/// Messages of the last commits from HEAD whose author email is the configured
/// user.email (any case), newest first, without merges and repeats.
pub fn recent_messages(repo_path: &str, limit: usize) -> AppResult<Vec<RecentMessage>> {
    let repo = git_repo::open(repo_path)?;
    let email = repo
        .config()
        .and_then(|mut config| config.snapshot())
        .ok()
        .and_then(|config| config.get_string("user.email").ok())
        .map(|email| email.trim().to_lowercase())
        .unwrap_or_default();
    if email.is_empty() || limit == 0 {
        return Ok(Vec::new());
    }
    let mut walk = repo.revwalk()?;
    if walk.push_head().is_err() {
        // No commits yet.
        return Ok(Vec::new());
    }
    walk.set_sorting(Sort::TIME)?;
    let mut messages: Vec<RecentMessage> = Vec::new();
    for commit_id in walk.take(SCAN_LIMIT) {
        let Ok(commit) = commit_id.and_then(|commit_id| repo.find_commit(commit_id)) else {
            continue;
        };
        if commit.parent_count() > 1 {
            continue;
        }
        let author = commit.author();
        let same_author = author.email().is_ok_and(|author_email| author_email.trim().to_lowercase() == email);
        if !same_author {
            continue;
        }
        let message = String::from_utf8_lossy(commit.message_bytes()).trim_end().to_string();
        if message.is_empty() || messages.iter().any(|seen| seen.message == message) {
            continue;
        }
        messages.push(RecentMessage {
            message,
            time: commit.time().seconds() * 1000,
        });
        if messages.len() >= limit {
            break;
        }
    }
    Ok(messages)
}

/// `commit.template` resolved like git: `~/` is the home folder, a relative path is taken
/// from the top of the work tree (where the app runs git).
fn template_path(repo_path: &str) -> AppResult<Option<PathBuf>> {
    let repo = git_repo::open(repo_path)?;
    let config = repo.config()?.snapshot()?;
    let Ok(raw) = config.get_string("commit.template") else {
        return Ok(None);
    };
    let raw = raw.trim();
    if raw.is_empty() {
        return Ok(None);
    }
    let path = if let Some(rest) = raw.strip_prefix("~/") {
        match std::env::var_os("HOME").filter(|home| !home.is_empty()) {
            Some(home) => PathBuf::from(home).join(rest),
            None => return Ok(None),
        }
    } else {
        let path = PathBuf::from(raw);
        if path.is_absolute() {
            path
        } else {
            repo.workdir().map(Path::to_path_buf).unwrap_or_default().join(path)
        }
    };
    Ok(Some(path))
}

/// The text of the `commit.template` file, or None when it is not set or cannot be read.
pub fn commit_template(repo_path: &str) -> AppResult<Option<String>> {
    let Some(path) = template_path(repo_path)? else {
        return Ok(None);
    };
    let Ok(file) = std::fs::File::open(&path) else {
        return Ok(None);
    };
    let mut bytes = Vec::new();
    if file.take(MAX_TEMPLATE_BYTES + 1).read_to_end(&mut bytes).is_err() || bytes.len() as u64 > MAX_TEMPLATE_BYTES {
        return Ok(None);
    }
    Ok(Some(String::from_utf8_lossy(&bytes).into_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::TestRepo;

    #[test]
    fn lists_only_the_users_own_messages_newest_first() {
        let repo = TestRepo::new();
        repo.write("a.txt", "1\n");
        repo.commit_all("first\n\nwith a body");
        repo.write("a.txt", "2\n");
        repo.git(&["add", "-A"]);
        repo.git(&["-c", "user.email=other@example.com", "commit", "-q", "-m", "someone else"]);
        repo.write("a.txt", "3\n");
        repo.commit_all("second");
        repo.write("a.txt", "4\n");
        repo.commit_all("second");
        let messages = recent_messages(&repo.path_string(), 30).unwrap();
        let texts: Vec<&str> = messages.iter().map(|entry| entry.message.as_str()).collect();
        assert_eq!(texts, ["second", "first\n\nwith a body"]);
        assert!(messages[0].time >= messages[1].time);
        assert!(messages[0].time > 1_000_000_000_000, "milliseconds");
        assert_eq!(recent_messages(&repo.path_string(), 1).unwrap().len(), 1);
    }

    #[test]
    fn matches_the_email_in_any_case_and_skips_merges() {
        let repo = TestRepo::new();
        repo.write("a.txt", "base\n");
        repo.commit_all("base");
        repo.branch("side");
        repo.write("b.txt", "main\n");
        repo.commit_all("on main");
        repo.checkout("side");
        repo.write("c.txt", "side\n");
        repo.commit_all("on side");
        repo.checkout("main");
        repo.git(&["merge", "--no-ff", "-q", "-m", "Merge side", "side"]);
        repo.git(&["config", "user.email", "TEST@Example.com"]);
        let messages = recent_messages(&repo.path_string(), 30).unwrap();
        let texts: Vec<&str> = messages.iter().map(|entry| entry.message.as_str()).collect();
        assert!(!texts.contains(&"Merge side"), "{texts:?}");
        assert_eq!(texts.len(), 3, "{texts:?}");
    }

    #[test]
    fn an_empty_repository_or_no_email_has_no_history() {
        let repo = TestRepo::new();
        assert!(recent_messages(&repo.path_string(), 30).unwrap().is_empty());
        repo.write("a.txt", "1\n");
        repo.commit_all("one");
        repo.git(&["config", "--unset", "user.email"]);
        assert!(recent_messages(&repo.path_string(), 30).unwrap().is_empty());
    }

    #[test]
    fn reads_the_commit_template_relative_to_the_work_tree() {
        let repo = TestRepo::new();
        assert_eq!(commit_template(&repo.path_string()).unwrap(), None);
        repo.write(".gitmessage", "feat: \n\n# Why?\n");
        repo.git(&["config", "commit.template", ".gitmessage"]);
        assert_eq!(commit_template(&repo.path_string()).unwrap().as_deref(), Some("feat: \n\n# Why?\n"));
        let absolute = repo.file("abs.txt");
        std::fs::write(&absolute, "abs").unwrap();
        repo.git(&["config", "commit.template", &absolute.to_string_lossy()]);
        assert_eq!(commit_template(&repo.path_string()).unwrap().as_deref(), Some("abs"));
        repo.git(&["config", "commit.template", "missing.txt"]);
        assert_eq!(commit_template(&repo.path_string()).unwrap(), None, "a missing file is no template");
    }
}
