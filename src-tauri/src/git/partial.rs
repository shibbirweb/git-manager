//! Line staging: the text a file gets when only the selected lines of its diff are
//! staged, unstaged or discarded, and the unified patch that makes that change.
//!
//! Lines are addressed like the diff view shows them: the LF-normalized text split on
//! `\n` (see `line_diff`), so a selection made on screen names the same lines here. The
//! texts themselves keep their own line endings: every kept line keeps its bytes.

use serde::Deserialize;

use crate::merge::line_diff::hunks;
use crate::merge::model::Eol;

/// Unchanged lines around each change in a patch, like `git diff`.
const PATCH_CONTEXT: usize = 3;

/// The lines picked in a diff: half-open 0-based ranges of the old (left) and new (right) side.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineSelection {
    #[serde(default)]
    pub old_lines: Vec<[u32; 2]>,
    #[serde(default)]
    pub new_lines: Vec<[u32; 2]>,
}

fn picked(ranges: &[[u32; 2]], line: usize) -> bool {
    let line = line as u32;
    ranges.iter().any(|[start, end]| line >= *start && line < *end)
}

/// One side of the diff as the view sees it: the lines without their ending, and the
/// ending that followed each one in the file ("" after the last).
struct SideLines<'a> {
    lines: Vec<&'a str>,
    endings: Vec<&'static str>,
    crlf: bool,
}

impl<'a> SideLines<'a> {
    fn new(text: &'a str) -> SideLines<'a> {
        let raw: Vec<&str> = text.split('\n').collect();
        let last = raw.len() - 1;
        let mut lines = Vec::with_capacity(raw.len());
        let mut endings = Vec::with_capacity(raw.len());
        for (index, line) in raw.into_iter().enumerate() {
            if index == last {
                lines.push(line);
                endings.push("");
            } else if let Some(stripped) = line.strip_suffix('\r') {
                lines.push(stripped);
                endings.push("\r\n");
            } else {
                lines.push(line);
                endings.push("\n");
            }
        }
        SideLines {
            lines,
            endings,
            crlf: Eol::detect(text) == Eol::Crlf,
        }
    }

    fn is_last(&self, index: usize) -> bool {
        index + 1 == self.lines.len()
    }
}

/// The patched file after the selected changes, and how many changed lines they hold.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PartialText {
    pub text: String,
    pub changed_lines: usize,
}

/// The text `patched` becomes when the selected changes between `old` and `new` move it
/// toward the other side. `patched_is_old` is true for staging (the index takes lines of
/// the work tree) and false for unstaging and discarding (the newer side gives lines back).
///
/// Within a hunk, the patched side's lines are walked beside the other side's by offset,
/// so a selected replacement takes the place of the line it replaces. Lines copied in
/// take the patched file's line ending when the two sides use different ones.
pub fn partial_text<'t>(old: &'t str, new: &'t str, selection: &LineSelection, patched_is_old: bool) -> PartialText {
    let (old_side, new_side) = (SideLines::new(old), SideLines::new(new));
    let changes = hunks(&old_side.lines, &new_side.lines);
    let (patched, other) = if patched_is_old { (&old_side, &new_side) } else { (&new_side, &old_side) };
    let (patched_picks, other_picks) = if patched_is_old {
        (&selection.old_lines, &selection.new_lines)
    } else {
        (&selection.new_lines, &selection.old_lines)
    };
    let patched_text = if patched_is_old { old } else { new };
    // A side without text has no line ending of its own: follow the other one.
    let crlf = if patched_text.is_empty() { other.crlf } else { patched.crlf };
    let same_endings = patched_text.is_empty() || patched.crlf == other.crlf;

    // Each line with the ending it keeps, or None to take the file's ending.
    let mut out: Vec<(&'t str, Option<&'static str>)> = Vec::with_capacity(patched.lines.len());
    let keep = |out: &mut Vec<(&'t str, Option<&'static str>)>, index: usize| {
        let ending = if patched.is_last(index) { None } else { Some(patched.endings[index]) };
        out.push((patched.lines[index], ending));
    };
    let mut changed_lines = 0;
    let mut position = 0usize;
    for hunk in &changes {
        let (mine, theirs) = if patched_is_old {
            (hunk.before.start as usize..hunk.before.end as usize, hunk.after.start as usize..hunk.after.end as usize)
        } else {
            (hunk.after.start as usize..hunk.after.end as usize, hunk.before.start as usize..hunk.before.end as usize)
        };
        for index in position..mine.start {
            keep(&mut out, index);
        }
        let width = mine.len().max(theirs.len());
        for offset in 0..width {
            let index = mine.start + offset;
            if index < mine.end {
                if picked(patched_picks, index) {
                    changed_lines += 1;
                } else {
                    keep(&mut out, index);
                }
            }
            let index = theirs.start + offset;
            if index < theirs.end && picked(other_picks, index) {
                changed_lines += 1;
                let ending = if same_endings && !other.is_last(index) { Some(other.endings[index]) } else { None };
                out.push((other.lines[index], ending));
            }
        }
        position = mine.end;
    }
    for index in position..patched.lines.len() {
        keep(&mut out, index);
    }

    let fallback = if crlf { "\r\n" } else { "\n" };
    let mut text = String::with_capacity(patched_text.len() + 64);
    let last = out.len().saturating_sub(1);
    for (index, (line, ending)) in out.into_iter().enumerate() {
        text.push_str(line);
        if index < last {
            text.push_str(ending.unwrap_or(fallback));
        }
    }
    PartialText { text, changed_lines }
}

/// A path as a patch header names it: C-quoted like git when it holds characters a
/// header cannot carry as they are.
fn header_path(prefix: &str, path: &str) -> String {
    let plain = format!("{prefix}{path}");
    if !path.chars().any(|character| character == '"' || character == '\\' || character.is_control()) {
        return plain;
    }
    let mut quoted = String::from("\"");
    for character in plain.chars() {
        match character {
            '"' => quoted.push_str("\\\""),
            '\\' => quoted.push_str("\\\\"),
            '\n' => quoted.push_str("\\n"),
            '\t' => quoted.push_str("\\t"),
            '\r' => quoted.push_str("\\r"),
            other if other.is_control() => {
                let mut buffer = [0u8; 4];
                for byte in other.encode_utf8(&mut buffer).bytes() {
                    quoted.push_str(&format!("\\{byte:03o}"));
                }
            }
            other => quoted.push(other),
        }
    }
    quoted.push('"');
    quoted
}

/// `--- a/name` / `+++ b/name` line ends; git adds a tab after a name with a space.
fn name_line(marker: &str, name: &str) -> String {
    let tab = if name.contains(' ') && !name.starts_with('"') { "\t" } else { "" };
    format!("{marker} {name}{tab}\n")
}

fn push_line(patch: &mut String, marker: char, line: &str) {
    patch.push(marker);
    patch.push_str(line);
    if !line.ends_with('\n') {
        patch.push_str("\n\\ No newline at end of file\n");
    }
}

/// A unified patch for one file from `before` to `after`. `before` None writes a new file
/// patch (from /dev/null) with `new_mode`, applied with `--cached` to add the file.
pub fn unified_patch(path: &str, before: Option<&str>, after: &str, new_mode: u32) -> String {
    let before_lines: Vec<&str> = before.unwrap_or("").split_inclusive('\n').collect();
    let after_lines: Vec<&str> = after.split_inclusive('\n').collect();
    let mut patch = format!("diff --git {} {}\n", header_path("a/", path), header_path("b/", path));
    match before {
        None => {
            patch.push_str(&format!("new file mode {new_mode:o}\n"));
            patch.push_str("--- /dev/null\n");
        }
        Some(_) => patch.push_str(&name_line("---", &header_path("a/", path))),
    }
    patch.push_str(&name_line("+++", &header_path("b/", path)));

    let changes = hunks(&before_lines, &after_lines);
    let mut group_start = 0;
    while group_start < changes.len() {
        // Hunks whose context would touch go in one block, like git does.
        let mut group_end = group_start + 1;
        while group_end < changes.len()
            && changes[group_end].before.start as usize - changes[group_end - 1].before.end as usize <= 2 * PATCH_CONTEXT
        {
            group_end += 1;
        }
        let (first, last) = (&changes[group_start], &changes[group_end - 1]);
        let lead = (first.before.start as usize).min(PATCH_CONTEXT);
        let trail = (before_lines.len() - last.before.end as usize).min(PATCH_CONTEXT);
        let before_start = first.before.start as usize - lead;
        let before_end = last.before.end as usize + trail;
        let after_start = first.after.start as usize - lead;
        let after_end = last.after.end as usize + trail;
        let range = |start: usize, end: usize| {
            let count = end - start;
            // An empty range names the line before it, like `@@ -0,0 +1,2 @@`.
            format!("{},{count}", if count == 0 { start } else { start + 1 })
        };
        patch.push_str(&format!(
            "@@ -{} +{} @@\n",
            range(before_start, before_end),
            range(after_start, after_end)
        ));
        let mut position = before_start;
        for hunk in &changes[group_start..group_end] {
            for line in &before_lines[position..hunk.before.start as usize] {
                push_line(&mut patch, ' ', line);
            }
            for line in &before_lines[hunk.before.start as usize..hunk.before.end as usize] {
                push_line(&mut patch, '-', line);
            }
            for line in &after_lines[hunk.after.start as usize..hunk.after.end as usize] {
                push_line(&mut patch, '+', line);
            }
            position = hunk.before.end as usize;
        }
        for line in &before_lines[position..before_end] {
            push_line(&mut patch, ' ', line);
        }
        group_start = group_end;
    }
    patch
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines(old: &[[u32; 2]], new: &[[u32; 2]]) -> LineSelection {
        LineSelection {
            old_lines: old.to_vec(),
            new_lines: new.to_vec(),
        }
    }

    fn stage(old: &str, new: &str, selection: &LineSelection) -> String {
        partial_text(old, new, selection, true).text
    }

    fn give_back(old: &str, new: &str, selection: &LineSelection) -> String {
        partial_text(old, new, selection, false).text
    }

    #[test]
    fn staging_takes_only_the_selected_added_and_removed_lines() {
        let old = "a\nb\nc\nd\n";
        let new = "a\nB\nc\nD\ne\n";
        // Only the second change: d -> D.
        assert_eq!(stage(old, new, &lines(&[[3, 4]], &[[3, 4]])), "a\nb\nc\nD\n");
        // Only the added line at the end.
        assert_eq!(stage(old, new, &lines(&[], &[[4, 5]])), "a\nb\nc\nd\ne\n");
        // A removed line without its replacement.
        assert_eq!(stage(old, new, &lines(&[[1, 2]], &[])), "a\nc\nd\n");
        // Everything.
        assert_eq!(stage(old, new, &lines(&[[0, 9]], &[[0, 9]])), new);
        assert_eq!(partial_text(old, new, &lines(&[], &[]), true).changed_lines, 0);
    }

    #[test]
    fn a_replacement_takes_the_place_of_the_line_it_replaces() {
        let old = "x\ny\n";
        let new = "X\nY\n";
        assert_eq!(stage(old, new, &lines(&[[0, 1]], &[[0, 1]])), "X\ny\n");
        assert_eq!(stage(old, new, &lines(&[[1, 2]], &[[1, 2]])), "x\nY\n");
        assert_eq!(partial_text(old, new, &lines(&[[0, 1]], &[[0, 1]]), true).changed_lines, 2);
    }

    #[test]
    fn giving_back_restores_the_selected_lines_on_the_newer_side() {
        // Unstage or discard: the newer side keeps what is not selected.
        let old = "a\nb\nc\n";
        let new = "a\nB\nc\nadded\n";
        assert_eq!(give_back(old, new, &lines(&[[1, 2]], &[[1, 2]])), "a\nb\nc\nadded\n");
        assert_eq!(give_back(old, new, &lines(&[], &[[3, 4]])), "a\nB\nc\n");
        assert_eq!(give_back(old, new, &lines(&[[0, 9]], &[[0, 9]])), old);
    }

    #[test]
    fn missing_newlines_at_the_end_follow_the_selection() {
        // The new side adds a newline at the end and a line.
        let old = "a\nb";
        let new = "a\nb\nc\n";
        let all = stage(old, new, &lines(&[[0, 9]], &[[0, 9]]));
        assert_eq!(all, new);
        // Removing the last line keeps the file without a final newline.
        assert_eq!(stage("a\nb", "a", &lines(&[[1, 2]], &[])), "a");
        assert_eq!(stage("a\nb\n", "a\nb", &lines(&[[0, 9]], &[[0, 9]])), "a\nb");
    }

    #[test]
    fn crlf_files_keep_their_line_endings() {
        let old = "a\r\nb\r\nc\r\n";
        let new = "a\r\nB\r\nc\r\nd\r\n";
        assert_eq!(stage(old, new, &lines(&[], &[[3, 4]])), "a\r\nb\r\nc\r\nd\r\n");
        assert_eq!(stage(old, new, &lines(&[[1, 2]], &[[1, 2]])), "a\r\nB\r\nc\r\n");
        // An LF index and a CRLF work tree (autocrlf): staged lines take LF.
        assert_eq!(stage("a\nb\n", "a\r\nb\r\nc\r\n", &lines(&[], &[[2, 3]])), "a\nb\nc\n");
        // A new file keeps the work tree's endings.
        assert_eq!(stage("", "a\r\nb\r\n", &lines(&[], &[[0, 1]])), "a\r\n");
    }

    #[test]
    fn a_patch_turns_one_text_into_the_other() {
        let patch = unified_patch("f.txt", Some("a\nb\nc\n"), "a\nB\nc\n", 0o100644);
        assert_eq!(
            patch,
            "diff --git a/f.txt b/f.txt\n--- a/f.txt\n+++ b/f.txt\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n"
        );
        let new_file = unified_patch("dir/n.txt", None, "x\ny", 0o100755);
        assert_eq!(
            new_file,
            "diff --git a/dir/n.txt b/dir/n.txt\nnew file mode 100755\n--- /dev/null\n+++ b/dir/n.txt\n@@ -0,0 +1,2 @@\n+x\n+y\n\\ No newline at end of file\n"
        );
    }

    #[test]
    fn far_apart_changes_get_their_own_blocks() {
        let before: String = (0..30).map(|index| format!("{index}\n")).collect();
        let after: String = (0..30)
            .map(|index| match index {
                2 => "two\n".to_string(),
                25 => "twenty-five\n".to_string(),
                _ => format!("{index}\n"),
            })
            .collect();
        let patch = unified_patch("f", Some(&before), &after, 0o100644);
        assert_eq!(patch.matches("\n@@ ").count(), 2, "{patch}");
        assert!(patch.contains("@@ -1,6 +1,6 @@\n 0\n 1\n-2\n+two\n 3\n 4\n 5\n"), "{patch}");
        assert!(patch.contains("@@ -23,7 +23,7 @@\n"), "{patch}");
    }

    #[test]
    fn odd_paths_are_quoted_like_git() {
        assert_eq!(header_path("a/", "plain name.txt"), "a/plain name.txt");
        assert_eq!(header_path("a/", "tab\there"), "\"a/tab\\there\"");
        assert_eq!(header_path("b/", "quo\"te"), "\"b/quo\\\"te\"");
        assert_eq!(name_line("---", "a/plain name.txt"), "--- a/plain name.txt\t\n");
    }
}
