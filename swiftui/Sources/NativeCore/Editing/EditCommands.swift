// The editing commands of CodeMirror's keymaps (@codemirror/commands): deleting by character, group and line
// boundary, Enter with auto-indent (and the extra line between brackets), indent more and less, moving, copying
// and deleting lines. Each returns the transaction or nil when it does nothing.

import Foundation

extension EditorCommands {
    /// deleteBy: a cursor deletes towards `by`'s answer, a selection deletes itself.
    static func deleteBy(_ state: EditorState, _ by: (SelectionRange) -> Int) -> TransactionSpec? {
        var event = "delete.selection"
        var spec = state.changeByRange { range in
            var from = range.from, to = range.to
            if from == to {
                let towards = by(range)
                if towards < from {
                    event = "delete.backward"
                } else if towards > from {
                    event = "delete.forward"
                }
                from = min(from, towards)
                to = max(to, towards)
            }
            if from == to {
                return .init(range: range)
            }
            return .init(changes: [ChangeSpec(from: from, to: to)],
                         range: .cursor(from, assoc: from < range.head ? -1 : 1))
        }
        guard let changes = spec.changes, !changes.isEmpty else {
            return nil
        }
        spec.userEvent = event
        spec.scrollIntoView = true
        return spec
    }

    /// Backspace (deleteCharBackward, by indent unit in leading whitespace) and Delete (deleteCharForward).
    public static func deleteChar(_ state: EditorState, forward: Bool, byIndentUnit: Bool = true) -> TransactionSpec? {
        deleteBy(state) { range in
            var position = range.from
            let line = state.doc.lineAt(position)
            let before = TextDocument.utf16Slice(line.text, 0, position - line.from)
            if byIndentUnit && !forward && position > line.from && position < line.from + 200
                && before.allSatisfy({ $0 == " " || $0 == "\t" }) {
                if before.last == "\t" {
                    return position - 1
                }
                let column = TextUnits.countColumn(before, tabSize: state.config.tabSize)
                let unit = state.config.indentWidth
                let drop = column % unit == 0 ? unit : column % unit
                var index = 0
                let characters = Array(before)
                while index < drop && characters.count - 1 - index >= 0
                    && characters[characters.count - 1 - index] == " " {
                    position -= 1
                    index += 1
                }
                return position
            }
            var target = line.from + TextUnits.clusterBreak(line.text, position - line.from, forward: forward)
            if target == position && line.number != (forward ? state.doc.lineCount : 1) {
                target += forward ? 1 : -1
            }
            if let fold = state.folds.first(where: { forward ? $0.from == position : $0.to == position }) {
                target = forward ? fold.to : fold.from
            }
            return target
        }
    }

    /// Option+Backspace and Option+Delete (deleteGroupBackward / deleteGroupForward).
    public static func deleteGroup(_ state: EditorState, forward: Bool) -> TransactionSpec? {
        deleteBy(state) { range in
            var position = range.head
            let line = state.doc.lineAt(position)
            var category: CharCategory?
            while true {
                if position == (forward ? line.to : line.from) {
                    if position == range.head && line.number != (forward ? state.doc.lineCount : 1) {
                        position += forward ? 1 : -1
                    }
                    break
                }
                let next = line.from + TextUnits.clusterBreak(line.text, position - line.from, forward: forward)
                let text = TextDocument.utf16Slice(line.text, min(position, next) - line.from,
                                                   max(position, next) - line.from)
                let nextCategory = state.category(text)
                if let category, nextCategory != category {
                    break
                }
                if text != " " || position != range.head {
                    category = nextCategory
                }
                position = next
            }
            return position
        }
    }

    /// Cmd+Backspace and Cmd+Delete (deleteLineBoundaryBackward / Forward); Ctrl+K deletes to the line's end.
    public static func deleteLineBoundary(_ state: EditorState, forward: Bool) -> TransactionSpec? {
        let motion = EditorMotion(state)
        return deleteBy(state) { range in
            let boundary = motion.moveToLineBoundary(range, forward: forward).head
            if forward {
                return range.head < boundary ? boundary : min(state.doc.length, range.head + 1)
            }
            return range.head > boundary ? boundary : max(0, range.head - 1)
        }
    }

    // MARK: - New lines

    /// isBetweenBrackets for the bracket pairs CodeMirror recognizes without a tree.
    static func betweenBrackets(_ state: EditorState, _ position: Int) -> Bool {
        ["()", "[]", "{}"].contains(state.sliceDoc(position - 1, position + 1))
    }

    /// Enter (insertNewlineAndIndent) and Cmd+Enter (insertBlankLine, `atEnd`).
    public static func newlineAndIndent(
        _ state: EditorState, style: IndentStyle, atEnd: Bool = false
    ) -> TransactionSpec {
        var spec = state.changeByRange { range in
            var from = range.from, to = range.to
            let line = state.doc.lineAt(from)
            let explode = !atEnd && from == to && betweenBrackets(state, from)
            if atEnd {
                from = (to <= line.to ? line : state.doc.lineAt(to)).to
                to = from
            }
            let indent = IndentRules.indentation(state, at: from, style: style, doubleBreak: explode)
                ?? TextUnits.countColumn(TextUnits.indentation(state.doc.lineAt(from).text),
                                         tabSize: state.config.tabSize)
            let units = Array(line.text.utf16)
            while to < line.to, let scalar = Unicode.Scalar(units[to - line.from]), scalar.properties.isWhitespace {
                to += 1
            }
            if explode {
                to = from
            } else if from > line.from && from < line.from + 100
                // CodeMirror slices the line's text up to the document position here, not the line position.
                && TextDocument.utf16Slice(line.text, 0, from).allSatisfy({ $0.isWhitespace }) {
                from = line.from
            }
            let indentText = indentString(state, indent)
            var insert = "\n" + indentText
            if explode {
                let own = TextUnits.countColumn(TextUnits.indentation(line.text), tabSize: state.config.tabSize)
                insert += "\n" + indentString(state, own)
            }
            return .init(changes: [ChangeSpec(from: from, to: to, insert: insert)],
                         range: .cursor(from + 1 + indentText.utf16.count))
        }
        spec.userEvent = "input"
        spec.scrollIntoView = true
        return spec
    }

    static func indentString(_ state: EditorState, _ columns: Int) -> String {
        TextUnits.indentString(columns: columns, unit: state.config.indentUnit, tabSize: state.config.tabSize)
    }

    /// splitLine (Ctrl+O): a line break, the cursor staying before it.
    public static func splitLine(_ state: EditorState) -> TransactionSpec {
        var spec = state.changeByRange { range in
            .init(changes: [ChangeSpec(from: range.from, to: range.to, insert: "\n")], range: .cursor(range.from))
        }
        spec.userEvent = "input"
        spec.scrollIntoView = true
        return spec
    }

    // MARK: - Indentation

    /// changeBySelectedLine: `body` for each line a range touches, once per line.
    static func changeBySelectedLine(_ state: EditorState,
                                     _ body: (TextDocument.Line, inout [ChangeSpec]) -> Void) -> TransactionSpec {
        var atLine = -1
        return state.changeByRange { range in
            var changes: [ChangeSpec] = []
            var position = range.from
            while position <= range.to {
                let line = state.doc.lineAt(position)
                if line.number > atLine && (range.isEmpty || range.to > line.from) {
                    body(line, &changes)
                    atLine = line.number
                }
                position = line.to + 1
            }
            let set = state.changes(changes)
            return .init(changes: changes,
                         range: .range(set.map(range.anchor, assoc: 1), set.map(range.head, assoc: 1)))
        }
    }

    /// Tab and Cmd+] (indentMore): one unit at the start of each selected line.
    public static func indentMore(_ state: EditorState) -> TransactionSpec {
        var spec = changeBySelectedLine(state) { line, changes in
            changes.append(ChangeSpec(from: line.from, insert: state.config.indentUnit))
        }
        spec.userEvent = "input.indent"
        return spec
    }

    /// Shift+Tab and Cmd+[ (indentLess): one unit less on each selected line.
    public static func indentLess(_ state: EditorState) -> TransactionSpec {
        var spec = changeBySelectedLine(state) { line, changes in
            let space = TextUnits.indentation(line.text)
            if space.isEmpty {
                return
            }
            let column = TextUnits.countColumn(space, tabSize: state.config.tabSize)
            let insert = Array(indentString(state, max(0, column - state.config.indentWidth)).utf16)
            let spaceUnits = Array(space.utf16)
            var keep = 0
            while keep < spaceUnits.count && keep < insert.count && spaceUnits[keep] == insert[keep] {
                keep += 1
            }
            changes.append(ChangeSpec(from: line.from + keep, to: line.from + spaceUnits.count,
                                      insert: String(decoding: insert[keep...], as: UTF16.self)))
        }
        spec.userEvent = "delete.dedent"
        return spec
    }
}
