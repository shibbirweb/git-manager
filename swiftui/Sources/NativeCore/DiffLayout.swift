// The rows of a side-by-side diff: which lines each pane shows, which unchanged runs fold away, and the empty space
// that keeps both panes level. Pure logic, tested in NativeCoreTests. The folds follow src/lib/diff/foldModel.ts
// (3 lines kept next to each change, runs under 4 lines never folded), so both apps fold the same lines.

import Foundation

/// A change between the two texts, as the bridge's FileDiff gives it: 0-based, half-open line ranges.
public struct DiffHunk: Equatable, Sendable {
    public let oldStart: Int
    public let oldEnd: Int
    public let newStart: Int
    public let newEnd: Int

    public init(oldStart: Int, oldEnd: Int, newStart: Int, newEnd: Int) {
        self.oldStart = oldStart
        self.oldEnd = oldEnd
        self.newStart = newStart
        self.newEnd = newEnd
    }

    /// From the bridge's `[oldStart, oldEnd, newStart, newEnd]`.
    public init?(_ numbers: [Int]) {
        guard numbers.count == 4 else {
            return nil
        }
        self.init(oldStart: numbers[0], oldEnd: numbers[1], newStart: numbers[2], newEnd: numbers[3])
    }
}

/// A folded run of lines: 1-based and inclusive, like CodeMirror's.
public struct FoldRange: Equatable, Sendable {
    public let first: Int
    public let last: Int

    public init(first: Int, last: Int) {
        self.first = first
        self.last = last
    }

    public var count: Int {
        last - first + 1
    }
}

public enum DiffFold {
    public static let margin = 3
    public static let minSize = 4
    /// Lines one click on a fold's edge shows.
    public static let step = 10

    /// The edges that show lines a step at a time (foldEdges): only edges next to visible code, and only when a
    /// step leaves a fold.
    public static func edges(_ range: FoldRange, lineCount: Int) -> (top: Bool, bottom: Bool) {
        if range.count - step < minSize {
            return (false, false)
        }
        return (range.first > 1, range.last < lineCount)
    }

    /// The unchanged runs to fold in one text, given its changes as (first line, line after), 1-based.
    public static func ranges(changes: [(first: Int, after: Int)], lineCount: Int) -> [FoldRange] {
        var ranges: [FoldRange] = []
        var previous = 1
        for index in 0...changes.count {
            let change = index < changes.count ? changes[index] : nil
            let first = index == 0 ? 1 : previous + margin
            let last = change.map { $0.first - 1 - margin } ?? lineCount
            if last - first + 1 >= minSize {
                ranges.append(FoldRange(first: first, last: last))
            }
            if let change {
                previous = change.after
            }
        }
        return ranges
    }
}

/// One row of a pane.
public enum DiffRow: Equatable, Sendable {
    public enum Kind: Equatable, Sendable {
        case unchanged
        /// Only in this text (an inserted line on the right, a deleted one on the left).
        case added
        case deleted
        /// In a change that has lines on both sides.
        case changed
    }

    /// A line of the text: its 1-based number, its text and how it changed.
    case line(number: Int, text: String, kind: Kind)
    /// Unchanged lines folded away.
    case fold(FoldRange)
    /// Empty space as tall as `lines` lines, where the other pane has lines this one does not.
    case spacer(lines: Int)
}

public struct DiffLayout: Equatable, Sendable {
    public let left: [DiffRow]
    public let right: [DiffRow]
    /// The changed text inside each changed line, by line number: UTF-16 ranges from the line's start
    /// (CodeMirror's cm-changedText; none in a chunk that only adds or only removes lines).
    public let leftMarks: [Int: [Range<Int>]]
    public let rightMarks: [Int: [Range<Int>]]
    /// The chunks as 0-based, half-open line ranges, for the ruler.
    public let lineHunks: [DiffHunk]
    /// Where each line starts in its text, in UTF-16 units (line 1 at index 0), to find its syntax spans.
    public let leftLineStarts: [Int]
    public let rightLineStarts: [Int]
    /// The runs folded in the original text; the modified text folds the same runs.
    public let leftFolds: [FoldRange]

    /// Both panes, level with each other: unchanged lines side by side, each chunk padded on its shorter side, and
    /// the unchanged runs folded. The chunks are CodeMirror's for these texts and git hunks (DiffChunks). `folds`
    /// replaces the original text's default folds once some were opened (DiffFold.reveal).
    public init(
        original: String, modified: String, hunks: [DiffHunk], collapse: Bool = true, folds: [FoldRange]? = nil
    ) {
        let oldLines = DiffLayout.lines(original)
        let newLines = DiffLayout.lines(modified)
        let tableA = LineTable(Array(original.utf16)), tableB = LineTable(Array(modified.utf16))
        let chunks = DiffChunks.build(original: original, modified: modified, hunks: hunks)
        let lineHunks = chunks.map { DiffLayout.lineRange($0, tableA, tableB) }
        // foldField.ts: each chunk's first line and the line at its end, 1-based.
        let leftFolds = !collapse ? [] : folds ?? DiffFold.ranges(changes: chunks.map { chunk in
            (tableA.line(at: min(chunk.fromA, tableA.length)).number + 1,
             tableA.line(at: min(tableA.length, chunk.toA)).number + 1)
        }, lineCount: oldLines.count)
        self.leftFolds = leftFolds
        var left: [DiffRow] = []
        var right: [DiffRow] = []
        var oldIndex = 0
        var newIndex = 0
        func unchanged(until oldEnd: Int) {
            while oldIndex < oldEnd {
                if let fold = leftFolds.first(where: { $0.first == oldIndex + 1 }) {
                    left.append(.fold(fold))
                    let offset = newIndex - oldIndex
                    right.append(.fold(FoldRange(first: fold.first + offset, last: fold.last + offset)))
                    oldIndex += fold.count
                    newIndex += fold.count
                    continue
                }
                left.append(.line(number: oldIndex + 1, text: oldLines[oldIndex], kind: .unchanged))
                right.append(.line(number: newIndex + 1, text: newLines[newIndex], kind: .unchanged))
                oldIndex += 1
                newIndex += 1
            }
        }
        for hunk in lineHunks {
            unchanged(until: hunk.oldStart)
            let oldCount = hunk.oldEnd - hunk.oldStart
            let newCount = hunk.newEnd - hunk.newStart
            let both = oldCount > 0 && newCount > 0
            for index in hunk.oldStart..<hunk.oldEnd {
                left.append(.line(number: index + 1, text: oldLines[index], kind: both ? .changed : .deleted))
            }
            for index in hunk.newStart..<hunk.newEnd {
                right.append(.line(number: index + 1, text: newLines[index], kind: both ? .changed : .added))
            }
            if oldCount < newCount {
                left.append(.spacer(lines: newCount - oldCount))
            } else if newCount < oldCount {
                right.append(.spacer(lines: oldCount - newCount))
            }
            oldIndex = hunk.oldEnd
            newIndex = hunk.newEnd
        }
        unchanged(until: oldLines.count)
        self.left = left
        self.right = right
        self.lineHunks = lineHunks
        leftLineStarts = tableA.starts
        rightLineStarts = tableB.starts
        leftMarks = DiffLayout.marks(chunks, tableA, sideA: true)
        rightMarks = DiffLayout.marks(chunks, tableB, sideA: false)
    }

    /// A chunk's lines on each side; a side without lines starts where the other side's lines go.
    static func lineRange(_ chunk: DiffChunk, _ a: LineTable, _ b: LineTable) -> DiffHunk {
        func range(_ from: Int, _ to: Int, _ table: LineTable) -> (Int, Int) {
            let first = table.line(at: min(from, table.length)).number
            if to <= from {
                return (first, first)
            }
            return (first, table.line(at: min(to - 1, table.length)).number + 1)
        }
        let old = range(chunk.fromA, chunk.toA, a), new = range(chunk.fromB, chunk.toB, b)
        return DiffHunk(oldStart: old.0, oldEnd: old.1, newStart: new.0, newEnd: new.1)
    }

    /// merge's buildChunkDeco: each change clipped to the lines it crosses, skipped where the other side is empty
    /// (the current app hides cm-changedText in added and deleted lines).
    static func marks(_ chunks: [DiffChunk], _ table: LineTable, sideA: Bool) -> [Int: [Range<Int>]] {
        var marks: [Int: [Range<Int>]] = [:]
        for chunk in chunks {
            let from = sideA ? chunk.fromA : chunk.fromB, to = sideA ? chunk.toA : chunk.toB
            let otherEmpty = sideA ? chunk.fromB == chunk.toB : chunk.fromA == chunk.toA
            guard from < to, !otherEmpty else {
                continue
            }
            for change in chunk.changes {
                let start = from + (sideA ? change.fromA : change.fromB)
                let end = from + (sideA ? change.toA : change.toB)
                var position = start
                while position < end, position <= table.length {
                    let line = table.line(at: position)
                    let clippedEnd = min(end, line.to)
                    if clippedEnd > position {
                        marks[line.number + 1, default: []].append((position - line.from)..<(clippedEnd - line.from))
                    }
                    position = line.to + 1
                }
            }
        }
        return marks
    }

    /// The text's lines as CodeMirror numbers them: a final line break starts one more, empty line.
    public static func lines(_ text: String) -> [String] {
        text.components(separatedBy: "\n")
    }

    /// The text with a zero-width non-joiner between symbol characters, so a font's ligatures (<= as one sign)
    /// stay off, as in the current app's editor; the width does not change.
    public static func withoutLigatures(_ text: String) -> String {
        let symbols = Set("<>=!-+*/&|:.~#?%^_$@\\")
        var out = ""
        var previous: Character?
        for character in text {
            if let previous, symbols.contains(previous), symbols.contains(character) {
                out.append("\u{200C}")
            }
            out.append(character)
            previous = character
        }
        return out
    }
}
