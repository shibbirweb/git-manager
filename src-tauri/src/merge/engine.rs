//! Line-based 3-way merge: diffs base->ours and base->theirs, then groups
//! overlapping or touching hunks (same rule as git's xdiff) into chunks.

use imara_diff::{Algorithm, Diff, Hunk, InternedInput};

use super::model::{ChunkKind, LineRange, MergeChunk};

/// Splits LF-normalized text into lines exactly like CodeMirror does, so line
/// indexes computed here address the same lines in the editor.
pub fn split_lines(text: &str) -> Vec<&str> {
    text.split('\n').collect()
}

fn normalize_whitespace(line: &str) -> String {
    line.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn diff_hunks(before: &[&str], after: &[&str]) -> Vec<Hunk> {
    let mut input: InternedInput<&str> = InternedInput::default();
    input.update_before(before.iter().copied());
    input.update_after(after.iter().copied());
    let mut diff = Diff::compute(Algorithm::Histogram, &input);
    diff.postprocess_lines(&input);
    diff.hunks().collect()
}

/// Sum of line-count changes introduced by a set of hunks.
fn hunk_delta(hunks: &[&Hunk]) -> i64 {
    hunks
        .iter()
        .map(|hunk| hunk.after.len() as i64 - hunk.before.len() as i64)
        .sum()
}

fn side_range(group: &LineRange, delta_before: i64, hunks: &[&Hunk]) -> LineRange {
    let start = group.start as i64 + delta_before;
    let end = group.end as i64 + delta_before + hunk_delta(hunks);
    LineRange::new(start as u32, end as u32)
}

pub fn compute_chunks(base: &str, ours: &str, theirs: &str, ignore_whitespace: bool) -> Vec<MergeChunk> {
    let base_lines = split_lines(base);
    let ours_lines = split_lines(ours);
    let theirs_lines = split_lines(theirs);

    // With ignore_whitespace the diff runs over normalized keys; ranges stay
    // valid for the original lines because normalization is line-for-line.
    let keys = |lines: &[&str]| -> Vec<String> {
        if ignore_whitespace {
            lines.iter().map(|line| normalize_whitespace(line)).collect()
        } else {
            lines.iter().map(|line| line.to_string()).collect()
        }
    };
    let base_keys = keys(&base_lines);
    let ours_keys = keys(&ours_lines);
    let theirs_keys = keys(&theirs_lines);
    let base_refs: Vec<&str> = base_keys.iter().map(String::as_str).collect();
    let ours_refs: Vec<&str> = ours_keys.iter().map(String::as_str).collect();
    let theirs_refs: Vec<&str> = theirs_keys.iter().map(String::as_str).collect();

    let ours_hunks = diff_hunks(&base_refs, &ours_refs);
    let theirs_hunks = diff_hunks(&base_refs, &theirs_refs);

    let mut chunks = Vec::new();
    let (mut i, mut j) = (0usize, 0usize);
    let (mut ours_delta, mut theirs_delta) = (0i64, 0i64);

    while i < ours_hunks.len() || j < theirs_hunks.len() {
        let take_ours_first = match (ours_hunks.get(i), theirs_hunks.get(j)) {
            (Some(o), Some(t)) => o.before.start <= t.before.start,
            (Some(_), None) => true,
            _ => false,
        };

        let mut group_ours: Vec<&Hunk> = Vec::new();
        let mut group_theirs: Vec<&Hunk> = Vec::new();
        let mut group = if take_ours_first {
            let hunk = &ours_hunks[i];
            i += 1;
            group_ours.push(hunk);
            LineRange::new(hunk.before.start, hunk.before.end)
        } else {
            let hunk = &theirs_hunks[j];
            j += 1;
            group_theirs.push(hunk);
            LineRange::new(hunk.before.start, hunk.before.end)
        };

        // Absorb every hunk that overlaps or touches the group; touching
        // changes are treated as conflicting, matching git.
        loop {
            let mut extended = false;
            if let Some(hunk) = ours_hunks.get(i) {
                if hunk.before.start <= group.end {
                    group.end = group.end.max(hunk.before.end);
                    group_ours.push(hunk);
                    i += 1;
                    extended = true;
                }
            }
            if let Some(hunk) = theirs_hunks.get(j) {
                if hunk.before.start <= group.end {
                    group.end = group.end.max(hunk.before.end);
                    group_theirs.push(hunk);
                    j += 1;
                    extended = true;
                }
            }
            if !extended {
                break;
            }
        }

        let ours_range = side_range(&group, ours_delta, &group_ours);
        let theirs_range = side_range(&group, theirs_delta, &group_theirs);
        ours_delta += hunk_delta(&group_ours);
        theirs_delta += hunk_delta(&group_theirs);

        let kind = if group_theirs.is_empty() {
            ChunkKind::OursOnly
        } else if group_ours.is_empty() {
            ChunkKind::TheirsOnly
        } else {
            let ours_slice = &ours_refs[ours_range.start as usize..ours_range.end as usize];
            let theirs_slice = &theirs_refs[theirs_range.start as usize..theirs_range.end as usize];
            if ours_slice == theirs_slice {
                ChunkKind::BothSame
            } else {
                ChunkKind::Conflict
            }
        };

        chunks.push(MergeChunk {
            id: chunks.len() as u32,
            kind,
            base: group,
            ours: ours_range,
            theirs: theirs_range,
        });
    }

    chunks
}

/// Applies every non-conflicting chunk to the base. Conflicts are rendered
/// with markers. Returns the merged text and whether any conflict remained.
#[cfg(test)]
pub fn auto_merge(base: &str, ours: &str, theirs: &str, chunks: &[MergeChunk]) -> (String, bool) {
    let base_lines = split_lines(base);
    let ours_lines = split_lines(ours);
    let theirs_lines = split_lines(theirs);
    let slice = |lines: &[&str], range: &LineRange| -> Vec<String> {
        lines[range.start as usize..range.end as usize]
            .iter()
            .map(|line| line.to_string())
            .collect()
    };

    let mut result: Vec<String> = Vec::new();
    let mut has_conflict = false;
    let mut base_pos = 0usize;
    for chunk in chunks {
        result.extend(base_lines[base_pos..chunk.base.start as usize].iter().map(|line| line.to_string()));
        match chunk.kind {
            ChunkKind::OursOnly | ChunkKind::BothSame => result.extend(slice(&ours_lines, &chunk.ours)),
            ChunkKind::TheirsOnly => result.extend(slice(&theirs_lines, &chunk.theirs)),
            ChunkKind::Conflict => {
                has_conflict = true;
                result.push("<<<<<<< ours".to_string());
                result.extend(slice(&ours_lines, &chunk.ours));
                result.push("=======".to_string());
                result.extend(slice(&theirs_lines, &chunk.theirs));
                result.push(">>>>>>> theirs".to_string());
            }
        }
        base_pos = chunk.base.end as usize;
    }
    result.extend(base_lines[base_pos..].iter().map(|line| line.to_string()));
    (result.join("\n"), has_conflict)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn kinds(chunks: &[MergeChunk]) -> Vec<ChunkKind> {
        chunks.iter().map(|chunk| chunk.kind).collect()
    }

    #[test]
    fn identical_inputs_have_no_chunks() {
        let text = "a\nb\nc\n";
        assert!(compute_chunks(text, text, text, false).is_empty());
    }

    #[test]
    fn one_sided_changes_do_not_conflict() {
        let base = "a\nb\nc\nd\ne\n";
        let ours = "a\nB\nc\nd\ne\n";
        let theirs = "a\nb\nc\nd\nE\n";
        let chunks = compute_chunks(base, ours, theirs, false);
        assert_eq!(kinds(&chunks), vec![ChunkKind::OursOnly, ChunkKind::TheirsOnly]);
        assert_eq!(chunks[0].base, LineRange::new(1, 2));
        assert_eq!(chunks[0].ours, LineRange::new(1, 2));
        assert_eq!(chunks[1].theirs, LineRange::new(4, 5));
        let (merged, conflict) = auto_merge(base, ours, theirs, &chunks);
        assert!(!conflict);
        assert_eq!(merged, "a\nB\nc\nd\nE\n");
    }

    #[test]
    fn identical_change_on_both_sides() {
        let base = "a\nb\nc\n";
        let changed = "a\nX\nc\n";
        let chunks = compute_chunks(base, changed, changed, false);
        assert_eq!(kinds(&chunks), vec![ChunkKind::BothSame]);
    }

    #[test]
    fn overlapping_changes_conflict() {
        let base = "a\nb\nc\n";
        let chunks = compute_chunks(base, "a\nours\nc\n", "a\ntheirs\nc\n", false);
        assert_eq!(kinds(&chunks), vec![ChunkKind::Conflict]);
        assert_eq!(chunks[0].base, LineRange::new(1, 2));
        assert_eq!(chunks[0].ours, LineRange::new(1, 2));
        assert_eq!(chunks[0].theirs, LineRange::new(1, 2));
    }

    #[test]
    fn touching_changes_conflict_like_git() {
        let base = "a\nb\nc\nd\n";
        let ours = "a\nB\nc\nd\n";
        let theirs = "a\nb\nC\nd\n";
        let chunks = compute_chunks(base, ours, theirs, false);
        assert_eq!(kinds(&chunks), vec![ChunkKind::Conflict]);
        assert_eq!(chunks[0].base, LineRange::new(1, 3));
    }

    #[test]
    fn insertions_and_deletions_track_offsets() {
        let base = "1\n2\n3\n4\n5\n6\n7\n8\n";
        let ours = "0\n1\n2\n3\n4\n5\n6\n7\n8\n";
        let theirs = "1\n2\n3\n4\n5\n6\n8\n";
        let chunks = compute_chunks(base, ours, theirs, false);
        assert_eq!(kinds(&chunks), vec![ChunkKind::OursOnly, ChunkKind::TheirsOnly]);
        assert_eq!(chunks[0].base, LineRange::new(0, 0));
        assert_eq!(chunks[0].ours, LineRange::new(0, 1));
        assert_eq!(chunks[1].base, LineRange::new(6, 7));
        assert_eq!(chunks[1].ours, LineRange::new(7, 8));
        assert_eq!(chunks[1].theirs, LineRange::new(6, 6));
        let (merged, conflict) = auto_merge(base, ours, theirs, &chunks);
        assert!(!conflict);
        assert_eq!(merged, "0\n1\n2\n3\n4\n5\n6\n8\n");
    }

    #[test]
    fn add_add_uses_empty_base() {
        let chunks = compute_chunks("", "x\ny", "x\nz", false);
        assert_eq!(kinds(&chunks), vec![ChunkKind::Conflict]);
    }

    #[test]
    fn missing_final_newline_is_a_change() {
        let chunks = compute_chunks("a\nb\n", "a\nb", "a\nb\n", false);
        assert_eq!(kinds(&chunks), vec![ChunkKind::OursOnly]);
    }

    #[test]
    fn ignore_whitespace_hides_indent_only_changes() {
        let base = "fn a() {\n  x();\n}\n";
        let ours = "fn a() {\n    x();\n}\n";
        let theirs = "fn a() {\n  y();\n}\n";
        assert_eq!(kinds(&compute_chunks(base, ours, theirs, false)), vec![ChunkKind::Conflict]);
        assert_eq!(kinds(&compute_chunks(base, ours, theirs, true)), vec![ChunkKind::TheirsOnly]);
    }

    /// Runs `git merge-file -p` as an oracle. Returns None when git is absent.
    fn git_merge_file(base: &str, ours: &str, theirs: &str) -> Option<(String, bool)> {
        let dir = tempfile::tempdir().ok()?;
        let write = |name: &str, content: &str| {
            let path = dir.path().join(name);
            std::fs::write(&path, content).unwrap();
            path
        };
        let ours_path = write("ours", ours);
        let base_path = write("base", base);
        let theirs_path = write("theirs", theirs);
        let output = Command::new("git")
            .arg("merge-file")
            .arg("-p")
            .arg(&ours_path)
            .arg(&base_path)
            .arg(&theirs_path)
            .output()
            .ok()?;
        let clean = output.status.code() == Some(0);
        Some((String::from_utf8_lossy(&output.stdout).into_owned(), clean))
    }

    /// Small deterministic PRNG so the property test needs no extra crate.
    struct Lcg(u64);

    impl Lcg {
        fn next(&mut self) -> u64 {
            self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            self.0 >> 33
        }

        fn below(&mut self, bound: u64) -> u64 {
            self.next() % bound
        }
    }

    fn mutate(rng: &mut Lcg, lines: &[String], tag: &str) -> Vec<String> {
        let mut out = Vec::new();
        for (index, line) in lines.iter().enumerate() {
            match rng.below(40) {
                0 => {}
                1 => out.push(format!("{tag}-changed-{index}")),
                2 => {
                    out.push(line.clone());
                    out.push(format!("{tag}-added-{index}"));
                }
                _ => out.push(line.clone()),
            }
        }
        out
    }

    #[test]
    fn agrees_with_git_merge_file_when_both_are_clean() {
        if git_merge_file("a\n", "a\n", "a\n").is_none() {
            return;
        }
        let mut rng = Lcg(42);
        let mut compared = 0;
        let mut disagreements = 0;
        for _ in 0..300 {
            let base: Vec<String> = (0..(10 + rng.below(30))).map(|n| format!("line {n}")).collect();
            let ours = mutate(&mut rng, &base, "ours");
            let theirs = mutate(&mut rng, &base, "theirs");
            let join = |lines: &[String]| format!("{}\n", lines.join("\n"));
            let (base_text, ours_text, theirs_text) = (join(&base), join(&ours), join(&theirs));

            let chunks = compute_chunks(&base_text, &ours_text, &theirs_text, false);
            let (merged, conflict) = auto_merge(&base_text, &ours_text, &theirs_text, &chunks);
            let (git_merged, git_clean) = git_merge_file(&base_text, &ours_text, &theirs_text).unwrap();
            if !conflict && git_clean {
                assert_eq!(merged, git_merged, "base:\n{base_text}\nours:\n{ours_text}\ntheirs:\n{theirs_text}");
                compared += 1;
            } else if conflict != !git_clean {
                disagreements += 1;
            }
        }
        assert!(compared > 50, "too few clean cases compared: {compared}");
        // Diff heuristics differ slightly from git's Myers, so allow rare disagreements.
        assert!(disagreements * 20 < 300, "too many clean/conflict disagreements: {disagreements}");
    }
}
