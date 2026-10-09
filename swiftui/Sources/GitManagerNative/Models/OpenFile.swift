// Mirrors of the editor's types in src/lib/types.ts (src-tauri/src/git/files.rs FileContent, blame.rs BlameRuns)
// and the file the main area shows, as it was read (its text lives in EditorSession while it is edited).

import Foundation
import NativeCore

struct ReadWorktreeFileArgs: Encodable {
    let repoPath: String
    let filePath: String
    let knownVersion: String?
}

struct FileContent: Decodable {
    let path: String
    let content: String
    /// "lf" or "crlf"; the content always has LF line ends.
    let eol: String
    let binary: Bool
    let tooLarge: Bool
    let size: UInt64
    let version: String
    let unchanged: Bool
}

struct BlameContentsArgs: Encodable {
    let repoPath: String
    let filePath: String
    let eol: String
    let text: String
}

/// The file shown in the main area, as it was read.
struct OpenFile {
    /// Absolute, like the tab's path.
    let path: String
    /// Relative to the repository, for git.
    let relativePath: String
    let content: FileContent
    /// The indentation detected when the file opened (indentDetect.ts reads it once).
    let indent: EditorInfo.Indent?

    init(path: String, relativePath: String, content: FileContent) {
        self.path = path
        self.relativePath = relativePath
        self.content = content
        let lines = content.content.split(separator: "\n", omittingEmptySubsequences: false)
        indent = EditorInfo.detectIndentation(lines.prefix(EditorInfo.maxDetectLines).map(String.init))
    }

    var language: String {
        EditorInfo.languageName(filePath: path)
    }

    var eolLabel: String {
        content.eol == "crlf" ? "CRLF" : "LF"
    }
}
