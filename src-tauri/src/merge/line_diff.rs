//! Line diffs for the editor's change marks and the 2-way diff view. Lines are
//! split exactly like CodeMirror splits them, so every index here addresses the
//! same line in the editor.

use imara_diff::{Algorithm, Diff, Hunk, InternedInput};
use serde::Serialize;

use super::engine::split_lines;

/// Equal lines kept around the changed middle, so the slider heuristics still see the
/// neighbours of a change they may move it into.
const CONTEXT: usize = 100;

/// Hunks between two line lists: histogram diff with git's slider heuristics. The common
/// start and end (most of a file being edited) are compared directly and never hashed.
pub fn hunks(before: &[&str], after: &[&str]) -> Vec<Hunk> {
    if before == after {
        return Vec::new();
    }
    let prefix = before.iter().zip(after).take_while(|(a, b)| a == b).count();
    let room = before.len().min(after.len()) - prefix;
    let suffix = before
        .iter()
        .rev()
        .zip(after.iter().rev())
        .take(room)
        .take_while(|(a, b)| a == b)
        .count();
    let skip = prefix.saturating_sub(CONTEXT);
    let keep_end = suffix.saturating_sub(CONTEXT);
    let before_part = &before[skip..before.len() - keep_end];
    let after_part = &after[skip..after.len() - keep_end];
    let mut input: InternedInput<&str> = InternedInput::default();
    input.update_before(before_part.iter().copied());
    input.update_after(after_part.iter().copied());
    let mut diff = Diff::compute(Algorithm::Histogram, &input);
    diff.postprocess_lines(&input);
    let offset = skip as u32;
    diff.hunks()
        .map(|hunk| Hunk {
            before: hunk.before.start + offset..hunk.before.end + offset,
            after: hunk.after.start + offset..hunk.after.end + offset,
        })
        .collect()
}

/// `[oldStart, oldEnd, newStart, newEnd]`: half-open 0-based line ranges.
pub type LineHunk = [u32; 4];

/// Line hunks between two LF-normalized texts.
pub fn text_hunks(before: &str, after: &str) -> Vec<LineHunk> {
    if before == after {
        return Vec::new();
    }
    hunks(&split_lines(before), &split_lines(after))
        .into_iter()
        .map(|hunk| [hunk.before.start, hunk.before.end, hunk.after.start, hunk.after.end])
        .collect()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MarkKind {
    Added,
    Modified,
    Deleted,
}

/// A changed range of the editor's text against the committed version.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ChangeMark {
    /// Half-open 0-based line range in the editor; empty for deletions.
    pub from: u32,
    pub to: u32,
    pub kind: MarkKind,
}

/// What was added, modified or deleted in `doc` compared with `head`.
pub fn change_marks(head: &str, doc: &str) -> Vec<ChangeMark> {
    text_hunks(head, doc)
        .into_iter()
        .map(|[old_start, old_end, new_start, new_end]| ChangeMark {
            from: new_start,
            to: new_end,
            kind: if old_start == old_end {
                MarkKind::Added
            } else if new_start == new_end {
                MarkKind::Deleted
            } else {
                MarkKind::Modified
            },
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mark(from: u32, to: u32, kind: MarkKind) -> ChangeMark {
        ChangeMark { from, to, kind }
    }

    /// Rebuilds `after` from `before` and the hunks, which proves the hunks are complete.
    fn apply(before: &str, after: &str, hunks: &[LineHunk]) -> String {
        let (old, new) = (split_lines(before), split_lines(after));
        let mut out: Vec<&str> = Vec::new();
        let mut position = 0usize;
        for [old_start, old_end, new_start, new_end] in hunks {
            out.extend(&old[position..*old_start as usize]);
            out.extend(&new[*new_start as usize..*new_end as usize]);
            position = *old_end as usize;
        }
        out.extend(&old[position..]);
        out.join("\n")
    }

    #[test]
    fn equal_texts_have_no_hunks() {
        assert!(text_hunks("a\nb\n", "a\nb\n").is_empty());
        assert!(change_marks("", "").is_empty());
    }

    #[test]
    fn marks_added_modified_and_deleted_lines() {
        assert_eq!(change_marks("a\nb\nc\n", "a\nB\nc\n"), vec![mark(1, 2, MarkKind::Modified)]);
        assert_eq!(change_marks("a\nc\n", "a\nb\nc\n"), vec![mark(1, 2, MarkKind::Added)]);
        assert_eq!(change_marks("a\nb\nc\n", "a\nc\n"), vec![mark(1, 1, MarkKind::Deleted)]);
        // A file git does not have yet: everything is new.
        assert_eq!(change_marks("", "x\ny\n"), vec![mark(0, 2, MarkKind::Added)]);
    }

    #[test]
    fn scattered_edits_stay_separate_hunks() {
        let base: Vec<String> = (0..2000).map(|index| format!("line {index}")).collect();
        let mut edited = base.clone();
        for index in (100..2000).step_by(200) {
            edited[index] = format!("changed {index}");
        }
        let (before, after) = (base.join("\n"), edited.join("\n"));
        let hunks = text_hunks(&before, &after);
        assert_eq!(hunks.len(), 10);
        assert_eq!(apply(&before, &after, &hunks), after);
    }

    #[test]
    fn a_change_deep_in_a_long_file_keeps_its_line_numbers() {
        let base: Vec<String> = (0..5000).map(|index| format!("line {index}")).collect();
        let mut edited = base.clone();
        edited[3000] = "changed".to_string();
        edited.insert(3500, "added".to_string());
        let hunks = text_hunks(&base.join("\n"), &edited.join("\n"));
        assert_eq!(hunks, vec![[3000, 3001, 3000, 3001], [3500, 3500, 3500, 3501]]);
    }

    #[test]
    fn hunks_always_rebuild_the_new_text() {
        let mut seed: u64 = 7;
        let mut random = |bound: u64| {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            (seed >> 33) % bound
        };
        for round in 0..300 {
            // Some rounds share a long start and end, which the diff skips over.
            let shared: Vec<String> = (0..if round % 2 == 0 { 0 } else { 250 }).map(|index| format!("s{index}")).collect();
            let middle = |random: &mut dyn FnMut(u64) -> u64| -> Vec<String> {
                (0..random(30)).map(|_| format!("v{}", random(6))).collect()
            };
            let before: Vec<String> = [shared.clone(), middle(&mut random), shared.clone()].concat();
            let after: Vec<String> = [shared.clone(), middle(&mut random), shared.clone()].concat();
            let (before, after) = (before.join("\n"), after.join("\n"));
            assert_eq!(apply(&before, &after, &text_hunks(&before, &after)), after);
        }
    }
}
