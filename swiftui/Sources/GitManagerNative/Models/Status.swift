// Mirrors of the status types in src/lib/types.ts (from src-tauri/src/git/status.rs).
// Only the fields the app shows so far; JSONDecoder skips the rest.

import NativeCore

struct GetStatusArgs: Encodable {
    let repoPath: String
    let knownHash: String?
}

struct StatusSnapshot: Decodable {
    let hash: String
    let status: RepoStatus?
}

struct RepoStatus: Decodable {
    let head: HeadInfo
    let files: [FileStatus]
}

struct HeadInfo: Decodable {
    let branch: String?
    let shortId: String?
    let unborn: Bool
    let upstream: String?
    let ahead: Int
    let behind: Int
}

struct FileStatus: Decodable {
    let path: String
    /// The path before a rename.
    let origPath: String?
    let staged: String?
    let unstaged: String?
    let conflicted: Bool
}

struct MemoryUsage: Decodable {
    let totalBytes: UInt64
}

struct GetFileDiffArgs: Encodable {
    let repoPath: String
    let filePath: String
    let origPath: String?
    let area: String
}

/// One file's diff from the bridge (src-tauri/src/git/diff.rs FileDiff): both texts and the changed line ranges.
struct FileDiff: Decodable {
    let path: String
    let original: String
    let modified: String
    let binary: Bool
    let tooLarge: Bool
    /// `[oldStart, oldEnd, newStart, newEnd]`, 0-based and half-open.
    let hunks: [[Int]]
}

/// The diff shown in the main area: which file, staged or not, and its texts.
struct OpenDiff {
    let filePath: String
    let staged: Bool
    let diff: FileDiff
    /// Syntax colors of each side, once SyntaxHighlighter has them (the text shows plain until then).
    var originalSpans: SyntaxColors?
    var modifiedSpans: SyntaxColors?
}
