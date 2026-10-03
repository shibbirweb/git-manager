//! Reads a `git bisect` in progress from the files and refs git keeps for it:
//! BISECT_START (where `git bisect reset` returns), BISECT_TERMS (custom words for
//! bad and good), BISECT_LOG (every mark, and the result once git names it) and
//! refs/bisect/* (the bad commit, each good one and each skipped one). Writes go
//! through `git bisect` (commands/bisect.rs).

use std::collections::HashSet;
use std::hash::{DefaultHasher, Hash, Hasher};

use git2::{Oid, Repository, Sort};
use serde::Serialize;

use super::repo::{read_git_file, short_id};
use crate::error::AppResult;

/// Commits walked at most to count what is left to test; more is reported as "many".
const WALK_LIMIT: usize = 200_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BisectCommit {
    pub id: String,
    pub short_id: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BisectState {
    /// Branch or commit `git bisect reset` goes back to.
    pub start: String,
    /// "bad" unless the bisect was started with `--term-bad` / `--term-new`.
    pub bad_term: String,
    pub good_term: String,
    pub bad: Option<String>,
    pub good: Vec<String>,
    pub skipped: Vec<String>,
    /// The commit checked out now.
    pub current: Option<String>,
    /// Commits that may still be the first bad one (the bad commit included).
    pub remaining: usize,
    /// True when counting stopped at the walk limit.
    pub remaining_capped: bool,
    /// Git's own estimate of the steps left.
    pub steps: usize,
    /// Set once git has named the first bad commit.
    pub first_bad: Option<BisectCommit>,
}

/// True while a bisect is in progress in this work tree.
pub fn is_active(repo: &Repository) -> bool {
    repo.path().join("BISECT_START").exists()
}

/// Changes on every mark, so a status holding it changes too.
pub fn fingerprint(repo: &Repository) -> Option<String> {
    if !is_active(repo) {
        return None;
    }
    let log = std::fs::read(repo.path().join("BISECT_LOG")).unwrap_or_default();
    let mut hasher = DefaultHasher::new();
    log.hash(&mut hasher);
    Some(format!("{:016x}", hasher.finish()))
}

/// Git's estimate_bisect_steps(): about log2 of the commits left.
pub fn estimate_steps(all: usize) -> usize {
    if all < 3 {
        return 0;
    }
    let n = usize::BITS - 1 - all.leading_zeros();
    let e = 1usize << n;
    let x = all - e;
    if e < 3 * x {
        n as usize
    } else {
        n as usize - 1
    }
}

fn commit_info(repo: &Repository, oid: Oid) -> BisectCommit {
    let summary = repo
        .find_commit(oid)
        .ok()
        .and_then(|commit| commit.summary().ok().flatten().map(str::to_string))
        .unwrap_or_default();
    BisectCommit {
        id: oid.to_string(),
        short_id: short_id(oid),
        summary,
    }
}

/// The commit in the last "# first bad commit: [<id>] subject" line of BISECT_LOG.
fn first_bad_in_log(log: &str, bad_term: &str) -> Option<Oid> {
    let marker = format!("# first {bad_term} commit: [");
    log.lines().rev().find_map(|line| {
        let rest = line.strip_prefix(&marker)?;
        let end = rest.find(']')?;
        Oid::from_str(&rest[..end]).ok()
    })
}

fn terms(repo: &Repository) -> (String, String) {
    let text = read_git_file(repo, "BISECT_TERMS").unwrap_or_default();
    let mut lines = text.lines().map(str::trim).filter(|line| !line.is_empty());
    let bad = lines.next().unwrap_or("bad").to_string();
    let good = lines.next().unwrap_or("good").to_string();
    (bad, good)
}

/// (bad, goods, skipped) from refs/bisect/*.
fn marked(repo: &Repository, bad_term: &str, good_term: &str) -> (Option<Oid>, Vec<Oid>, Vec<Oid>) {
    let mut bad = None;
    let mut good = Vec::new();
    let mut skipped = Vec::new();
    let bad_ref = format!("refs/bisect/{bad_term}");
    let good_prefix = format!("refs/bisect/{good_term}-");
    let Ok(references) = repo.references_glob("refs/bisect/*") else {
        return (bad, good, skipped);
    };
    for reference in references.flatten() {
        let Ok(name) = reference.name() else {
            continue;
        };
        let Some(target) = reference.target() else {
            continue;
        };
        if name == bad_ref {
            bad = Some(target);
        } else if name.starts_with(&good_prefix) {
            good.push(target);
        } else if name.starts_with("refs/bisect/skip-") {
            skipped.push(target);
        }
    }
    (bad, good, skipped)
}

/// Commits reachable from `bad` and from no good one, skipped ones left out.
fn count_candidates(repo: &Repository, bad: Oid, good: &[Oid], skipped: &[Oid]) -> AppResult<(usize, bool)> {
    let mut walk = repo.revwalk()?;
    walk.set_sorting(Sort::NONE)?;
    walk.push(bad)?;
    for oid in good {
        walk.hide(*oid)?;
    }
    let skipped: HashSet<Oid> = skipped.iter().copied().collect();
    let mut count = 0;
    for oid in walk {
        let oid = oid?;
        if skipped.contains(&oid) {
            continue;
        }
        count += 1;
        if count >= WALK_LIMIT {
            return Ok((count, true));
        }
    }
    Ok((count, false))
}

/// The bisect in progress, or None.
pub fn read(repo: &Repository) -> AppResult<Option<BisectState>> {
    if !is_active(repo) {
        return Ok(None);
    }
    let start = read_git_file(repo, "BISECT_START").unwrap_or_default();
    let (bad_term, good_term) = terms(repo);
    let (bad, good, skipped) = marked(repo, &bad_term, &good_term);
    let current = repo.head().ok().and_then(|head| head.target());
    let log = std::fs::read_to_string(repo.path().join("BISECT_LOG")).unwrap_or_default();
    let first_bad = first_bad_in_log(&log, &bad_term)
        .filter(|oid| Some(*oid) == bad)
        .map(|oid| commit_info(repo, oid));
    let (remaining, remaining_capped) = match (bad, good.is_empty(), &first_bad) {
        (Some(_), _, Some(_)) => (1, false),
        (Some(bad), false, None) => count_candidates(repo, bad, &good, &skipped)?,
        _ => (0, false),
    };
    Ok(Some(BisectState {
        start,
        bad_term,
        good_term,
        bad: bad.map(|oid| oid.to_string()),
        good: good.iter().map(Oid::to_string).collect(),
        skipped: skipped.iter().map(Oid::to_string).collect(),
        current: current.map(|oid| oid.to_string()),
        remaining,
        remaining_capped,
        steps: estimate_steps(remaining),
        first_bad,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn estimates_steps_like_git() {
        // Values from git's estimate_bisect_steps() table.
        let cases = [(0, 0), (1, 0), (2, 0), (3, 1), (4, 1), (5, 1), (6, 2), (7, 2), (8, 2), (9, 2), (11, 3), (16, 3), (100, 6), (1024, 9), (1500, 10)];
        for (all, steps) in cases {
            assert_eq!(estimate_steps(all), steps, "{all} commits");
        }
    }

    #[test]
    fn finds_the_first_bad_commit_in_the_log() {
        let id = "0123456789abcdef0123456789abcdef01234567";
        let log = format!("git bisect start\n# bad: [{id}] Break\ngit bisect bad {id}\n# first bad commit: [{id}] Break\n");
        assert_eq!(first_bad_in_log(&log, "bad"), Some(Oid::from_str(id).unwrap()));
        assert_eq!(first_bad_in_log(&log, "new"), None);
        assert_eq!(first_bad_in_log("git bisect start\n", "bad"), None);
    }
}
