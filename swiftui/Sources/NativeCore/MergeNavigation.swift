// What the merge tool counts, where it scrolls and the marks it draws (src/lib/merge/model.ts, extensions.ts and
// MergeEditor.svelte's status text).

import Foundation

public struct ResolutionCounts: Equatable, Sendable {
    public let changes: Int
    public let conflicts: Int

    public init(changes: Int, conflicts: Int) {
        self.changes = changes
        self.conflicts = conflicts
    }

    /// The toolbar's status: "All changes processed", "3 changes left" or "9 changes left, 2 conflicts".
    public var statusText: String {
        if changes == 0 {
            return "All changes processed"
        }
        let changeText = "\(changes) \(changes == 1 ? "change" : "changes")"
        if conflicts == 0 {
            return "\(changeText) left"
        }
        return "\(changeText) left, \(conflicts) \(conflicts == 1 ? "conflict" : "conflicts")"
    }
}

/// A chunk's lines in one pane, with its color (extensions.ts LineMark).
public struct MergeLineMark: Equatable, Sendable {
    public let chunkId: Int
    public let range: LineRange
    public let type: ChangeType

    public init(chunkId: Int, range: LineRange, type: ChangeType) {
        self.chunkId = chunkId
        self.range = range
        self.type = type
    }
}

public enum MergeNavigation {
    public static func unresolvedCounts(_ chunks: [ChunkState]) -> ResolutionCounts {
        var changes = 0, conflicts = 0
        for chunk in chunks where !chunk.isResolved {
            changes += 1
            if chunk.kind == .conflict {
                conflicts += 1
            }
        }
        return ResolutionCounts(changes: changes, conflicts: conflicts)
    }

    /// Unresolved chunks Apply non-conflicting can take.
    public static func nonConflictingCount(_ chunks: [ChunkState]) -> Int {
        chunks.filter { !$0.isResolved && $0.kind != .conflict && !$0.edited }.count
    }

    /// The marks of the result pane: every unresolved chunk.
    public static func resultMarks(_ chunks: [ChunkState]) -> [MergeLineMark] {
        chunks.filter { !$0.isResolved }.map {
            MergeLineMark(chunkId: $0.id, range: $0.result, type: $0.resultChangeType)
        }
    }

    /// The marks of a side pane: the chunks that side changed and has not handled yet.
    public static func sideMarks(_ chunks: [ChunkState], side: MergeSide) -> [MergeLineMark] {
        chunks.filter { $0.changed(side) && !$0.done(side) }.map {
            MergeLineMark(chunkId: $0.id, range: $0.range(side), type: $0.changeType(side))
        }
    }

    public typealias Anchor = (source: Double, target: Double)

    /// Line anchors mapping a side pane to the result pane.
    public static func sideToResultAnchors(
        _ chunks: [ChunkState], side: MergeSide, sideLines: Int, resultLines: Int
    ) -> [Anchor] {
        var anchors: [Anchor] = [(0, 0)]
        for chunk in chunks {
            let range = chunk.range(side)
            anchors.append((Double(range.start), Double(chunk.result.start)))
            anchors.append((Double(range.end), Double(chunk.result.end)))
        }
        anchors.append((Double(sideLines), Double(resultLines)))
        return anchors
    }

    public static func invert(_ anchors: [Anchor]) -> [Anchor] {
        anchors.map { ($0.target, $0.source) }
    }

    /// Piecewise-linear mapping of a fractional line position through anchors.
    public static func mapLine(_ position: Double, _ anchors: [Anchor]) -> Double {
        guard var lower = anchors.first, var upper = anchors.last else {
            return position
        }
        for anchor in anchors {
            if anchor.source <= position {
                lower = anchor
            }
            if anchor.source >= position {
                upper = anchor
                break
            }
        }
        let span = upper.source - lower.source
        if span <= 0 {
            return lower.target
        }
        return lower.target + (position - lower.source) * (upper.target - lower.target) / span
    }

    /// The next (or previous) unresolved chunk from a result line, wrapping around.
    public static func findUnresolved(_ chunks: [ChunkState], fromLine: Int, direction: Int) -> ChunkState? {
        let open = chunks.filter { !$0.isResolved }
        guard !open.isEmpty else {
            return nil
        }
        if direction > 0 {
            return open.first { $0.result.start > fromLine } ?? open[0]
        }
        return open.last { $0.result.start < fromLine } ?? open[open.count - 1]
    }
}
