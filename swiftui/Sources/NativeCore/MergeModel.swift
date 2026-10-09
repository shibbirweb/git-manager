// The 3-way merge's resolution state, ported from src/lib/merge/model.ts: chunk bookkeeping and the line edits that
// apply or ignore a side. The result is a list of lines (CodeMirror's document joined by "\n"), so every action
// returns the next lines with the next chunks, and undo keeps both together. No view code here.

import Foundation

/// Half-open range of 0-based line indexes (src-tauri/src/merge/model.rs LineRange).
public struct LineRange: Equatable, Hashable, Sendable, Codable {
    public var start: Int
    public var end: Int

    public init(start: Int, end: Int) {
        self.start = start
        self.end = end
    }

    public var count: Int {
        end - start
    }

    public var isEmpty: Bool {
        start >= end
    }
}

public enum ChunkKind: String, Equatable, Sendable, Codable {
    case oursOnly
    case theirsOnly
    case bothSame
    case conflict
}

/// One chunk as the engine (src-tauri/src/merge/engine.rs) finds it.
public struct MergeChunk: Equatable, Sendable, Codable {
    public let id: Int
    public let kind: ChunkKind
    public let base: LineRange
    public let ours: LineRange
    public let theirs: LineRange

    public init(id: Int, kind: ChunkKind, base: LineRange, ours: LineRange, theirs: LineRange) {
        self.id = id
        self.kind = kind
        self.base = base
        self.ours = ours
        self.theirs = theirs
    }
}

public enum MergeSide: String, Equatable, Sendable {
    case ours
    case theirs

    public var other: MergeSide {
        self == .ours ? .theirs : .ours
    }
}

public enum ChangeType: String, Equatable, Sendable {
    case added
    case deleted
    case modified
    case conflict
}

public struct ChunkState: Equatable, Sendable {
    public let id: Int
    public let kind: ChunkKind
    public let base: LineRange
    public let ours: LineRange
    public let theirs: LineRange
    /// Lines this chunk occupies in the result now.
    public var result: LineRange
    /// The left (ours) side was applied or ignored.
    public var oursDone: Bool
    /// The right (theirs) side was applied or ignored.
    public var theirsDone: Bool
    /// The result already holds one applied side; the next apply appends.
    public var applied = false
    /// The user typed inside the chunk.
    public var edited = false

    public init(_ chunk: MergeChunk) {
        id = chunk.id
        kind = chunk.kind
        base = chunk.base
        ours = chunk.ours
        theirs = chunk.theirs
        result = chunk.base
        oursDone = chunk.kind == .theirsOnly
        theirsDone = chunk.kind == .oursOnly
    }

    public var isResolved: Bool {
        oursDone && theirsDone
    }

    public func done(_ side: MergeSide) -> Bool {
        side == .ours ? oursDone : theirsDone
    }

    public func range(_ side: MergeSide) -> LineRange {
        side == .ours ? ours : theirs
    }

    /// Whether a side introduced a change in this chunk (so it gets a connector).
    public func changed(_ side: MergeSide) -> Bool {
        switch kind {
        case .conflict, .bothSame:
            return true
        case .oursOnly:
            return side == .ours
        case .theirsOnly:
            return side == .theirs
        }
    }

    /// How a side's lines differ from the base, for coloring.
    public func changeType(_ side: MergeSide) -> ChangeType {
        if kind == .conflict {
            return .conflict
        }
        if base.isEmpty {
            return .added
        }
        if range(side).isEmpty {
            return .deleted
        }
        return .modified
    }

    /// The color of the chunk in the result pane.
    public var resultChangeType: ChangeType {
        changeType(kind == .theirsOnly ? .theirs : .ours)
    }

    /// Marks `side` handled; an identical change on both sides resolves both at once.
    mutating func markDone(_ side: MergeSide) {
        let both = kind == .bothSame
        oursDone = oursDone || both || side == .ours
        theirsDone = theirsDone || both || side == .theirs
    }
}

/// The result after an action: its lines and the chunks.
public struct MergeAction: Equatable, Sendable {
    public let lines: [String]
    public let chunks: [ChunkState]
}

public enum MergeModel {
    public static func initialChunks(_ chunks: [MergeChunk]) -> [ChunkState] {
        chunks.map(ChunkState.init)
    }

    /// Applies one side of a chunk. The first apply replaces the base lines; a second apply on a conflict appends
    /// the other side.
    public static func applySide(
        _ lines: [String], chunks: [ChunkState], chunkId: Int, side: MergeSide, sides: MergeSides
    ) -> MergeAction? {
        guard let index = chunks.firstIndex(where: { $0.id == chunkId }), !chunks[index].done(side) else {
            return nil
        }
        let chunk = chunks[index]
        let inserted = MergeText.slice(sides.lines(side), chunk.range(side))
        let append = chunk.applied && chunk.kind == .conflict
        let target = append ? LineRange(start: chunk.result.end, end: chunk.result.end) : chunk.result
        let next = MergeText.replaceLines(lines, target, with: inserted)
        var state = chunk
        state.result = LineRange(
            start: chunk.result.start, end: (append ? chunk.result.end : chunk.result.start) + inserted.count
        )
        state.markDone(side)
        state.applied = true
        var nextChunks = chunks
        nextChunks[index] = state
        shift(&nextChunks, after: index, by: state.result.count - chunk.result.count)
        return MergeAction(lines: next, chunks: nextChunks)
    }

    /// Marks one side handled without changing the result.
    public static func ignoreSide(_ lines: [String], chunks: [ChunkState], chunkId: Int, side: MergeSide)
        -> MergeAction? {
        guard let index = chunks.firstIndex(where: { $0.id == chunkId }) else {
            return nil
        }
        var nextChunks = chunks
        nextChunks[index].markDone(side)
        return MergeAction(lines: lines, chunks: nextChunks)
    }

    /// Applies every unresolved non-conflicting chunk at once; `only` limits it to changes from one side.
    public static func applyNonConflicting(
        _ lines: [String], chunks: [ChunkState], sides: MergeSides, only: MergeSide? = nil
    ) -> MergeAction? {
        var replacements: [(range: LineRange, lines: [String])] = []
        var next: [ChunkState] = []
        var delta = 0
        var previousEnd = -1
        for chunk in chunks {
            var shifted = chunk
            shifted.result = LineRange(start: chunk.result.start + delta, end: chunk.result.end + delta)
            let side: MergeSide? = chunk.kind == .theirsOnly ? .theirs : (chunk.kind == .conflict ? nil : .ours)
            guard let side, !chunk.isResolved, !chunk.edited,
                  only == nil || chunk.kind == .bothSame || only == side,
                  // Manual edits made this chunk touch the previous one; leave it for the user.
                  chunk.result.start >= previousEnd else {
                next.append(shifted)
                continue
            }
            let inserted = MergeText.slice(sides.lines(side), chunk.range(side))
            if !(chunk.result.isEmpty && inserted.isEmpty) {
                replacements.append((chunk.result, inserted))
                previousEnd = chunk.result.end
            }
            let start = chunk.result.start + delta
            shifted.result = LineRange(start: start, end: start + inserted.count)
            shifted.oursDone = true
            shifted.theirsDone = true
            shifted.applied = true
            next.append(shifted)
            delta += inserted.count - chunk.result.count
        }
        let changed = zip(next, chunks).contains { $0.isResolved != $1.isResolved }
        if replacements.isEmpty && !changed {
            return nil
        }
        return MergeAction(lines: MergeText.replacing(lines, replacements), chunks: next)
    }

    /// Replaces the whole result with one side and resolves everything.
    public static func acceptWholeSide(chunks: [ChunkState], sides: MergeSides, side: MergeSide) -> MergeAction {
        let next = chunks.map { chunk -> ChunkState in
            var state = chunk
            state.result = chunk.range(side)
            state.oursDone = true
            state.theirsDone = true
            state.applied = true
            return state
        }
        return MergeAction(lines: sides.lines(side), chunks: next)
    }

    static func shift(_ chunks: inout [ChunkState], after index: Int, by delta: Int) {
        guard delta != 0 else {
            return
        }
        for later in chunks.indices where later > index {
            chunks[later].result = LineRange(
                start: chunks[later].result.start + delta, end: chunks[later].result.end + delta
            )
        }
    }
}

/// The read-only sides' lines.
public struct MergeSides: Equatable, Sendable {
    public let ours: [String]
    public let theirs: [String]

    public init(ours: [String], theirs: [String]) {
        self.ours = ours
        self.theirs = theirs
    }

    public func lines(_ side: MergeSide) -> [String] {
        side == .ours ? ours : theirs
    }
}
