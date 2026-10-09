// The Code menu's commands CodeMirror does not ship, ported from src/lib/editor/textCommands.ts: Duplicate Line or
// Selection, Join Lines, Toggle Case and Sort Lines.

import Foundation

extension EditorCommands {
    /// Duplicate: a selection is copied right after itself, a cursor copies its line below.
    public static func duplicate(_ state: EditorState) -> TransactionSpec {
        var spec = state.changeByRange { range in
            if range.isEmpty {
                let line = state.doc.lineAt(range.head)
                let insert = "\n" + line.text
                return .init(changes: [ChangeSpec(from: line.to, insert: insert)],
                             range: .cursor(range.head + insert.utf16.count))
            }
            let text = state.sliceDoc(range.from, range.to), length = text.utf16.count
            let copy: SelectionRange = range.head >= range.anchor ? .range(range.to, range.to + length)
                : .range(range.to + length, range.to)
            return .init(changes: [ChangeSpec(from: range.to, insert: text)], range: copy)
        }
        spec.scrollIntoView = true
        spec.userEvent = "input.copyline"
        return spec
    }

    /// Join Lines: a cursor joins its line with the next, a selection every line it touches; the break and the
    /// indentation around it become one space (none next to a blank line).
    public static func joinLines(_ state: EditorState) -> TransactionSpec? {
        let doc = state.doc
        var joins = Set<Int>()
        for range in state.selection.ranges {
            let first = doc.lineAt(range.from).number, last = doc.lineAt(range.to).number
            if first == last {
                if first < doc.lineCount {
                    joins.insert(first)
                }
                continue
            }
            for number in first..<last {
                joins.insert(number)
            }
        }
        if joins.isEmpty {
            return nil
        }
        let changes = joins.sorted().map { number -> ChangeSpec in
            let line = doc.line(number - 1), next = doc.line(number)
            let trailing = line.text.utf16.count - trimEnd(line.text).utf16.count
            let leading = next.text.utf16.count - trimStart(next.text).utf16.count
            let blank = trimEnd(line.text).isEmpty || trimEnd(next.text).isEmpty
            return ChangeSpec(from: line.to - trailing, to: next.from + leading, insert: blank ? "" : " ")
        }
        let set = state.changes(changes)
        let ranges = state.selection.ranges.map { range -> SelectionRange in
            if !range.isEmpty {
                return .range(set.map(range.anchor), set.map(range.head))
            }
            let line = doc.lineAt(range.head)
            let end = line.to - (line.text.utf16.count - trimEnd(line.text).utf16.count)
            return .cursor(set.map(joins.contains(line.number) ? end : range.head, assoc: -1))
        }
        return TransactionSpec(changes: set, selection: EditorSelection(ranges, mainIndex: state.selection.mainIndex),
                               userEvent: "delete.join", scrollIntoView: true)
    }

    static func trimEnd(_ text: String) -> String {
        String(text.reversed().drop { $0.isWhitespace }.reversed())
    }

    static func trimStart(_ text: String) -> String {
        String(text.drop { $0.isWhitespace })
    }

    /// Toggle Case: upper case when the text has a lower case letter, lower case otherwise; a cursor works on its
    /// word.
    public static func toggleCase(_ state: EditorState) -> TransactionSpec? {
        var changed = false
        var spec = state.changeByRange { range in
            guard let target = range.isEmpty ? state.wordAt(range.head) : range, !target.isEmpty else {
                return .init(range: range)
            }
            let text = state.sliceDoc(target.from, target.to)
            let next = text == text.uppercased() ? text.lowercased() : text.uppercased()
            if next == text {
                return .init(range: range)
            }
            changed = true
            let end = target.from + next.utf16.count
            let selection: SelectionRange = range.isEmpty ? .cursor(min(range.head, end))
                : range.head >= range.anchor ? .range(target.from, end) : .range(end, target.from)
            return .init(changes: [ChangeSpec(from: target.from, to: target.to, insert: next)], range: selection)
        }
        spec.userEvent = "input.case"
        return changed ? spec : nil
    }

    /// Sort Lines: each selection's lines, or the whole document without one, by character code.
    public static func sortLines(_ state: EditorState) -> TransactionSpec? {
        let doc = state.doc
        let selected = state.selection.ranges.filter { !$0.isEmpty }
        let spans = selected.isEmpty ? [(first: 1, last: doc.lineCount)] : selected.map { range in
            let first = doc.lineAt(range.from).number, endLine = doc.lineAt(range.to)
            let last = range.to == endLine.from && endLine.number > first ? endLine.number - 1 : endLine.number
            return (first: first, last: last)
        }
        var merged: [(first: Int, last: Int)] = []
        for span in spans.sorted(by: { $0.first < $1.first }) {
            if let previous = merged.last, span.first <= previous.last {
                merged[merged.count - 1].last = max(previous.last, span.last)
            } else {
                merged.append(span)
            }
        }
        var changes: [ChangeSpec] = [], ranges: [SelectionRange] = []
        for span in merged where span.last > span.first {
            let from = doc.line(span.first - 1).from, to = doc.line(span.last - 1).to
            let lines = doc.lines((span.first - 1)..<span.last)
            let sorted = lines.sorted { Array($0.utf16).lexicographicallyPrecedes(Array($1.utf16)) }
            ranges.append(.range(from, to))
            if sorted != lines {
                changes.append(ChangeSpec(from: from, to: to, insert: sorted.joined(separator: "\n")))
            }
        }
        if changes.isEmpty {
            return nil
        }
        return TransactionSpec(changes: state.changes(changes), selection: EditorSelection(ranges),
                               userEvent: "input.sort", scrollIntoView: true)
    }
}
