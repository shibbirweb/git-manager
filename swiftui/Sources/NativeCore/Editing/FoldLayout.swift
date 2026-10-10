// How folds turn document lines into the editor's rows: a fold from one line into a later one joins those lines into
// the first one's row (CodeMirror's line block), and folds that end on the line where the next starts chain into one
// row. Rows and lines map both ways by binary search, so a long file with a few folds stays fast. FoldRanges holds
// which ranges can fold: what the current app's syntax tree answers for each line (foldable), kept in step with
// edits until the next answer.

import Foundation

public struct FoldLayout: Sendable {
    public struct Group: Equatable, Sendable {
        public let firstLine: Int
        public let lastLine: Int
        /// The folds drawn in this row, in order (outermost only).
        public let folds: [CodeFold]
    }

    public let groups: [Group]
    public let lineCount: Int
    /// Lines hidden before each group (prefix sums).
    private let hiddenBefore: [Int]

    public init(folds: [CodeFold], doc: TextDocument) {
        var groups: [Group] = []
        var end = -1
        for fold in folds where fold.from >= end {
            end = fold.to
            let first = doc.lineAt(fold.from).index, last = doc.lineAt(fold.to).index
            if let previous = groups.last, first <= previous.lastLine {
                groups[groups.count - 1] = Group(firstLine: previous.firstLine, lastLine: max(last, previous.lastLine),
                                                 folds: previous.folds + [fold])
            } else {
                groups.append(Group(firstLine: first, lastLine: last, folds: [fold]))
            }
        }
        self.groups = groups
        lineCount = doc.lineCount
        var hidden = 0, prefix: [Int] = []
        for group in groups {
            prefix.append(hidden)
            hidden += group.lastLine - group.firstLine
        }
        hiddenBefore = prefix
        rowCount = doc.lineCount - hidden
    }

    public let rowCount: Int

    /// The row showing document line `line` (0-based); a hidden line shows in its fold's row.
    public func row(forLine line: Int) -> Int {
        guard let index = lastGroup(startingAtOrBefore: line) else {
            return line
        }
        let group = groups[index]
        if line <= group.lastLine {
            return group.firstLine - hiddenBefore[index]
        }
        return line - hiddenBefore[index] - (group.lastLine - group.firstLine)
    }

    /// The fold rows at or above row `row`. The page draws a row with a fold placeholder a point lower than its
    /// place and everything below it a point lower too (measured), as if a 1-point gap stood above each such row.
    public func foldRows(through row: Int) -> Int {
        var low = 0, high = groups.count
        while low < high {
            let middle = (low + high) / 2
            if groups[middle].firstLine - hiddenBefore[middle] <= row {
                low = middle + 1
            } else {
                high = middle
            }
        }
        return low
    }

    /// The document lines row `row` shows.
    public func lines(forRow row: Int) -> ClosedRange<Int> {
        var low = 0, high = groups.count - 1, found: Int?
        while low <= high {
            let middle = (low + high) / 2
            if groups[middle].firstLine - hiddenBefore[middle] <= row {
                found = middle
                low = middle + 1
            } else {
                high = middle - 1
            }
        }
        guard let found else {
            return row...row
        }
        let group = groups[found], groupRow = group.firstLine - hiddenBefore[found]
        if row == groupRow {
            return group.firstLine...group.lastLine
        }
        let line = row + hiddenBefore[found] + (group.lastLine - group.firstLine)
        return line...line
    }

    /// The group whose row starts on `line`, if any.
    public func group(forLine line: Int) -> Group? {
        guard let index = lastGroup(startingAtOrBefore: line), groups[index].firstLine == line else {
            return nil
        }
        return groups[index]
    }

    private func lastGroup(startingAtOrBefore line: Int) -> Int? {
        var low = 0, high = groups.count - 1, found: Int?
        while low <= high {
            let middle = (low + high) / 2
            if groups[middle].firstLine <= line {
                found = middle
                low = middle + 1
            } else {
                high = middle - 1
            }
        }
        return found
    }
}

public struct FoldRanges: Equatable, Sendable {
    /// What can fold, sorted by start: for each line the syntax tree folds, the range CodeMirror's foldable gives.
    public private(set) var candidates: [CodeFold]

    public init(_ candidates: [CodeFold] = []) {
        self.candidates = candidates.sorted { $0.from != $1.from ? $0.from < $1.from : $0.to > $1.to }
    }

    /// foldable(state, lineStart, lineEnd): the range starting in the line (block) and ending after it.
    public func foldable(_ state: EditorState, lineStart: Int, lineEnd: Int) -> CodeFold? {
        var low = 0, high = candidates.count
        while low < high {
            let middle = (low + high) / 2
            if candidates[middle].from < lineStart {
                low = middle + 1
            } else {
                high = middle
            }
        }
        var index = low
        while index < candidates.count, candidates[index].from <= lineEnd {
            if candidates[index].to > lineEnd {
                return candidates[index]
            }
            index += 1
        }
        return nil
    }

    /// The ranges after `changes`, until the syntax tree answers again.
    public func mapped(_ changes: ChangeSet) -> FoldRanges {
        if changes.isEmpty {
            return self
        }
        return FoldRanges(candidates.compactMap { range in
            let from = changes.map(range.from, assoc: 1), to = changes.map(range.to, assoc: -1)
            return from < to ? CodeFold(from: from, to: to) : nil
        })
    }
}
