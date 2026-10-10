// Auto-closing brackets and quotes, ported from closeBrackets in @codemirror/autocomplete: typing an opening
// bracket before whitespace, the line's end or a closing character inserts its pair; typing the closing one right
// before a bracket it inserted steps over it; Backspace between a pair deletes both. Quotes need the syntax tree in
// CodeMirror (is the cursor inside a string?); here an odd number of that quote earlier on the line means inside.

import Foundation

public enum CloseBrackets {
    static let definedClosing = Array("()[]{}<>«»»«［］｛｝")

    static func closing(_ open: String) -> String {
        let first = open.first ?? " "
        for index in stride(from: 0, to: definedClosing.count, by: 2) where definedClosing[index] == first {
            return String(definedClosing[index + 1])
        }
        return String(first)
    }

    /// The bracket field: mapped through changes, kept to the main cursor's line on selection, plus new ones.
    static func updateField(_ positions: [Int], transaction: Transaction) -> [Int] {
        var result = positions.compactMap { position -> Int? in
            guard let from = transaction.changes.mapPos(position, assoc: 1, mode: .trackDel),
                  let to = transaction.changes.mapPos(position + 1, assoc: -1, mode: .trackDel), to == from + 1 else {
                return nil
            }
            return from
        }
        if transaction.selection != nil {
            let line = transaction.state.doc.lineAt(transaction.state.selection.main.head)
            result = result.filter { $0 >= line.from && $0 <= line.to }
        }
        for case .closeBracket(let position) in transaction.effects where !result.contains(position) {
            result.append(position)
        }
        return result.sorted()
    }

    static func nextChar(_ state: EditorState, _ position: Int) -> String {
        let next = state.sliceDoc(position, position + 2)
        guard let first = next.unicodeScalars.first else {
            return ""
        }
        return String(first)
    }

    static func prevChar(_ state: EditorState, _ position: Int) -> String {
        let previous = state.sliceDoc(position - 2, position)
        guard let last = previous.unicodeScalars.last else {
            return ""
        }
        return String(last)
    }

    /// insertBracket: the transaction for typing `bracket`, or nil when it is typed as plain text.
    public static func insert(_ state: EditorState, _ bracket: String) -> TransactionSpec? {
        let language = state.config.language
        for token in language.closeBrackets {
            let closed = closing(token)
            if bracket == token {
                return closed == token
                    ? handleSame(state, token, allowTriple: language.closeBrackets.contains(token + token + token))
                    : handleOpen(state, token, closed, before: language.closeBefore)
            }
            if bracket == closed && state.closedBrackets.contains(state.selection.main.from) {
                return handleClose(state, closed)
            }
        }
        return nil
    }

    static func handleOpen(_ state: EditorState, _ open: String, _ close: String, before: String) -> TransactionSpec? {
        var refused = false
        let length = open.utf16.count
        var spec = state.changeByRange { range in
            if !range.isEmpty {
                return .init(changes: [ChangeSpec(from: range.from, insert: open),
                                       ChangeSpec(from: range.to, insert: close)],
                             range: .range(range.anchor + length, range.head + length),
                             effects: [.closeBracket(range.to + length)])
            }
            let next = nextChar(state, range.head)
            if next.isEmpty || next.unicodeScalars.allSatisfy({ $0.properties.isWhitespace }) || before.contains(next) {
                return .init(changes: [ChangeSpec(from: range.head, insert: open + close)],
                             range: .cursor(range.head + length), effects: [.closeBracket(range.head + length)])
            }
            refused = true
            return .init(range: range)
        }
        spec.userEvent = "input.type"
        spec.scrollIntoView = true
        return refused ? nil : spec
    }

    static func handleClose(_ state: EditorState, _ close: String) -> TransactionSpec? {
        var refused = false
        let length = close.utf16.count
        var spec = state.changeByRange { range in
            if range.isEmpty && nextChar(state, range.head) == close {
                return .init(changes: [ChangeSpec(from: range.head, to: range.head + length, insert: close)],
                             range: .cursor(range.head + length))
            }
            refused = true
            return .init(range: range)
        }
        spec.userEvent = "input.type"
        spec.scrollIntoView = true
        return refused ? nil : spec
    }

    static func handleSame(_ state: EditorState, _ token: String, allowTriple: Bool) -> TransactionSpec? {
        var refused = false
        let length = token.utf16.count
        var spec = state.changeByRange { range in
            if !range.isEmpty {
                return .init(changes: [ChangeSpec(from: range.from, insert: token),
                                       ChangeSpec(from: range.to, insert: token)],
                             range: .range(range.anchor + length, range.head + length),
                             effects: [.closeBracket(range.to + length)])
            }
            let position = range.head, next = nextChar(state, position)
            if next == token {
                if startsString(state, position, token) {
                    return .init(changes: [ChangeSpec(from: position, insert: token + token)],
                                 range: .cursor(position + length), effects: [.closeBracket(position + length)])
                }
                if state.closedBrackets.contains(position) {
                    let triple = allowTriple && state.sliceDoc(position, position + length * 3) == token + token + token
                    let content = triple ? token + token + token : token
                    return .init(changes: [ChangeSpec(from: position, to: position + content.utf16.count,
                                                      insert: content)],
                                 range: .cursor(position + content.utf16.count))
                }
            } else if state.category(next) != .word {
                if canStartString(state, position) && !insideString(state, position, token) {
                    return .init(changes: [ChangeSpec(from: position, insert: token + token)],
                                 range: .cursor(position + length), effects: [.closeBracket(position + length)])
                }
            }
            refused = true
            return .init(range: range)
        }
        spec.userEvent = "input.type"
        spec.scrollIntoView = true
        return refused ? nil : spec
    }

    /// Whether the quotes before `position` on its line leave it inside a string of `token`.
    static func insideString(_ state: EditorState, _ position: Int, _ token: String) -> Bool {
        guard state.config.language.syntax else {
            return false
        }
        let line = state.doc.lineAt(position)
        let before = Array(TextDocument.utf16Slice(line.text, 0, position - line.from))
        var count = 0, escaped = false
        for character in before {
            if escaped {
                escaped = false
            } else if character == "\\" {
                escaped = true
            } else if String(character) == token {
                count += 1
            }
        }
        return count % 2 == 1
    }

    /// Whether the quote at `position` opens a string (nodeStart in CodeMirror): it is not inside one.
    static func startsString(_ state: EditorState, _ position: Int, _ token: String) -> Bool {
        state.config.language.syntax && !insideString(state, position, token)
    }

    /// canStartStringAt: no word character right before, or one of the language's string prefixes after a non-word.
    static func canStartString(_ state: EditorState, _ position: Int) -> Bool {
        if state.category(state.sliceDoc(position - 1, position)) != .word || position == 0 {
            return true
        }
        for prefix in state.config.language.stringPrefixes {
            let start = position - prefix.utf16.count
            if start >= 0 && state.sliceDoc(start, position) == prefix
                && (start == 0 || state.category(state.sliceDoc(start - 1, start)) != .word) {
                return true
            }
        }
        return false
    }

    /// deleteBracketPair: Backspace between an opening bracket and its closing one deletes both.
    public static func deletePair(_ state: EditorState) -> TransactionSpec? {
        let tokens = state.config.language.closeBrackets
        var refused = false
        var spec = state.changeByRange { range in
            if range.isEmpty {
                let before = prevChar(state, range.head)
                for token in tokens where token == before && nextChar(state, range.head) == closing(token) {
                    let length = token.utf16.count
                    return .init(changes: [ChangeSpec(from: range.head - length, to: range.head + length)],
                                 range: .cursor(range.head - length))
                }
            }
            refused = true
            return .init(range: range)
        }
        spec.userEvent = "delete.backward"
        spec.scrollIntoView = true
        return refused ? nil : spec
    }
}
