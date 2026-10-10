// Cursor motion as CodeMirror's view does it for unwrapped monospaced text (moveByChar, moveByGroup,
// moveVertically, moveToLineBoundary in @codemirror/view and moveByLineBoundary in @codemirror/commands): by
// grapheme, by word group, by row (a folded block is one row and a fold is stepped over whole), to a line's ends.
// Columns count character cells, a tab to the next tab stop, as the canvas draws them.

import Foundation

public struct EditorMotion {
    public let state: EditorState
    public let layout: FoldLayout

    public init(_ state: EditorState) {
        self.state = state
        layout = FoldLayout(folds: state.folds, doc: state.doc)
    }

    var doc: TextDocument {
        state.doc
    }

    /// The fold whose inside `position` is in (from < position < to), or which starts or ends at it.
    func fold(around position: Int, forward: Bool) -> CodeFold? {
        state.folds.first { forward ? $0.from == position : $0.to == position }
    }

    /// One step (a cluster, a line break or a whole fold) from `position`, with the text stepped over; nil at the
    /// document's edge.
    func step(_ position: Int, forward: Bool) -> (position: Int, text: String)? {
        if let fold = fold(around: position, forward: forward) {
            return (forward ? fold.to : fold.from, "\u{FFFC}")
        }
        let line = doc.lineAt(position)
        if position == (forward ? line.to : line.from) {
            if line.index == (forward ? doc.lineCount - 1 : 0) {
                return nil
            }
            return (forward ? position + 1 : position - 1, "\n")
        }
        let next = line.from + TextUnits.clusterBreak(line.text, position - line.from, forward: forward)
        let text = TextDocument.utf16Slice(line.text, min(position, next) - line.from, max(position, next) - line.from)
        return (next, text)
    }

    /// moveByChar: one step, or with `by` as long as its check accepts the next step's text.
    public func moveByChar(_ range: SelectionRange, forward: Bool,
                           by: ((String) -> (String) -> Bool)? = nil) -> SelectionRange {
        var current = range.head
        var check: ((String) -> Bool)?
        while let next = step(current, forward: forward) {
            if check == nil {
                guard let by else {
                    return .cursor(next.position, assoc: forward ? -1 : 1)
                }
                check = by(next.text)
            } else if !(check?(next.text) ?? false) {
                return .cursor(current, assoc: forward ? -1 : 1)
            }
            current = next.position
        }
        return .cursor(current, assoc: forward ? -1 : 1)
    }

    /// moveByGroup: over a run of word characters, or other characters, after any spaces (byGroup).
    public func moveByGroup(_ range: SelectionRange, forward: Bool) -> SelectionRange {
        moveByChar(range, forward: forward) { first in
            var category = state.category(first)
            return { next in
                let nextCategory = state.category(next)
                if category == .space {
                    category = nextCategory
                }
                return category == nextCategory
            }
        }
    }

    // MARK: - Rows

    /// The visual column of `position` in its row (a fold's placeholder counts `placeholderColumns`).
    public func column(of position: Int) -> Int {
        let line = doc.lineAt(position)
        let row = layout.row(forLine: line.index)
        let first = doc.line(layout.lines(forRow: row).lowerBound)
        var column = 0, cursor = first.from
        for fold in layout.group(forLine: first.index)?.folds ?? [] where fold.from <= position {
            if position < fold.to {
                return column + TextUnits.countColumn(doc.slice(cursor, position), tabSize: state.config.tabSize)
            }
            column += TextUnits.countColumn(doc.slice(cursor, fold.from), tabSize: state.config.tabSize)
                + Self.placeholderColumns
            cursor = fold.to
        }
        return column + TextUnits.countColumn(doc.slice(cursor, position), tabSize: state.config.tabSize)
    }

    /// The fold placeholder's width in character cells, for vertical motion.
    public static let placeholderColumns = 3

    /// The position at visual `column` of row `row`.
    public func position(row: Int, column goal: Int) -> Int {
        let lines = layout.lines(forRow: row)
        let first = doc.line(lines.lowerBound)
        var column = 0, cursor = first.from
        for fold in layout.group(forLine: first.index)?.folds ?? [] {
            let before = doc.slice(cursor, fold.from)
            let width = TextUnits.countColumn(before, tabSize: state.config.tabSize)
            if goal <= column + width {
                let found = TextUnits.findColumn(before, column: goal - column, tabSize: state.config.tabSize)
                return cursor + (found ?? 0)
            }
            column += width + Self.placeholderColumns
            if goal < column {
                return goal - (column - Self.placeholderColumns) < Self.placeholderColumns / 2 + 1 ? fold.from : fold.to
            }
            cursor = fold.to
        }
        let rest = doc.slice(cursor, doc.line(lines.upperBound).to)
        return cursor + (TextUnits.findColumn(rest, column: goal - column, tabSize: state.config.tabSize) ?? 0)
    }

    /// moveVertically: `rows` rows up or down at the range's goal column; past the first or last row, the document's
    /// start or end.
    public func moveVertically(_ range: SelectionRange, forward: Bool, rows: Int = 1) -> SelectionRange {
        let goal = range.goalColumn ?? column(of: range.head)
        let row = layout.row(forLine: doc.lineAt(range.head).index) + (forward ? rows : -rows)
        if row < 0 {
            return .cursor(0, assoc: 1, goalColumn: goal)
        }
        if row >= layout.rowCount {
            return .cursor(doc.length, assoc: -1, goalColumn: goal)
        }
        return .cursor(position(row: row, column: goal), assoc: forward ? -1 : 1, goalColumn: goal)
    }

    /// The start or end of the row holding `range`'s head (moveToLineBoundary without wrapping).
    public func moveToLineBoundary(_ range: SelectionRange, forward: Bool) -> SelectionRange {
        let block = state.lineBlock(at: range.head)
        return .cursor(forward ? block.to : block.from, assoc: forward ? -1 : 1)
    }

    /// moveByLineBoundary: Home and End; going back from past the indentation stops at its end first.
    public func moveByLineBoundary(_ range: SelectionRange, forward: Bool) -> SelectionRange {
        let block = state.lineBlock(at: range.head)
        var moved = moveToLineBoundary(range, forward: forward)
        if !forward && moved.head == block.from && block.to > block.from {
            let text = doc.slice(block.from, min(block.from + 100, block.to))
            let space = TextUnits.indentation(text).utf16.count
            if space > 0 && range.head != block.from + space {
                moved = .cursor(block.from + space)
            }
        }
        return moved
    }
}
