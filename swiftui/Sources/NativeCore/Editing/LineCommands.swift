// Whole-line commands: Option+Up/Down moves the selected lines, Shift+Option+Up/Down copies them, Shift+Cmd+K
// deletes them (@codemirror/commands), and Cmd+/ toggles line comments, Cmd+Option+/ block comments.

import Foundation

extension EditorCommands {
    public static func moveLine(_ state: EditorState, forward: Bool) -> TransactionSpec? {
        var changes: [ChangeSpec] = [], ranges: [SelectionRange] = []
        let doc = state.doc
        for block in selectedLineBlocks(state) {
            if forward ? block.to == doc.length : block.from == 0 {
                continue
            }
            let nextLine = doc.lineAt(forward ? block.to + 1 : block.from - 1)
            let size = nextLine.length + 1
            if forward {
                changes.append(ChangeSpec(from: block.to, to: nextLine.to))
                changes.append(ChangeSpec(from: block.from, insert: nextLine.text + "\n"))
                for range in block.ranges {
                    ranges.append(.range(min(doc.length, range.anchor + size), min(doc.length, range.head + size)))
                }
            } else {
                changes.append(ChangeSpec(from: nextLine.from, to: block.from))
                changes.append(ChangeSpec(from: block.to, insert: "\n" + nextLine.text))
                for range in block.ranges {
                    ranges.append(.range(range.anchor - size, range.head - size))
                }
            }
        }
        if changes.isEmpty {
            return nil
        }
        return TransactionSpec(changes: state.changes(changes),
                               selection: EditorSelection(ranges, mainIndex: state.selection.mainIndex),
                               userEvent: "move.line", scrollIntoView: true)
    }

    public static func copyLine(_ state: EditorState, forward: Bool) -> TransactionSpec {
        var changes: [ChangeSpec] = []
        for block in selectedLineBlocks(state) {
            let text = state.sliceDoc(block.from, block.to)
            changes.append(forward ? ChangeSpec(from: block.from, insert: text + "\n")
                                   : ChangeSpec(from: block.to, insert: "\n" + text))
        }
        let set = state.changes(changes)
        return TransactionSpec(changes: set, selection: state.selection.map(set, assoc: forward ? 1 : -1),
                               userEvent: "input.copyline", scrollIntoView: true)
    }

    public static func deleteLine(_ state: EditorState) -> TransactionSpec {
        let doc = state.doc
        let changes = state.changes(selectedLineBlocks(state).map { block in
            var from = block.from, to = block.to
            if from > 0 {
                from -= 1
            } else if to < doc.length {
                to += 1
            }
            return ChangeSpec(from: from, to: to)
        })
        let motion = EditorMotion(state)
        let selection = updateSelection(state) { motion.moveVertically($0, forward: true) }.map(changes)
        return TransactionSpec(changes: changes, selection: selection, userEvent: "delete.line", scrollIntoView: true)
    }

    // MARK: - Comments

    /// Toggle Comment: line comments when the language has them, else block comments by line (toggleComment).
    public static func toggleComment(_ state: EditorState) -> TransactionSpec? {
        if state.config.language.lineComment != nil {
            return toggleLineComment(state)
        }
        if state.config.language.blockComment != nil {
            return toggleBlockComment(state, byLine: true)
        }
        return nil
    }

    struct CommentLine {
        let line: TextDocument.Line
        let comment: Int
        var indent: Int
        let empty: Bool
        var single: Bool
    }

    public static func toggleLineComment(_ state: EditorState) -> TransactionSpec? {
        guard let token = state.config.language.lineComment else {
            return nil
        }
        let tokenLength = token.utf16.count
        var lines: [CommentLine] = []
        var previousLine = -1
        for range in state.selection.ranges {
            let startIndex = lines.count
            var minIndent = Int.max
            var position = range.from
            while position <= range.to {
                let line = state.doc.lineAt(position)
                if line.from > previousLine && (range.from == range.to || range.to > line.from) {
                    previousLine = line.from
                    let indent = TextUnits.indentation(line.text).utf16.count
                    let empty = indent == line.length
                    let commented = TextDocument.utf16Slice(line.text, indent, indent + tokenLength) == token
                    if indent < line.length && indent < minIndent {
                        minIndent = indent
                    }
                    lines.append(CommentLine(line: line, comment: commented ? indent : -1, indent: indent,
                                             empty: empty, single: false))
                }
                position = line.to + 1
            }
            if minIndent < Int.max {
                for index in startIndex..<lines.count where lines[index].indent < lines[index].line.length {
                    lines[index].indent = minIndent
                }
            }
            if lines.count == startIndex + 1 {
                lines[startIndex].single = true
            }
        }
        if lines.contains(where: { $0.comment < 0 && (!$0.empty || $0.single) }) {
            let changes = lines.filter { $0.single || !$0.empty }
                .map { ChangeSpec(from: $0.line.from + $0.indent, insert: token + " ") }
            let set = state.changes(changes)
            return TransactionSpec(changes: set, selection: state.selection.map(set, assoc: 1))
        }
        if lines.contains(where: { $0.comment >= 0 }) {
            let changes = lines.filter { $0.comment >= 0 }.map { entry -> ChangeSpec in
                let from = entry.line.from + entry.comment
                var to = from + tokenLength
                if TextDocument.utf16Slice(entry.line.text, to - entry.line.from, to - entry.line.from + 1) == " " {
                    to += 1
                }
                return ChangeSpec(from: from, to: to)
            }
            return TransactionSpec(changes: state.changes(changes))
        }
        return nil
    }

    /// Block comments around each selection, or around the selected lines (`byLine`), or removed when there.
    public static func toggleBlockComment(_ state: EditorState, byLine: Bool) -> TransactionSpec? {
        guard let tokens = state.config.language.blockComment else {
            return nil
        }
        let ranges: [(from: Int, to: Int)] = byLine ? selectedLineRanges(state)
            : state.selection.ranges.map { ($0.from, $0.to) }
        let found = ranges.map { findBlockComment(state, tokens, $0.from, $0.to) }
        if found.contains(where: { $0 == nil }) {
            var changes: [ChangeSpec] = []
            for (range, comment) in zip(ranges, found) where comment == nil {
                changes.append(ChangeSpec(from: range.from, insert: tokens.open + " "))
                changes.append(ChangeSpec(from: range.to, insert: " " + tokens.close))
            }
            return TransactionSpec(changes: state.changes(changes))
        }
        var changes: [ChangeSpec] = []
        for comment in found.compactMap({ $0 }) {
            changes.append(ChangeSpec(from: comment.open - tokens.open.utf16.count,
                                      to: comment.open + comment.openMargin))
            changes.append(ChangeSpec(from: comment.close - comment.closeMargin,
                                      to: comment.close + tokens.close.utf16.count))
        }
        return changes.isEmpty ? nil : TransactionSpec(changes: state.changes(changes))
    }

    struct BlockComment: Equatable {
        let open: Int
        let openMargin: Int
        let close: Int
        let closeMargin: Int
    }

    static func selectedLineRanges(_ state: EditorState) -> [(from: Int, to: Int)] {
        var ranges: [(from: Int, to: Int)] = []
        for range in state.selection.ranges {
            let fromLine = state.doc.lineAt(range.from)
            var toLine = range.to <= fromLine.to ? fromLine : state.doc.lineAt(range.to)
            if toLine.from > fromLine.from && toLine.from == range.to {
                toLine = range.to == fromLine.to + 1 ? fromLine : state.doc.lineAt(range.to - 1)
            }
            if let last = ranges.last, last.to > fromLine.from {
                ranges[ranges.count - 1].to = toLine.to
            } else {
                ranges.append((fromLine.from + TextUnits.indentation(fromLine.text).utf16.count, toLine.to))
            }
        }
        return ranges
    }

    static func findBlockComment(_ state: EditorState, _ tokens: (open: String, close: String), _ from: Int,
                                 _ to: Int) -> BlockComment? {
        let margin = 50
        let textBefore = state.sliceDoc(from - margin, from), textAfter = state.sliceDoc(to, to + margin)
        let spaceBefore = textBefore.reversed().prefix { $0.isWhitespace }.count
        let spaceAfter = textAfter.prefix { $0.isWhitespace }.count
        let beforeTrimmed = String(textBefore.dropLast(spaceBefore))
        if beforeTrimmed.hasSuffix(tokens.open) && textAfter.dropFirst(spaceAfter).hasPrefix(tokens.close) {
            return BlockComment(open: from - spaceBefore, openMargin: spaceBefore > 0 ? 1 : 0,
                                close: to + spaceAfter, closeMargin: spaceAfter > 0 ? 1 : 0)
        }
        let inner = state.sliceDoc(from, to)
        let startSpace = inner.prefix { $0.isWhitespace }.count
        let endSpace = inner.reversed().prefix { $0.isWhitespace }.count
        let body = inner.dropFirst(startSpace).dropLast(endSpace)
        guard body.count >= tokens.open.count + tokens.close.count, body.hasPrefix(tokens.open),
              body.hasSuffix(tokens.close) else {
            return nil
        }
        let afterOpen = body.dropFirst(tokens.open.count).first
        let beforeClose = body.dropLast(tokens.close.count).last
        return BlockComment(open: from + startSpace + tokens.open.utf16.count,
                            openMargin: afterOpen?.isWhitespace == true ? 1 : 0,
                            close: to - endSpace - tokens.close.utf16.count,
                            closeMargin: beforeClose?.isWhitespace == true ? 1 : 0)
    }
}
