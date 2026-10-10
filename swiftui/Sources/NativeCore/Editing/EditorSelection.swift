// Selections as CodeMirror keeps them (@codemirror/state SelectionRange and EditorSelection): one or more ranges,
// each an anchor and a head, sorted and merged where they overlap, one of them the main range. Positions are UTF-16
// offsets into the document.

import Foundation

public struct SelectionRange: Equatable, Sendable {
    public var anchor: Int
    public var head: Int
    /// The column vertical motion aims for (in character cells), kept across up and down moves.
    public var goalColumn: Int?
    /// Which side a cursor sticks to: -1 before, 1 after the position (CodeMirror's assoc).
    public var assoc: Int

    public init(anchor: Int, head: Int, goalColumn: Int? = nil, assoc: Int = 0) {
        self.anchor = anchor
        self.head = head
        self.goalColumn = goalColumn
        self.assoc = assoc
    }

    public static func cursor(_ position: Int, assoc: Int = 0, goalColumn: Int? = nil) -> SelectionRange {
        SelectionRange(anchor: position, head: position, goalColumn: goalColumn, assoc: assoc)
    }

    public static func range(_ anchor: Int, _ head: Int, goalColumn: Int? = nil) -> SelectionRange {
        SelectionRange(anchor: anchor, head: head, goalColumn: goalColumn,
                       assoc: head < anchor ? 1 : head > anchor ? -1 : 0)
    }

    public var from: Int {
        min(anchor, head)
    }

    public var to: Int {
        max(anchor, head)
    }

    public var isEmpty: Bool {
        anchor == head
    }

    /// The range after `changes`, keeping its direction; a cursor follows `assoc`.
    public func map(_ changes: ChangeSet, assoc mapAssoc: Int = -1) -> SelectionRange {
        if isEmpty {
            let position = changes.map(head, assoc: mapAssoc)
            return position == head ? self
                : SelectionRange(anchor: position, head: position, goalColumn: goalColumn, assoc: assoc)
        }
        let newFrom = changes.map(from, assoc: 1), newTo = changes.map(to, assoc: -1)
        if newFrom == from && newTo == to {
            return self
        }
        let forward = head >= anchor
        return SelectionRange(anchor: forward ? newFrom : newTo, head: forward ? newTo : newFrom,
                              goalColumn: goalColumn, assoc: assoc)
    }

    /// Same anchor, head and goal column (and, with `includeAssoc`, the same side): SelectionRange.eq.
    public func sameRange(_ other: SelectionRange, includeAssoc: Bool = false) -> Bool {
        anchor == other.anchor && head == other.head && goalColumn == other.goalColumn
            && (!includeAssoc || !isEmpty || assoc == other.assoc)
    }
}

public struct EditorSelection: Equatable, Sendable {
    public private(set) var ranges: [SelectionRange]
    public private(set) var mainIndex: Int

    public init(_ ranges: [SelectionRange], mainIndex: Int = 0) {
        var position = 0
        for (index, range) in ranges.enumerated() {
            // As in CodeMirror, a leading cursor at 0 also takes the (harmless) normalizing path.
            if index > 0 && (range.isEmpty ? range.from <= position : range.from < position) {
                (self.ranges, self.mainIndex) = Self.normalized(ranges, mainIndex: mainIndex)
                return
            }
            position = range.to
        }
        self.ranges = ranges
        self.mainIndex = min(max(0, mainIndex), max(0, ranges.count - 1))
    }

    public static func single(_ anchor: Int, _ head: Int? = nil) -> EditorSelection {
        EditorSelection([.range(anchor, head ?? anchor)])
    }

    public var main: SelectionRange {
        ranges[mainIndex]
    }

    static func normalized(_ input: [SelectionRange], mainIndex: Int) -> ([SelectionRange], Int) {
        let main = input[mainIndex]
        var ranges = input.enumerated().sorted { left, right in
            left.element.from != right.element.from ? left.element.from < right.element.from
                : left.offset < right.offset
        }.map(\.element)
        var newMain = ranges.firstIndex(of: main) ?? 0
        var index = 1
        while index < ranges.count {
            let range = ranges[index], previous = ranges[index - 1]
            if range.isEmpty ? range.from <= previous.to : range.from < previous.to {
                let from = previous.from, to = max(range.to, previous.to)
                if index <= newMain {
                    newMain -= 1
                }
                let merged: SelectionRange = range.anchor > range.head ? .range(to, from) : .range(from, to)
                ranges.replaceSubrange((index - 1)...index, with: [merged])
                continue
            }
            index += 1
        }
        return (ranges, newMain)
    }

    public func map(_ changes: ChangeSet, assoc: Int = -1) -> EditorSelection {
        if changes.isEmpty {
            return self
        }
        return EditorSelection(ranges.map { $0.map(changes, assoc: assoc) }, mainIndex: mainIndex)
    }

    /// Adds `range`, as the main range when `main`.
    public func adding(_ range: SelectionRange, main: Bool = true) -> EditorSelection {
        EditorSelection([range] + ranges, mainIndex: main ? 0 : mainIndex + 1)
    }

    public func replacing(_ range: SelectionRange, at index: Int? = nil) -> EditorSelection {
        var copy = ranges
        copy[index ?? mainIndex] = range
        return EditorSelection(copy, mainIndex: mainIndex)
    }

    /// The main range alone.
    public var asSingle: EditorSelection {
        ranges.count == 1 ? self : EditorSelection([main])
    }

    /// Same ranges (anchor and head) and main index, as CodeMirror's eq.
    public func sameAs(_ other: EditorSelection, includeAssoc: Bool = false) -> Bool {
        guard ranges.count == other.ranges.count, mainIndex == other.mainIndex else {
            return false
        }
        return zip(ranges, other.ranges).allSatisfy { $0.sameRange($1, includeAssoc: includeAssoc) }
    }

    /// Clamps every range into a document of `length`.
    public func clamped(to length: Int) -> EditorSelection {
        EditorSelection(ranges.map {
            SelectionRange(anchor: min(max(0, $0.anchor), length), head: min(max(0, $0.head), length),
                           goalColumn: $0.goalColumn, assoc: $0.assoc)
        }, mainIndex: mainIndex)
    }
}
