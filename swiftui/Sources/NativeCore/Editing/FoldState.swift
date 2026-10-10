// Folding as @codemirror/language keeps it: the folded ranges (foldState), mapped through every change, cleared
// when a deletion touches them or the main cursor lands inside one; foldCode, unfoldCode, foldAll, unfoldAll and
// the fold gutter's click. Which lines can fold comes from `FoldRanges` (the syntax tree's answer, or brackets).

import Foundation

public struct CodeFold: Equatable, Sendable {
    public var from: Int
    public var to: Int

    public init(from: Int, to: Int) {
        self.from = from
        self.to = to
    }
}

public enum FoldState {
    static func update(_ folds: [CodeFold], transaction: Transaction) -> [CodeFold] {
        var folded = folds
        if transaction.isUserEvent("delete") {
            transaction.changes.iterChanges { fromA, toA, _, _, _ in
                folded = clearTouched(folded, fromA, toA)
            }
        }
        let changes = transaction.changes
        if !changes.isEmpty {
            folded = folded.compactMap { fold in
                let from = changes.map(fold.from, assoc: 1), to = changes.map(fold.to, assoc: -1)
                return from < to ? CodeFold(from: from, to: to) : nil
            }
        }
        for effect in transaction.effects {
            switch effect {
            case .fold(let from, let to):
                if !folded.contains(CodeFold(from: from, to: to)) {
                    folded.append(CodeFold(from: from, to: to))
                }
            case .unfold(let from, let to):
                folded.removeAll { $0.from == from && $0.to == to }
            case .closeBracket:
                break
            }
        }
        folded.sort { $0.from != $1.from ? $0.from < $1.from : $0.to > $1.to }
        if let selection = transaction.selection {
            folded = clearTouched(folded, selection.main.head)
        }
        return folded
    }

    /// Drops the folds that overlap `from` to `to` (strictly, as clearTouchedFolds).
    static func clearTouched(_ folds: [CodeFold], _ from: Int, _ to: Int? = nil) -> [CodeFold] {
        let end = to ?? from
        return folds.filter { $0.from >= end || $0.to <= from }
    }

    /// The fold touching `from` to `to` that starts first (findFold).
    public static func find(_ folds: [CodeFold], from: Int, to: Int) -> CodeFold? {
        folds.filter { $0.from <= to && $0.to >= from }.min { $0.from < $1.from }
    }
}

extension EditorState {
    /// The document lines of the visual line holding `position` (lineBlockAt): a line and every line a fold
    /// starting on it joins to it.
    public func lineBlock(at position: Int) -> (from: Int, to: Int) {
        let layout = FoldLayout(folds: folds, doc: doc)
        let row = layout.row(forLine: doc.lineAt(position).index)
        let lines = layout.lines(forRow: row)
        return (doc.line(lines.lowerBound).from, doc.line(lines.upperBound).to)
    }

    /// The lines of each range's head, once each (selectedLines).
    func selectedBlocks() -> [(from: Int, to: Int)] {
        var blocks: [(from: Int, to: Int)] = []
        for range in selection.ranges where !blocks.contains(where: { $0.from <= range.head && $0.to >= range.head }) {
            blocks.append(lineBlock(at: range.head))
        }
        return blocks
    }

    /// Code > Collapse: folds the first foldable line of the selection.
    public func foldCode(_ ranges: FoldRanges) -> TransactionSpec? {
        for block in selectedBlocks() {
            if let range = ranges.foldable(self, lineStart: block.from, lineEnd: block.to) {
                return TransactionSpec(effects: [.fold(from: range.from, to: range.to)])
            }
        }
        return nil
    }

    /// Code > Expand: unfolds the folds on the selected lines.
    public func unfoldCode() -> TransactionSpec? {
        let effects: [EditorEffect] = selectedBlocks().compactMap { block in
            FoldState.find(folds, from: block.from, to: block.to).map { .unfold(from: $0.from, to: $0.to) }
        }
        return effects.isEmpty ? nil : TransactionSpec(effects: effects)
    }

    /// Code > Collapse All: every top-level foldable range.
    public func foldAll(_ ranges: FoldRanges) -> TransactionSpec? {
        var effects: [EditorEffect] = [], position = 0
        while position < doc.length {
            let block = lineBlock(at: position)
            let range = ranges.foldable(self, lineStart: block.from, lineEnd: block.to)
            if let range {
                effects.append(.fold(from: range.from, to: range.to))
            }
            position = (range.map { lineBlock(at: $0.to) } ?? block).to + 1
        }
        return effects.isEmpty ? nil : TransactionSpec(effects: effects)
    }

    public func unfoldAll() -> TransactionSpec? {
        folds.isEmpty ? nil : TransactionSpec(effects: folds.map { .unfold(from: $0.from, to: $0.to) })
    }

    /// A click on the fold gutter beside the line at `lineStart`: unfolds its fold, or folds it.
    public func toggleFoldGutter(lineStart: Int, lineEnd: Int, _ ranges: FoldRanges) -> TransactionSpec? {
        if let folded = FoldState.find(folds, from: lineStart, to: lineEnd) {
            return TransactionSpec(effects: [.unfold(from: folded.from, to: folded.to)])
        }
        if let range = ranges.foldable(self, lineStart: lineStart, lineEnd: lineEnd) {
            return TransactionSpec(effects: [.fold(from: range.from, to: range.to)])
        }
        return nil
    }
}
