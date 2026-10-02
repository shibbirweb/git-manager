//! Reading the patches the shelf stores: splitting them into one section per file, the blob
//! ids a section names, and rebuilding the new side of a text file from its hunks (Show Diff).

/// Splits a `git diff` patch at every `diff --git ` line. Text before the first one is dropped.
/// Base85 lines of a binary patch never contain a space, so they can never start a section.
pub fn split_sections(patch: &[u8]) -> Vec<&[u8]> {
    let mut starts = Vec::new();
    let mut line_start = 0;
    while line_start < patch.len() {
        if patch[line_start..].starts_with(b"diff --git ") {
            starts.push(line_start);
        }
        match patch[line_start..].iter().position(|byte| *byte == b'\n') {
            Some(offset) => line_start += offset + 1,
            None => break,
        }
    }
    starts
        .iter()
        .enumerate()
        .map(|(index, start)| {
            let end = starts.get(index + 1).copied().unwrap_or(patch.len());
            &patch[*start..end]
        })
        .collect()
}

/// Lines with their `\n` (the last one may have none).
fn lines(bytes: &[u8]) -> Vec<&[u8]> {
    let mut found = Vec::new();
    let mut start = 0;
    for (index, byte) in bytes.iter().enumerate() {
        if *byte == b'\n' {
            found.push(&bytes[start..=index]);
            start = index + 1;
        }
    }
    if start < bytes.len() {
        found.push(&bytes[start..]);
    }
    found
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HunkLine {
    Context(Vec<u8>),
    Removed(Vec<u8>),
    Added(Vec<u8>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hunk {
    /// 1-based, as in `@@ -start,count`; 0 with a count of 0 inserts before the first line.
    pub old_start: usize,
    pub old_count: usize,
    pub lines: Vec<HunkLine>,
}

/// What a file section of a patch says.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SectionInfo {
    /// From the `index <old>..<new>` line; all zeros means the side does not exist.
    pub old_id: Option<String>,
    pub new_id: Option<String>,
    pub binary: bool,
    pub hunks: Vec<Hunk>,
}

pub fn is_zero_id(object_id: &str) -> bool {
    object_id.bytes().all(|byte| byte == b'0')
}

fn parse_range(text: &str) -> Option<(usize, usize)> {
    let text = text.trim_start_matches(['-', '+']);
    match text.split_once(',') {
        Some((start, count)) => Some((start.parse().ok()?, count.parse().ok()?)),
        None => Some((text.parse().ok()?, 1)),
    }
}

fn hunk_header(line: &[u8]) -> Option<(usize, usize)> {
    let text = std::str::from_utf8(line).ok()?;
    let rest = text.strip_prefix("@@ ")?;
    let old = rest.split_whitespace().next()?;
    parse_range(old)
}

pub fn parse_section(section: &[u8]) -> SectionInfo {
    let mut info = SectionInfo::default();
    let mut in_hunks = false;
    for line in lines(section) {
        if !in_hunks {
            if line.starts_with(b"GIT binary patch") || line.starts_with(b"Binary files ") {
                info.binary = true;
                break;
            }
            if let Some(rest) = line.strip_prefix(b"index ") {
                let text = String::from_utf8_lossy(rest);
                let ids = text.split_whitespace().next().unwrap_or_default();
                if let Some((old, new)) = ids.split_once("..") {
                    info.old_id = Some(old.to_string());
                    info.new_id = Some(new.to_string());
                }
                continue;
            }
        }
        if let Some((old_start, old_count)) = hunk_header(line) {
            in_hunks = true;
            info.hunks.push(Hunk {
                old_start,
                old_count,
                lines: Vec::new(),
            });
            continue;
        }
        let Some(hunk) = info.hunks.last_mut().filter(|_| in_hunks) else {
            continue;
        };
        match line.first() {
            Some(b'\\') => {
                // "\ No newline at end of file": the line before has no line break.
                if let Some(HunkLine::Context(content) | HunkLine::Removed(content) | HunkLine::Added(content)) =
                    hunk.lines.last_mut()
                {
                    if content.ends_with(b"\n") {
                        content.pop();
                    }
                }
            }
            Some(b'+') => hunk.lines.push(HunkLine::Added(line[1..].to_vec())),
            Some(b'-') => hunk.lines.push(HunkLine::Removed(line[1..].to_vec())),
            Some(b' ') => hunk.lines.push(HunkLine::Context(line[1..].to_vec())),
            // An empty context line, with diff.suppressBlankEmpty.
            Some(b'\n') => hunk.lines.push(HunkLine::Context(b"\n".to_vec())),
            _ => {}
        }
    }
    info
}

/// The new side of a file: `original` with the hunks applied. None when they do not fit.
pub fn apply_hunks(original: &[u8], hunks: &[Hunk]) -> Option<Vec<u8>> {
    let old_lines = lines(original);
    let mut result = Vec::with_capacity(original.len());
    let mut cursor = 0;
    for hunk in hunks {
        let start = if hunk.old_count == 0 {
            hunk.old_start
        } else {
            hunk.old_start.checked_sub(1)?
        };
        if start < cursor || start > old_lines.len() {
            return None;
        }
        for line in &old_lines[cursor..start] {
            result.extend_from_slice(line);
        }
        cursor = start;
        for line in &hunk.lines {
            match line {
                HunkLine::Context(content) | HunkLine::Removed(content) => {
                    if old_lines.get(cursor).copied() != Some(content.as_slice()) {
                        return None;
                    }
                    if matches!(line, HunkLine::Context(_)) {
                        result.extend_from_slice(content);
                    }
                    cursor += 1;
                }
                HunkLine::Added(content) => result.extend_from_slice(content),
            }
        }
    }
    for line in &old_lines[cursor.min(old_lines.len())..] {
        result.extend_from_slice(line);
    }
    Some(result)
}

/// Both sides as far as the hunks show them, for when the original blob is gone.
pub fn hunk_sides(hunks: &[Hunk]) -> (Vec<u8>, Vec<u8>) {
    let mut old = Vec::new();
    let mut new = Vec::new();
    for hunk in hunks {
        for line in &hunk.lines {
            match line {
                HunkLine::Context(content) => {
                    old.extend_from_slice(content);
                    new.extend_from_slice(content);
                }
                HunkLine::Removed(content) => old.extend_from_slice(content),
                HunkLine::Added(content) => new.extend_from_slice(content),
            }
        }
    }
    (old, new)
}

#[cfg(test)]
mod tests {
    use super::*;

    const TWO_FILES: &[u8] = b"diff --git a/a.txt b/a.txt\nindex 1111111111111111111111111111111111111111..2222222222222222222222222222222222222222 100644\n--- a/a.txt\n+++ b/a.txt\n@@ -1,3 +1,3 @@\n one\n-two\n+TWO\n three\ndiff --git a/b.bin b/b.bin\nnew file mode 100644\nindex 0000000000000000000000000000000000000000..3333333333333333333333333333333333333333\nGIT binary patch\nliteral 5\nMcmZQzOv=my00M6TI{*Lx\n\nliteral 0\nHcmV?d00001\n\n";

    #[test]
    fn splits_a_patch_into_file_sections() {
        let sections = split_sections(TWO_FILES);
        assert_eq!(sections.len(), 2);
        assert!(sections[0].starts_with(b"diff --git a/a.txt"));
        assert!(sections[1].starts_with(b"diff --git a/b.bin"));
        assert_eq!(sections.concat(), TWO_FILES);
        assert!(split_sections(b"").is_empty());
        assert!(split_sections(b"not a patch\n").is_empty());
    }

    #[test]
    fn reads_ids_binary_and_hunks() {
        let sections = split_sections(TWO_FILES);
        let text = parse_section(sections[0]);
        assert_eq!(text.old_id.as_deref(), Some("1111111111111111111111111111111111111111"));
        assert!(!text.binary);
        assert_eq!(text.hunks.len(), 1);
        assert_eq!(
            text.hunks[0].lines,
            vec![
                HunkLine::Context(b"one\n".to_vec()),
                HunkLine::Removed(b"two\n".to_vec()),
                HunkLine::Added(b"TWO\n".to_vec()),
                HunkLine::Context(b"three\n".to_vec()),
            ]
        );
        let binary = parse_section(sections[1]);
        assert!(binary.binary);
        assert!(is_zero_id(binary.old_id.as_deref().unwrap()));
    }

    #[test]
    fn applies_hunks_to_rebuild_the_new_side() {
        let section = parse_section(split_sections(TWO_FILES)[0]);
        assert_eq!(apply_hunks(b"one\ntwo\nthree\nfour\n", &section.hunks).unwrap(), b"one\nTWO\nthree\nfour\n");
        assert!(apply_hunks(b"other\ncontent\n", &section.hunks).is_none());
        assert_eq!(hunk_sides(&section.hunks), (b"one\ntwo\nthree\n".to_vec(), b"one\nTWO\nthree\n".to_vec()));
    }

    #[test]
    fn handles_missing_final_newlines_and_new_files() {
        let patch = b"diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n+b\n";
        let section = parse_section(patch);
        assert_eq!(apply_hunks(b"a\nb", &section.hunks).unwrap(), b"a\nb\n");

        let added = b"diff --git a/n b/n\nnew file mode 100644\n--- /dev/null\n+++ b/n\n@@ -0,0 +1,2 @@\n+x\n+y\n\\ No newline at end of file\n";
        let section = parse_section(added);
        assert_eq!(apply_hunks(b"", &section.hunks).unwrap(), b"x\ny");

        let deleted = b"diff --git a/d b/d\ndeleted file mode 100644\n--- a/d\n+++ /dev/null\n@@ -1 +0,0 @@\n-gone\n";
        let section = parse_section(deleted);
        assert_eq!(apply_hunks(b"gone\n", &section.hunks).unwrap(), b"");

        let insert_top = b"diff --git a/t b/t\n--- a/t\n+++ b/t\n@@ -0,0 +1 @@\n+top\n";
        let section = parse_section(insert_top);
        assert_eq!(apply_hunks(b"rest\n", &section.hunks).unwrap(), b"top\nrest\n");
    }

    #[test]
    fn keeps_crlf_line_endings() {
        let patch = b"diff --git a/c b/c\n--- a/c\n+++ b/c\n@@ -1,2 +1,2 @@\n one\r\n-two\r\n+zwei\r\n";
        let section = parse_section(patch);
        assert_eq!(apply_hunks(b"one\r\ntwo\r\n", &section.hunks).unwrap(), b"one\r\nzwei\r\n");
    }
}
