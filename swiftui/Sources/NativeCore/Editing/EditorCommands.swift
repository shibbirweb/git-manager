// The cursor and selection commands of CodeMirror's standard and default keymaps (@codemirror/commands): each
// takes the state and returns the transaction to dispatch, or nil when it changes nothing (a command that returns
// false in CodeMirror). Left and right are forward and backward: the editor is left to right.

import Foundation

public enum EditorCommands {
    static func updateSelection(_ state: EditorState, _ how: (SelectionRange) -> SelectionRange) -> EditorSelection {
        EditorSelection(state.selection.ranges.map(how), mainIndex: state.selection.mainIndex)
    }

    static func setSelection(_ selection: EditorSelection) -> TransactionSpec {
        TransactionSpec(selection: selection, userEvent: "select", scrollIntoView: true)
    }

    /// moveSel: nil when the selection would not change.
    static func move(_ state: EditorState, _ how: (SelectionRange) -> SelectionRange) -> TransactionSpec? {
        let selection = updateSelection(state, how)
        return selection.sameAs(state.selection, includeAssoc: true) ? nil : setSelection(selection)
    }

    static func rangeEnd(_ range: SelectionRange, forward: Bool) -> SelectionRange {
        .cursor(forward ? range.to : range.from)
    }

    /// extendSel: moves each head, keeping its anchor.
    static func extend(_ state: EditorState, _ how: (SelectionRange) -> SelectionRange) -> TransactionSpec? {
        move(state) { range in
            let head = how(range)
            return SelectionRange(anchor: range.anchor, head: head.head, goalColumn: head.goalColumn,
                                  assoc: head.assoc)
        }
    }

    // MARK: - By character and group

    public static func cursorChar(_ state: EditorState, forward: Bool) -> TransactionSpec? {
        let motion = EditorMotion(state)
        return move(state) { $0.isEmpty ? motion.moveByChar($0, forward: forward) : rangeEnd($0, forward: forward) }
    }

    public static func selectChar(_ state: EditorState, forward: Bool) -> TransactionSpec? {
        let motion = EditorMotion(state)
        return extend(state) { motion.moveByChar($0, forward: forward) }
    }

    public static func cursorGroup(_ state: EditorState, forward: Bool) -> TransactionSpec? {
        let motion = EditorMotion(state)
        return move(state) { $0.isEmpty ? motion.moveByGroup($0, forward: forward) : rangeEnd($0, forward: forward) }
    }

    public static func selectGroup(_ state: EditorState, forward: Bool) -> TransactionSpec? {
        let motion = EditorMotion(state)
        return extend(state) { motion.moveByGroup($0, forward: forward) }
    }

    // MARK: - By line and page

    public static func cursorLine(_ state: EditorState, forward: Bool, rows: Int = 1) -> TransactionSpec? {
        let motion = EditorMotion(state)
        return move(state) { range in
            if !range.isEmpty {
                return rangeEnd(range, forward: forward)
            }
            let moved = motion.moveVertically(range, forward: forward, rows: rows)
            return moved.head != range.head ? moved : motion.moveToLineBoundary(range, forward: forward)
        }
    }

    public static func selectLine(_ state: EditorState, forward: Bool, rows: Int = 1) -> TransactionSpec? {
        let motion = EditorMotion(state)
        return extend(state) { motion.moveVertically($0, forward: forward, rows: rows) }
    }

    /// cursorPageUp / cursorPageDown: a page of `rows` rows.
    public static func cursorPage(_ state: EditorState, forward: Bool, rows: Int) -> TransactionSpec? {
        let motion = EditorMotion(state)
        let selection = updateSelection(state) { range in
            range.isEmpty ? motion.moveVertically(range, forward: forward, rows: max(1, rows))
                : rangeEnd(range, forward: forward)
        }
        return selection.sameAs(state.selection) ? nil : setSelection(selection)
    }

    public static func selectPage(_ state: EditorState, forward: Bool, rows: Int) -> TransactionSpec? {
        let motion = EditorMotion(state)
        return extend(state) { motion.moveVertically($0, forward: forward, rows: max(1, rows)) }
    }

    // MARK: - Line boundaries and the document

    /// Home, End, Cmd+Left and Cmd+Right (cursorLineBoundaryBackward/Forward/Left/Right).
    public static func cursorLineBoundary(_ state: EditorState, forward: Bool) -> TransactionSpec? {
        let motion = EditorMotion(state)
        return move(state) { motion.moveByLineBoundary($0, forward: forward) }
    }

    public static func selectLineBoundary(_ state: EditorState, forward: Bool) -> TransactionSpec? {
        let motion = EditorMotion(state)
        return extend(state) { motion.moveByLineBoundary($0, forward: forward) }
    }

    /// Ctrl+A and Ctrl+E (cursorLineStart / cursorLineEnd), and with Shift selectLineStart / selectLineEnd.
    public static func cursorLineEdge(_ state: EditorState, forward: Bool, extend extending: Bool) -> TransactionSpec? {
        let motion = EditorMotion(state)
        let how: (SelectionRange) -> SelectionRange = { motion.moveToLineBoundary($0, forward: forward) }
        return extending ? extend(state, how) : move(state, how)
    }

    public static func cursorDoc(_ state: EditorState, end: Bool) -> TransactionSpec {
        setSelection(.single(end ? state.doc.length : 0))
    }

    public static func selectDoc(_ state: EditorState, end: Bool) -> TransactionSpec {
        setSelection(.single(state.selection.main.anchor, end ? state.doc.length : 0))
    }

    public static func selectAll(_ state: EditorState) -> TransactionSpec {
        TransactionSpec(selection: .single(0, state.doc.length), userEvent: "select")
    }

    // MARK: - Lines and cursors

    /// selectedLineBlocks: the selection's lines, ranges on touching lines joined, with the ranges in each.
    static func selectedLineBlocks(_ state: EditorState) -> [(from: Int, to: Int, ranges: [SelectionRange])] {
        var blocks: [(from: Int, to: Int, ranges: [SelectionRange])] = []
        var upto = -1
        for range in state.selection.ranges {
            let startLine = state.doc.lineAt(range.from)
            var endLine = state.doc.lineAt(range.to)
            if !range.isEmpty && range.to == endLine.from {
                endLine = state.doc.lineAt(range.to - 1)
            }
            if upto >= startLine.number, var last = blocks.popLast() {
                last.to = endLine.to
                last.ranges.append(range)
                blocks.append(last)
            } else {
                blocks.append((startLine.from, endLine.to, [range]))
            }
            upto = endLine.number + 1
        }
        return blocks
    }

    /// Select Line (Ctrl+L on macOS): each selection grows to whole lines with their line breaks.
    public static func selectLines(_ state: EditorState) -> TransactionSpec {
        let ranges = selectedLineBlocks(state).map { SelectionRange.range($0.from, min($0.to + 1, state.doc.length)) }
        return TransactionSpec(selection: EditorSelection(ranges), userEvent: "select")
    }

    /// Escape (simplifySelection): several ranges become the main one, a selection becomes its head.
    public static func simplifySelection(_ state: EditorState) -> TransactionSpec? {
        if state.selection.ranges.count > 1 {
            return setSelection(EditorSelection([state.selection.main]))
        }
        if !state.selection.main.isEmpty {
            return setSelection(.single(state.selection.main.head))
        }
        return nil
    }

    /// Cmd+Option+Up / Down (addCursorAbove / addCursorBelow).
    public static func addCursorVertically(_ state: EditorState, forward: Bool) -> TransactionSpec? {
        let motion = EditorMotion(state)
        var ranges = state.selection.ranges
        for range in state.selection.ranges {
            let line = state.doc.lineAt(range.head)
            if forward ? line.to < state.doc.length : line.from > 0 {
                var current = range
                while true {
                    let next = motion.moveVertically(current, forward: forward)
                    if next.head < line.from || next.head > line.to {
                        if !ranges.contains(where: { $0.head == next.head }) {
                            ranges.append(next)
                        }
                        break
                    } else if next.head == current.head {
                        break
                    }
                    current = next
                }
            }
        }
        if ranges.count == state.selection.ranges.count {
            return nil
        }
        return setSelection(EditorSelection(ranges, mainIndex: ranges.count - 1))
    }
}
