// The current app's diff pipeline after the character diff: git's hunks refined to characters inside each hunk
// (src/lib/diff/hunkDiff.ts), CodeMirror's presentation pass (makePresentable) and its chunks (toChunks), so the
// native app marks the same lines and the same changed text.

import Foundation

/// A changed block of whole lines, as CodeMirror's Chunk: line-aligned UTF-16 positions, `to` one past the last
/// line's break, and the character changes inside relative to the chunk's start.
public struct DiffChunk: Equatable, Sendable {
    public let changes: [CharChange]
    public let fromA: Int
    public let toA: Int
    public let fromB: Int
    public let toB: Int
}

public enum DiffChunks {
    /// The chunks the current app's merge view shows for these texts and git hunks.
    public static func build(original: String, modified: String, hunks: [DiffHunk]) -> [DiffChunk] {
        let a = Array(original.utf16), b = Array(modified.utf16)
        var changes = fromHunks(a, b, hunks) ?? CharDiff.diff(a, b, scanLimit: 500)
        Presentable.apply(&changes, a, b)
        return toChunks(changes, LineTable(a), LineTable(b))
    }

    /// hunkDiff.ts changesFromHunks: CodeMirror's diff inside each hunk; nil when the hunks do not fit the texts.
    static func fromHunks(_ a: Units, _ b: Units, _ hunks: [DiffHunk]) -> [CharChange]? {
        let startsA = LineTable(a).starts, startsB = LineTable(b).starts
        var changes: [CharChange] = []
        var lastA = 0, lastB = 0, changedA = 0, changedB = 0
        for hunk in hunks {
            let valid = hunk.oldStart <= hunk.oldEnd && hunk.newStart <= hunk.newEnd
                && hunk.oldEnd <= startsA.count && hunk.newEnd <= startsB.count
                && (hunk.oldStart < hunk.oldEnd || hunk.newStart < hunk.newEnd)
                && (hunk.oldEnd == startsA.count) == (hunk.newEnd == startsB.count)
            guard valid else {
                return nil
            }
            var fromA = hunk.oldStart < startsA.count ? startsA[hunk.oldStart] : a.count
            var fromB = hunk.newStart < startsB.count ? startsB[hunk.newStart] : b.count
            if hunk.oldStart == startsA.count && hunk.newStart > 0 {
                fromB = startsB[hunk.newStart] - 1
            } else if hunk.newStart == startsB.count && hunk.oldStart > 0 {
                fromA = startsA[hunk.oldStart] - 1
            }
            let toA = hunk.oldEnd < startsA.count ? startsA[hunk.oldEnd] : a.count
            let toB = hunk.newEnd < startsB.count ? startsB[hunk.newEnd] : b.count
            guard fromA >= lastA, fromB >= lastB, toA >= fromA, toB >= fromB else {
                return nil
            }
            let inner = CharDiff.diff(Array(a[fromA..<toA]), Array(b[fromB..<toB]), scanLimit: 500)
            changes += inner.map { $0.offset(fromA, fromB) }
            changedA += toA - fromA
            changedB += toB - fromB
            lastA = toA
            lastB = toB
        }
        return a.count - changedA == b.count - changedB ? changes : nil
    }

    /// CodeMirror's toChunks: each change widened to whole lines, changes on touching lines in one chunk.
    static func toChunks(_ changes: [CharChange], _ a: LineTable, _ b: LineTable) -> [DiffChunk] {
        func fromLine(_ fromA: Int, _ fromB: Int) -> (Int, Int) {
            let lineA = a.line(at: fromA), lineB = b.line(at: fromB)
            return lineA.to == fromA && lineB.to == fromB && fromA < a.length && fromB < b.length
                ? (fromA + 1, fromB + 1) : (lineA.from, lineB.from)
        }
        func toLine(_ toA: Int, _ toB: Int) -> (Int, Int) {
            let lineA = a.line(at: toA), lineB = b.line(at: toB)
            return lineA.from == toA && lineB.from == toB ? (toA, toB) : (lineA.to + 1, lineB.to + 1)
        }
        var chunks: [DiffChunk] = []
        var index = 0
        while index < changes.count {
            let change = changes[index]
            let (fromA, fromB) = fromLine(change.fromA, change.fromB)
            var (toA, toB) = toLine(change.toA, change.toB)
            var inner = [change.offset(-fromA, -fromB)]
            while index < changes.count - 1 {
                let next = changes[index + 1]
                let (nextA, nextB) = fromLine(next.fromA, next.fromB)
                if nextA > toA + 1 && nextB > toB + 1 {
                    break
                }
                inner.append(next.offset(-fromA, -fromB))
                (toA, toB) = toLine(next.toA, next.toB)
                index += 1
            }
            chunks.append(DiffChunk(changes: inner, fromA: fromA, toA: max(fromA, toA), fromB: fromB,
                                    toB: max(fromB, toB)))
            index += 1
        }
        return chunks
    }
}

/// Line starts of a text in UTF-16 units, for CodeMirror's `lineAt`.
struct LineTable {
    let starts: [Int]
    let length: Int

    init(_ units: Units) {
        var starts = [0]
        for (index, unit) in units.enumerated() where unit == 10 {
            starts.append(index + 1)
        }
        self.starts = starts
        length = units.count
    }

    /// The 0-based line holding `position`, with its start and end (before its break).
    func line(at position: Int) -> (number: Int, from: Int, to: Int) {
        var low = 0, high = starts.count - 1
        while low < high {
            let middle = (low + high + 1) / 2
            if starts[middle] <= position {
                low = middle
            } else {
                high = middle - 1
            }
        }
        let to = low + 1 < starts.count ? starts[low + 1] - 1 : length
        return (low, starts[low], to)
    }
}
