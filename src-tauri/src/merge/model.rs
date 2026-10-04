use serde::{Deserialize, Serialize};

/// Half-open range of 0-based line indexes, where lines are the result of
/// splitting the LF-normalized text on `\n` (the same model CodeMirror uses).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct LineRange {
    pub start: u32,
    pub end: u32,
}

impl LineRange {
    pub fn new(start: u32, end: u32) -> Self {
        LineRange { start, end }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ChunkKind {
    /// Only our side changed this region.
    OursOnly,
    /// Only their side changed this region.
    TheirsOnly,
    /// Both sides made the identical change.
    BothSame,
    /// Both sides changed the region differently.
    Conflict,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeChunk {
    pub id: u32,
    pub kind: ChunkKind,
    pub base: LineRange,
    pub ours: LineRange,
    pub theirs: LineRange,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FileConflictKind {
    /// Both sides modified a file that exists in the base.
    BothModified,
    /// Both sides added the file; there is no base version.
    BothAdded,
    /// Our side deleted the file, their side modified it.
    DeletedByUs,
    /// Their side deleted the file, our side modified it.
    DeletedByThem,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Eol {
    Lf,
    Crlf,
}

impl Eol {
    pub fn detect(text: &str) -> Eol {
        let crlf = text.matches("\r\n").count();
        let lf = text.matches('\n').count();
        if crlf > 0 && crlf * 2 >= lf {
            Eol::Crlf
        } else {
            Eol::Lf
        }
    }

    /// Converts LF-normalized text back to this line ending.
    pub fn apply(self, text: &str) -> String {
        match self {
            Eol::Lf => text.to_string(),
            Eol::Crlf => text.replace("\r\n", "\n").replace('\n', "\r\n"),
        }
    }
}

pub fn normalize_eol(text: &str) -> String {
    text.replace("\r\n", "\n")
}

/// Like `normalize_eol`, but keeps the string itself when it has no CRLF (no copy).
pub fn into_lf(text: String) -> String {
    if memchr::memmem::find(text.as_bytes(), b"\r\n").is_some() {
        normalize_eol(&text)
    } else {
        text
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeDocument {
    /// Repo-relative path in app mode, or the MERGED file path in mergetool mode.
    pub path: String,
    pub kind: FileConflictKind,
    /// Binary or non-UTF-8 content that can only be resolved per file.
    pub binary: bool,
    pub base: String,
    pub ours: String,
    pub theirs: String,
    pub ours_label: String,
    pub theirs_label: String,
    pub eol: Eol,
    pub ignore_whitespace: bool,
    pub chunks: Vec<MergeChunk>,
}
