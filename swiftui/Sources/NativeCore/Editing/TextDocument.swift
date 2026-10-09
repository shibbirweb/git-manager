// The editor's text, kept like CodeMirror's Text: lines in chunks of at most 64, with each chunk's first line and
// UTF-16 offset indexed, so finding a line is a binary search and an edit rebuilds only the chunks it touches. A
// value: a copy shares every chunk it does not change, so the undo history and the canvas hold old versions
// cheaply. Offsets and lengths count UTF-16 units and lines are split on "\n" only (the bridge sends LF text).

import Foundation

public struct TextDocument: Equatable, Sendable {
    /// One line of the document: 0-based `index`, its start and end offset (before the line break), its text.
    public struct Line: Equatable, Sendable {
        public let index: Int
        public let from: Int
        public let to: Int
        public let text: String

        public var length: Int {
            to - from
        }

        /// The 1-based line number, as CodeMirror and the status bar count.
        public var number: Int {
            index + 1
        }
    }

    struct Chunk: Equatable, Sendable {
        var lines: [String]
        var lengths: [Int]

        /// The chunk's length with a line break after every line.
        var span: Int {
            lengths.reduce(0, +) + lengths.count
        }
    }

    static let chunkSize = 64

    private(set) var chunks: [Chunk]
    /// Each chunk's first line index and first offset.
    private var firstLines: [Int] = []
    private var firstOffsets: [Int] = []
    public private(set) var length = 0
    public private(set) var lineCount = 0

    public init(_ text: String = "") {
        self.init(lines: text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init))
    }

    public init(lines: [String]) {
        chunks = Self.chunked(lines.isEmpty ? [""] : lines)
        reindex()
    }

    public static func == (left: TextDocument, right: TextDocument) -> Bool {
        left.length == right.length && left.lineCount == right.lineCount && left.string == right.string
    }

    /// The longest line's length, in UTF-16 units.
    public var widestLine: Int {
        chunks.reduce(0) { max($0, $1.lengths.max() ?? 0) }
    }

    /// The same text, compared line by line without joining (CodeMirror's Text.eq).
    public func sameText(_ other: TextDocument) -> Bool {
        guard length == other.length, lineCount == other.lineCount else {
            return false
        }
        return chunks.lazy.flatMap(\.lines).elementsEqual(other.chunks.lazy.flatMap(\.lines))
    }

    public var string: String {
        allLines.joined(separator: "\n")
    }

    public var allLines: [String] {
        chunks.flatMap(\.lines)
    }

    public func line(_ index: Int) -> Line {
        let clamped = min(max(0, index), lineCount - 1)
        let chunkIndex = Self.lastIndex(in: firstLines, notAfter: clamped)
        let chunk = chunks[chunkIndex]
        var from = firstOffsets[chunkIndex]
        let inner = clamped - firstLines[chunkIndex]
        for position in 0..<inner {
            from += chunk.lengths[position] + 1
        }
        return Line(index: clamped, from: from, to: from + chunk.lengths[inner], text: chunk.lines[inner])
    }

    /// The line holding `offset` (a line's end belongs to it, not to the next line).
    public func lineAt(_ offset: Int) -> Line {
        let clamped = min(max(0, offset), length)
        let chunkIndex = Self.lastIndex(in: firstOffsets, notAfter: clamped)
        let chunk = chunks[chunkIndex]
        var from = firstOffsets[chunkIndex]
        for inner in chunk.lines.indices {
            let to = from + chunk.lengths[inner]
            if clamped <= to || inner == chunk.lines.count - 1 {
                return Line(index: firstLines[chunkIndex] + inner, from: from, to: to, text: chunk.lines[inner])
            }
            from = to + 1
        }
        return line(lineCount - 1)
    }

    /// The text from `from` to `to`, with "\n" between lines.
    public func slice(_ from: Int, _ to: Int) -> String {
        let start = max(0, min(from, to)), end = min(length, max(from, to))
        guard start < end else {
            return ""
        }
        let first = lineAt(start), last = lineAt(end)
        if first.index == last.index {
            return Self.utf16Slice(first.text, start - first.from, end - first.from)
        }
        var parts = [Self.utf16Slice(first.text, start - first.from, first.length)]
        if last.index > first.index + 1 {
            for index in (first.index + 1)..<last.index {
                parts.append(line(index).text)
            }
        }
        parts.append(Self.utf16Slice(last.text, 0, end - last.from))
        return parts.joined(separator: "\n")
    }

    /// Replaces `from` to `to` with `text` (which may hold line breaks).
    public mutating func replace(_ from: Int, _ to: Int, with text: String) {
        let first = lineAt(from), last = lineAt(to)
        let head = Self.utf16Slice(first.text, 0, from - first.from)
        let tail = Self.utf16Slice(last.text, to - last.from, last.length)
        var inserted = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        inserted[0] = head + inserted[0]
        inserted[inserted.count - 1] += tail
        replaceLines(first.index...last.index, with: inserted)
    }

    public func replacing(_ from: Int, _ to: Int, with text: String) -> TextDocument {
        var copy = self
        copy.replace(from, to, with: text)
        return copy
    }

    /// Lines `range` (0-based) as strings.
    public func lines(_ range: Range<Int>) -> [String] {
        range.clamped(to: 0..<lineCount).map { line($0).text }
    }

    // MARK: - Chunks

    private mutating func replaceLines(_ range: ClosedRange<Int>, with newLines: [String]) {
        let firstChunk = Self.lastIndex(in: firstLines, notAfter: range.lowerBound)
        let lastChunk = Self.lastIndex(in: firstLines, notAfter: range.upperBound)
        var merged: [String] = []
        let before = range.lowerBound - firstLines[firstChunk]
        merged.append(contentsOf: chunks[firstChunk].lines[0..<before])
        merged.append(contentsOf: newLines)
        let after = range.upperBound - firstLines[lastChunk] + 1
        merged.append(contentsOf: chunks[lastChunk].lines[after...])
        chunks.replaceSubrange(firstChunk...lastChunk, with: Self.chunked(merged))
        reindex()
    }

    private static func chunked(_ lines: [String]) -> [Chunk] {
        guard !lines.isEmpty else {
            return []
        }
        var result: [Chunk] = []
        result.reserveCapacity(lines.count / chunkSize + 1)
        var start = 0
        while start < lines.count {
            let end = min(lines.count, start + chunkSize)
            let part = Array(lines[start..<end])
            result.append(Chunk(lines: part, lengths: part.map { $0.utf16.count }))
            start = end
        }
        return result
    }

    private mutating func reindex() {
        firstLines.removeAll(keepingCapacity: true)
        firstOffsets.removeAll(keepingCapacity: true)
        var line = 0, offset = 0
        for chunk in chunks {
            firstLines.append(line)
            firstOffsets.append(offset)
            line += chunk.lines.count
            offset += chunk.span
        }
        lineCount = line
        length = offset - 1
    }

    /// The last index whose value is at most `value` in an ascending array (0 when none is).
    static func lastIndex(in values: [Int], notAfter value: Int) -> Int {
        var low = 0, high = values.count - 1
        while low < high {
            let middle = (low + high + 1) / 2
            if values[middle] <= value {
                low = middle
            } else {
                high = middle - 1
            }
        }
        return low
    }

    /// `text`'s UTF-16 units `from` to `to`, clamped.
    public static func utf16Slice(_ text: String, _ from: Int, _ to: Int) -> String {
        let units = text.utf16
        let start = max(0, min(from, units.count)), end = max(start, min(to, units.count))
        if start == 0 && end == units.count {
            return text
        }
        let lower = units.index(units.startIndex, offsetBy: start)
        let upper = units.index(lower, offsetBy: end - start)
        if let sliced = String(units[lower..<upper]) {
            return sliced
        }
        return String(decoding: Array(units[lower..<upper]), as: UTF16.self)
    }
}
