//! `git blame` for the editor and diff views. Uses the git CLI's porcelain
//! output: it is much faster than libgit2's blame on long histories, honours
//! `blame.ignoreRevsFile`, and `--contents -` blames the exact text on screen,
//! unsaved edits included.

use std::collections::HashMap;
use std::path::Path;

use serde::Serialize;

use super::cli;
use crate::error::AppResult;

const UNCOMMITTED: &str = "0000000000000000000000000000000000000000";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BlameCommit {
    pub id: String,
    pub short_id: String,
    pub author_name: String,
    pub author_email: String,
    /// Seconds since the epoch.
    pub author_time: i64,
    pub summary: String,
    /// Lines changed in the work tree or editor and not committed yet.
    pub uncommitted: bool,
}

#[derive(Debug, Clone, Serialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BlameInfo {
    pub commits: Vec<BlameCommit>,
    /// For every line (0-based), the index into `commits`.
    pub lines: Vec<u32>,
    /// For every line (0-based), its 0-based line number in the commit that
    /// last changed it, so a click can open that commit's diff on the same line.
    pub original_lines: Vec<u32>,
}

/// A line header: the commit, the line's number in that commit and its number
/// in the blamed text (both 1-based, as git prints them).
fn is_header(line: &str) -> Option<(&str, usize, usize)> {
    let mut parts = line.split(' ');
    let sha = parts.next()?;
    if sha.len() != 40 || !sha.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    let original_line = parts.next()?.parse::<usize>().ok()?;
    let final_line = parts.next()?.parse::<usize>().ok()?;
    Some((sha, original_line, final_line))
}

/// Parses `git blame --porcelain`. Commit details appear only the first time
/// a commit is seen; every content line has its own header with the final
/// line number.
pub fn parse_porcelain(text: &str) -> BlameInfo {
    let mut info = BlameInfo::default();
    let mut index_of: HashMap<String, usize> = HashMap::new();
    let mut current: Option<usize> = None;
    let mut assignments: Vec<(usize, u32, usize)> = Vec::new();
    let mut pending_line: Option<(usize, usize)> = None;

    for line in text.split('\n') {
        if line.starts_with('\t') {
            if let (Some(commit), Some((original_line, final_line))) = (current, pending_line.take()) {
                assignments.push((final_line, commit as u32, original_line));
            }
            continue;
        }
        if let Some((sha, original_line, final_line)) = is_header(line) {
            let commit = *index_of.entry(sha.to_string()).or_insert_with(|| {
                let uncommitted = sha == UNCOMMITTED;
                info.commits.push(BlameCommit {
                    id: sha.to_string(),
                    short_id: sha[..8].to_string(),
                    author_name: String::new(),
                    author_email: String::new(),
                    author_time: 0,
                    summary: String::new(),
                    uncommitted,
                });
                info.commits.len() - 1
            });
            current = Some(commit);
            pending_line = Some((original_line, final_line));
            continue;
        }
        let Some(commit) = current else {
            continue;
        };
        let entry = &mut info.commits[commit];
        if let Some(value) = line.strip_prefix("author ") {
            entry.author_name = value.to_string();
        } else if let Some(value) = line.strip_prefix("author-mail ") {
            entry.author_email = value.trim_start_matches('<').trim_end_matches('>').to_string();
        } else if let Some(value) = line.strip_prefix("author-time ") {
            entry.author_time = value.parse().unwrap_or(0);
        } else if let Some(value) = line.strip_prefix("summary ") {
            entry.summary = value.to_string();
        }
    }

    let line_count = assignments.iter().map(|(final_line, _, _)| *final_line).max().unwrap_or(0);
    info.lines = vec![0; line_count];
    info.original_lines = vec![0; line_count];
    for (final_line, commit, original_line) in assignments {
        if final_line >= 1 {
            info.lines[final_line - 1] = commit;
            info.original_lines[final_line - 1] = original_line.saturating_sub(1) as u32;
        }
    }
    info
}

/// Blames `file_path` at `revision` (a commit), or the work tree when None.
/// `contents` replaces the file text, e.g. an editor buffer or the index version.
pub fn blame(repo_path: &Path, file_path: &str, revision: Option<&str>, contents: Option<&str>) -> AppResult<BlameInfo> {
    let mut args = vec!["blame", "--porcelain"];
    if contents.is_some() {
        args.extend(["--contents", "-"]);
    }
    if let Some(revision) = revision {
        args.push(revision);
    }
    args.extend(["--", file_path]);
    let output = match contents {
        Some(text) => cli::run_with_stdin(repo_path, &args, text.as_bytes())?,
        None => cli::run(repo_path, &args)?,
    };
    Ok(parse_porcelain(&output.stdout))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::*;

    #[test]
    fn parses_porcelain_with_repeated_commits() {
        let a = "a".repeat(40);
        let b = "b".repeat(40);
        let text = format!(
            "{a} 1 1 2\nauthor Ada\nauthor-mail <ada@example.com>\nauthor-time 100\nsummary First\nfilename f\n\tone\n\
             {a} 2 2\n\ttwo\n\
             {b} 1 3 1\nauthor Bob\nauthor-mail <bob@example.com>\nauthor-time 200\nsummary Second\nfilename f\n\tthree\n"
        );
        let info = parse_porcelain(&text);
        assert_eq!(info.lines, vec![0, 0, 1]);
        // The third line is line 1 of commit b.
        assert_eq!(info.original_lines, vec![0, 1, 0]);
        assert_eq!(info.commits[0].author_name, "Ada");
        assert_eq!(info.commits[0].author_email, "ada@example.com");
        assert_eq!(info.commits[1].summary, "Second");
        assert_eq!(info.commits[1].author_time, 200);
        assert_eq!(info.commits[1].short_id, "bbbbbbbb");
        assert!(!info.commits[0].uncommitted);
    }

    #[test]
    fn blames_committed_lines_and_unsaved_edits() {
        let repo = TestRepo::new();
        repo.write("notes.txt", "alpha\nbeta\n");
        repo.commit_all("Add notes");
        repo.write("notes.txt", "alpha\nbeta\ngamma\n");
        repo.commit_all("Add gamma");

        let path = std::path::Path::new(&repo.path_string()).to_path_buf();
        let committed = blame(&path, "notes.txt", None, None).unwrap();
        assert_eq!(committed.lines.len(), 3);
        let summaries: Vec<&str> = committed
            .lines
            .iter()
            .map(|index| committed.commits[*index as usize].summary.as_str())
            .collect();
        assert_eq!(summaries, vec!["Add notes", "Add notes", "Add gamma"]);

        // An editor buffer with a new first line and an edited last line.
        let edited = blame(&path, "notes.txt", None, Some("new\nalpha\nbeta\nGAMMA\n")).unwrap();
        let uncommitted: Vec<bool> = edited
            .lines
            .iter()
            .map(|index| edited.commits[*index as usize].uncommitted)
            .collect();
        assert_eq!(uncommitted, vec![true, false, false, true]);
    }

    #[test]
    fn blames_a_file_at_an_older_revision() {
        let repo = TestRepo::new();
        repo.write("f.txt", "one\n");
        let first = repo.commit_all("First");
        repo.write("f.txt", "one\ntwo\n");
        repo.commit_all("Second");

        let path = std::path::Path::new(&repo.path_string()).to_path_buf();
        let old = blame(&path, "f.txt", Some(&first), None).unwrap();
        assert_eq!(old.lines.len(), 1);
        assert_eq!(old.commits[old.lines[0] as usize].id, first);
    }

    #[test]
    fn untracked_files_are_an_error() {
        let repo = TestRepo::new();
        repo.write("tracked.txt", "x\n");
        repo.commit_all("Base");
        repo.write("new.txt", "y\n");
        let path = std::path::Path::new(&repo.path_string()).to_path_buf();
        assert!(blame(&path, "new.txt", None, None).is_err());
    }
}
