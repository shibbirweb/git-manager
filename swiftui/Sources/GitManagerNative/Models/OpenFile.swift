// Mirrors of the editor's types in src/lib/types.ts (src-tauri/src/git/files.rs FileContent, blame.rs BlameRuns)
// and the file the main area shows: its text cut into lines once, so drawing a row never searches the text.

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

/// The file shown in the main area.
struct OpenFile {
    /// Absolute, like the tab's path.
    let path: String
    /// Relative to the repository, for git.
    let relativePath: String
    let content: FileContent
    let lines: [String]
    /// Each line's start in the text, in UTF-16 units (syntax spans count in them).
    let lineStarts: [Int]
    let indent: EditorInfo.Indent?
    /// Indent guide runs, worked out once per text.
    let guides: [IndentGuides.Run]
    /// The widest line, in characters.
    let widestLine: Int
    var spans: SyntaxColors?
    var blame: BlameRuns?

    init(path: String, relativePath: String, content: FileContent) {
        self.path = path
        self.relativePath = relativePath
        self.content = content
        let lines = DiffLayout.lines(content.content)
        self.lines = lines
        var starts: [Int] = []
        starts.reserveCapacity(lines.count)
        var start = 0, widest = 0
        for line in lines {
            starts.append(start)
            let length = line.utf16.count
            start += length + 1
            widest = max(widest, length)
        }
        lineStarts = starts
        widestLine = widest
        let indent = EditorInfo.detectIndentation(lines)
        self.indent = indent
        let rows = lines.enumerated().map { DiffRow.line(number: $0.offset + 1, text: $0.element, kind: .unchanged) }
        let unit = indent?.useTabs == false ? indent?.size ?? EditorInfo.defaultTabSize : EditorInfo.defaultTabSize
        guides = IndentGuides.runs(
            rows: rows, levels: IndentGuides.levels(lines: lines, tabSize: EditorInfo.defaultTabSize, unit: unit),
            metrics: RowMetrics(line: EditorGeometry.lineHeight, fold: 0, padding: EditorGeometry.topPadding)
        )
    }

    var language: String {
        EditorInfo.languageName(filePath: path)
    }

    var eolLabel: String {
        content.eol == "crlf" ? "CRLF" : "LF"
    }
}
