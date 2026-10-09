// Text that arrives as input, as CodeMirror's view handles it: typing replaces every range (closeBrackets first gets
// a say for single characters, then indentOnInput re-indents the line in the same transaction); copy and cut take
// the selected text, or whole lines when nothing is selected; paste puts linewise text above the lines and spreads
// one line per range when the counts match.

import Foundation

public enum EditorInput {
    /// Typing `text` (userEvent input.type).
    public static func type(_ state: EditorState, _ text: String, style: IndentStyle,
                            closeBrackets: Bool = true) -> TransactionSpec {
        if closeBrackets && text.utf16.count <= 2, let bracket = CloseBrackets.insert(state, text) {
            return reindent(state, bracket, style: style)
        }
        var spec = state.replaceSelection(text)
        spec.userEvent = "input.type"
        spec.scrollIntoView = true
        return reindent(state, spec, style: style)
    }

    /// The indentOnInput filter: when the typed line's text before the main cursor matches the language's
    /// pattern, every cursor line gets the indentation the rules give it, as a sequential change.
    static func reindent(_ state: EditorState, _ spec: TransactionSpec, style: IndentStyle) -> TransactionSpec {
        guard let changes = spec.changes, !changes.isEmpty, state.config.language.indentOnInput != nil else {
            return spec
        }
        let doc = changes.apply(to: state.doc)
        let selection = spec.selection ?? state.selection.map(changes)
        let head = selection.main.head, line = doc.lineAt(head)
        guard head <= line.from + 200, state.config.language.reindents(doc.slice(line.from, head)) else {
            return spec
        }
        var typed = state
        typed.doc = doc
        typed.selection = selection
        var lineChanges: [ChangeSpec] = [], last = -1
        for range in selection.ranges {
            let cursorLine = doc.lineAt(range.head)
            if cursorLine.from == last {
                continue
            }
            last = cursorLine.from
            guard let indent = IndentRules.indentation(typed, at: cursorLine.from, style: style) else {
                continue
            }
            let current = TextUnits.indentation(cursorLine.text)
            let normal = TextUnits.indentString(columns: indent, unit: state.config.indentUnit,
                                                tabSize: state.config.tabSize)
            if current != normal {
                lineChanges.append(ChangeSpec(from: cursorLine.from, to: cursorLine.from + current.utf16.count,
                                              insert: normal))
            }
        }
        if lineChanges.isEmpty {
            return spec
        }
        let second = ChangeSet.of(lineChanges, length: doc.length)
        var combined = spec
        combined.changes = changes.compose(second)
        combined.selection = selection.map(second, assoc: 1)
        combined.effects = spec.effects.compactMap { $0.mapped(second) }
        return combined
    }

    /// What Copy puts on the clipboard: the selected text joined by line breaks, or each cursor's whole line
    /// (`linewise`).
    public static func copied(_ state: EditorState) -> (text: String, linewise: Bool, ranges: [Range<Int>]) {
        var content: [String] = [], ranges: [Range<Int>] = []
        var linewise = false
        for range in state.selection.ranges where !range.isEmpty {
            content.append(state.sliceDoc(range.from, range.to))
            ranges.append(range.from..<range.to)
        }
        if content.isEmpty {
            var upto = -1
            for range in state.selection.ranges {
                let line = state.doc.lineAt(range.from)
                if line.number > upto {
                    content.append(line.text)
                    ranges.append(line.from..<min(state.doc.length, line.to + 1))
                }
                upto = line.number
            }
            linewise = true
        }
        return (content.joined(separator: "\n"), linewise, ranges)
    }

    /// Cut: deletes what Copy took (userEvent delete.cut).
    public static func cut(_ state: EditorState) -> TransactionSpec? {
        let copied = copied(state)
        let changes = state.changes(copied.ranges.map { ChangeSpec(from: $0.lowerBound, to: $0.upperBound) })
        if changes.isEmpty {
            return nil
        }
        return TransactionSpec(changes: changes, userEvent: "delete.cut", scrollIntoView: true)
    }

    /// Paste (doPaste); `lastLinewiseCopy` is the text of the last linewise copy from this editor, if any.
    public static func paste(_ state: EditorState, _ input: String, lastLinewiseCopy: String?) -> TransactionSpec {
        let lines = input.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let byLine = lines.count == state.selection.ranges.count
        let linewise = lastLinewiseCopy != nil && state.selection.ranges.allSatisfy(\.isEmpty)
            && lastLinewiseCopy == input
        var index = 0
        var spec: TransactionSpec
        if linewise {
            var lastLine = -1
            spec = state.changeByRange { range in
                let line = state.doc.lineAt(range.from)
                if line.from == lastLine {
                    return .init(range: range)
                }
                lastLine = line.from
                let insert = (byLine ? lines[index] : input) + "\n"
                index += 1
                return .init(changes: [ChangeSpec(from: line.from, insert: insert)],
                             range: .cursor(range.from + insert.utf16.count))
            }
        } else if byLine {
            spec = state.changeByRange { range in
                let text = lines[index]
                index += 1
                return .init(changes: [ChangeSpec(from: range.from, to: range.to, insert: text)],
                             range: .cursor(range.from + text.utf16.count))
            }
        } else {
            spec = state.replaceSelection(input)
        }
        spec.userEvent = "input.paste"
        spec.scrollIntoView = true
        return spec
    }
}
