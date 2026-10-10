// Line helpers for the merge (src/lib/merge/model.ts): a document is its lines, as CodeMirror splits LF text on
// "\n", so it always has at least one line ("" is one empty line).

import Foundation

public enum MergeText {
    public static func lines(_ text: String) -> [String] {
        text.components(separatedBy: "\n")
    }

    public static func text(_ lines: [String]) -> String {
        lines.joined(separator: "\n")
    }

    /// Lines `range` of `lines`, clamped to the document.
    public static func slice(_ lines: [String], _ range: LineRange) -> [String] {
        let end = min(range.end, lines.count)
        guard range.start < end else {
            return []
        }
        return Array(lines[range.start..<end])
    }

    /// Replaces lines `range` with `inserted`, with line-array semantics; removing every line leaves CodeMirror's
    /// single empty line.
    public static func replaceLines(_ lines: [String], _ range: LineRange, with inserted: [String]) -> [String] {
        let start = min(range.start, lines.count)
        let end = max(start, min(range.end, lines.count))
        var next = Array(lines[0..<start])
        next.append(contentsOf: inserted)
        next.append(contentsOf: lines[end...])
        return next.isEmpty ? [""] : next
    }

    /// Several replacements against the same document, in order and not overlapping, in one pass.
    public static func replacing(_ lines: [String], _ replacements: [(range: LineRange, lines: [String])])
        -> [String] {
        var next: [String] = []
        next.reserveCapacity(lines.count)
        var at = 0
        for replacement in replacements {
            let start = min(max(at, replacement.range.start), lines.count)
            next.append(contentsOf: lines[at..<start])
            next.append(contentsOf: replacement.lines)
            at = max(start, min(replacement.range.end, lines.count))
        }
        next.append(contentsOf: lines[at...])
        return next.isEmpty ? [""] : next
    }

    /// Where each line of `text` starts, in UTF-16 units (line 0 at 0).
    public static func lineStarts(_ text: String) -> [Int] {
        var starts = [0]
        var offset = 0
        for unit in text.utf16 {
            offset += 1
            if unit == 10 {
                starts.append(offset)
            }
        }
        return starts
    }

    /// Lines `range` of `text` joined by newlines, read through its `lineStarts`.
    public static func range(of text: String, starts: [Int], _ range: LineRange) -> String {
        let end = min(range.end, starts.count)
        guard range.start < end else {
            return ""
        }
        let units = text.utf16
        let from = units.index(units.startIndex, offsetBy: starts[range.start])
        let toOffset = end < starts.count ? starts[end] - 1 : units.count
        let to = units.index(units.startIndex, offsetBy: toOffset)
        return String(units[from..<to]) ?? ""
    }

    /// Whether the text still holds a conflict marker line (<<<<<<<, ======= or >>>>>>>).
    public static func hasConflictMarkers(_ text: String) -> Bool {
        for line in text.split(separator: "\n", omittingEmptySubsequences: false) {
            if line == "=======" {
                return true
            }
            for marker in ["<<<<<<<", ">>>>>>>"] where line.hasPrefix(marker) {
                let rest = line.dropFirst(marker.count)
                if rest.isEmpty || rest.first == " " || rest.first == "\t" {
                    return true
                }
            }
        }
        return false
    }
}

/// A user edit in the result as lines: the first and last line it touches in the old document and how many lines
/// it adds (negative when it removes some). From a character edit with `span(lines:from:to:insert:)`.
public struct MergeEditSpan: Equatable, Sendable {
    public let startLine: Int
    public let endLine: Int
    public let delta: Int

    public init(startLine: Int, endLine: Int, delta: Int) {
        self.startLine = startLine
        self.endLine = endLine
        self.delta = delta
    }

    /// The span of replacing UTF-16 offsets `from..<to` of the document `lines` with `insert`.
    public static func span(lines: [String], from: Int, to: Int, insert: String) -> MergeEditSpan {
        func line(at offset: Int) -> Int {
            var start = 0
            for (index, text) in lines.enumerated() {
                let end = start + text.utf16.count
                if offset <= end {
                    return index
                }
                start = end + 1
            }
            return max(0, lines.count - 1)
        }
        let startLine = line(at: from), endLine = line(at: to)
        let insertedBreaks = insert.utf16.filter { $0 == 10 }.count
        return MergeEditSpan(startLine: startLine, endLine: endLine, delta: insertedBreaks - (endLine - startLine))
    }
}

extension MergeModel {
    /// Maps chunk result ranges through user edits: edits inside a chunk grow or shrink it and mark it edited;
    /// edits before it shift it.
    public static func mapChunks(_ chunks: [ChunkState], edits: [MergeEditSpan]) -> [ChunkState] {
        guard !edits.isEmpty else {
            return chunks
        }
        return chunks.map { chunk in
            let start = chunk.result.start, end = chunk.result.end
            let empty = start == end
            var shiftBefore = 0, endDelta = 0
            var newStart: Int?
            var edited = chunk.edited
            for edit in edits {
                if edit.endLine < start {
                    shiftBefore += edit.delta
                    endDelta += edit.delta
                    continue
                }
                let after = empty ? edit.startLine >= start : edit.startLine >= end
                if after {
                    continue
                }
                if newStart == nil && edit.startLine < start {
                    newStart = edit.startLine + shiftBefore
                }
                endDelta += edit.delta
                edited = true
            }
            let mappedStart = newStart ?? start + shiftBefore
            var mapped = chunk
            mapped.result = LineRange(start: mappedStart, end: max(mappedStart, end + endDelta))
            mapped.edited = edited
            return mapped
        }
    }
}
