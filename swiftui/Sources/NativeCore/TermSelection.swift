// A text selection in the terminal, from where the mouse went down to where it is, in line indexes of the scrollback
// and screen (so scrolling keeps it on its text), and the text it covers as xterm.js copies it: wrapped lines joined,
// trailing blanks dropped, lines ended with a line feed.

public struct TermPosition: Equatable, Comparable, Sendable {
    public var line: Int
    public var column: Int

    public init(line: Int, column: Int) {
        self.line = line
        self.column = column
    }

    public static func < (first: TermPosition, second: TermPosition) -> Bool {
        (first.line, first.column) < (second.line, second.column)
    }
}

public struct TermSelection: Equatable, Sendable {
    public var anchor: TermPosition
    public var head: TermPosition

    public init(anchor: TermPosition, head: TermPosition) {
        self.anchor = anchor
        self.head = head
    }

    public var start: TermPosition { min(anchor, head) }
    /// One past the last selected cell.
    public var end: TermPosition { max(anchor, head) }
    public var isEmpty: Bool { anchor == head }

    public func contains(line: Int, column: Int) -> Bool {
        let position = TermPosition(line: line, column: column)
        return !isEmpty && position >= start && position < end
    }

    /// The selected text of `term`'s normal screen and scrollback (or its alternate screen while it shows).
    public func text(in term: TermEmulator) -> String {
        guard !isEmpty else {
            return ""
        }
        let screen = term.screen
        var result = ""
        let first = max(0, start.line), last = min(screen.lineCount - 1, end.line)
        guard first <= last else {
            return ""
        }
        for index in first...last {
            let line = screen.line(index)
            let from = index == start.line ? start.column : 0
            let to = index == end.line ? end.column : line.cells.count
            var piece = ""
            for column in max(0, from)..<max(max(0, from), min(to, line.cells.count)) {
                let cell = line.cells[column]
                guard cell.width > 0 else {
                    continue
                }
                piece += line.combined[column] ?? cell.character.map(String.init) ?? " "
            }
            let continues = index < last && screen.line(index + 1).isWrapped
            if !continues {
                while piece.last == " " {
                    piece.removeLast()
                }
            }
            result += piece
            if index < last && !continues {
                result += "\n"
            }
        }
        return result
    }
}
