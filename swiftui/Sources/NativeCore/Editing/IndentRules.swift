// Auto-indentation for Enter and for indentOnInput. CodeMirror asks the language's syntax tree (getIndentation);
// this follows the same rules from the brackets around the position: inside an open bracket, one unit more than the
// bracket's line (delimitedIndent), aligned with the first item when one follows the bracket on its line, back to
// the bracket's own level when the text after starts with its closing bracket; an unfinished statement (a trailing
// `=`, an operator, `if (...)`) one unit more than its line (continuedIndent); top-level code at column 0. Python
// adds a unit after a trailing colon and keeps the line's level otherwise. nil means the language has no
// indentation rules: the caller keeps the line's own indentation.

import Foundation

public enum IndentStyle: Sendable {
    case cLike(continued: Bool)
    case python
    case none
}

public enum IndentRules {
    public static func style(languageName: String) -> IndentStyle {
        switch languageName {
        case "JavaScript", "TypeScript", "JavaScript JSX", "TypeScript JSX", "Java", "C", "C++", "C#", "Go", "Rust",
             "PHP", "Kotlin", "Swift", "JSON with Comments":
            return .cLike(continued: true)
        case "JSON", "CSS", "SCSS", "Less":
            return .cLike(continued: false)
        case "Python":
            return .python
        default:
            return .none
        }
    }

    static let openers: [Character: Character] = ["(": ")", "[": "]", "{": "}"]
    static let continuations = ["=", "=>", "&&", "||", "??", "+", "-", "*", "?", "|", "&"]

    /// The indentation (in columns) of a line that starts at `position` after a simulated line break there.
    /// `doubleBreak`: the text after `position` moves to a line of its own too (Enter between brackets).
    public static func indentation(_ state: EditorState, at position: Int, style: IndentStyle,
                                   doubleBreak: Bool = false) -> Int? {
        let doc = state.doc, line = doc.lineAt(position)
        let tabSize = state.config.tabSize, unit = state.config.indentWidth
        let before = TextDocument.utf16Slice(line.text, 0, position - line.from)
        let textAfter = doubleBreak ? "" : TextDocument.utf16Slice(line.text, position - line.from, line.length)
            .drop { $0 == " " || $0 == "\t" }
        switch style {
        case .none:
            return nil
        case .python:
            let trimmed = before.trimmingCharacters(in: .whitespaces)
            if let open = BracketScan.open(doc, before: position, language: state.config.language).last {
                return bracketIndent(state, open: open, position: position, textAfter: String(textAfter))
            }
            let own = TextUnits.countColumn(TextUnits.indentation(line.text), tabSize: tabSize)
            return trimmed.hasSuffix(":") ? own + unit : own
        case .cLike(let continued):
            // A "[" after an expression or type (a[i], T[]) is no bracketed node in the tree: the outer one counts.
            let opens = BracketScan.open(doc, before: position, language: state.config.language)
                .filter { !$0.isSubscript }
            let trimmed = before.trimmingCharacters(in: .whitespaces)
            // Members of a class, interface or enum body continue no statement.
            let inBody = opens.last.map { open in
                open.character == "{" && doc.lineAt(open.position).text
                    .range(of: #"\b(class|interface|enum)\b"#, options: .regularExpression) != nil
            } ?? false
            let continued = continued && !inBody
            let openOnLine = opens.last.map { $0.position >= line.from } ?? false
            let base = statementBase(state, line: line, open: opens.last)
            // Between an arrow function's parameters and its body: its line's level and a unit (ArrowFunction).
            if continued && (textAfter.hasPrefix("=>") || trimmed.hasSuffix("=>")) {
                return TextUnits.countColumn(TextUnits.indentation(line.text), tabSize: tabSize) + unit
            }
            let except = textAfter.first == "{"
            if continued && !openOnLine && !trimmed.isEmpty && continues(trimmed) {
                return base + (except ? 0 : unit)
            }
            // The break falls inside a statement (code on both sides): continuedIndent, except before a "{".
            let closer = textAfter.first.map { ")]}".contains($0) } ?? false
            if continued && !openOnLine && !trimmed.isEmpty && !textAfter.isEmpty && !closer
                && !trimmed.hasSuffix(";") && !trimmed.hasSuffix("{") && !trimmed.hasSuffix("}") {
                return base + (except ? 0 : unit)
            }
            guard let open = opens.last else {
                return 0
            }
            return bracketIndent(state, open: open, position: position, textAfter: String(textAfter))
        }
    }

    /// The indentation of the line a statement continued onto `line` starts on (baseIndent): up through lines that
    /// leave their statement open, stopping at the innermost open bracket's line.
    static func statementBase(_ state: EditorState, line: TextDocument.Line, open: BracketScan.Open?) -> Int {
        let doc = state.doc
        var start = line
        while start.index > 0 {
            let previous = doc.line(start.index - 1)
            let code = previous.text.trimmingCharacters(in: .whitespaces)
            if let open, open.position >= previous.to {
                break
            }
            if code.isEmpty || code.hasSuffix(";") || code.hasSuffix("{") || code.hasSuffix("}")
                || code.hasSuffix(",") || code.hasPrefix("//") {
                break
            }
            start = previous
            if let open, open.position >= previous.from {
                break
            }
        }
        return TextUnits.countColumn(TextUnits.indentation(start.text), tabSize: state.config.tabSize)
    }

    /// Whether `text` (a line's code before the break) leaves its statement unfinished.
    static func continues(_ text: String) -> Bool {
        if continuations.contains(where: { text.hasSuffix($0) }) && !text.hasSuffix("++") && !text.hasSuffix("--") {
            return true
        }
        let control = #"^(\}\s*)?(if|else if|for|while)\s*\(.*\)$"#
        return text == "else" || text == "} else"
            || text.range(of: control, options: .regularExpression) != nil
    }

    /// delimitedIndent for the bracket at `open`.
    static func bracketIndent(_ state: EditorState, open: BracketScan.Open, position: Int, textAfter: String) -> Int {
        let doc = state.doc, tabSize = state.config.tabSize
        let openLine = doc.lineAt(open.position)
        let closed = textAfter.first == openers[open.character]
        let lineEnd = position > openLine.from && position <= openLine.to ? position : openLine.to
        let after = TextDocument.utf16Slice(openLine.text, open.position + 1 - openLine.from, lineEnd - openLine.from)
        let content = after.drop { $0 == " " || $0 == "\t" }
        let comment = state.config.language.lineComment.map { content.hasPrefix($0) } ?? false
        if !content.isEmpty && !comment {
            let spaces = after.prefix { $0 == " " }.utf16.count
            let column = TextUnits.countColumn(openLine.text, tabSize: tabSize, to: open.position - openLine.from)
            return closed ? column : column + 1 + spaces
        }
        let base = TextUnits.countColumn(TextUnits.indentation(openLine.text), tabSize: tabSize)
        return base + (closed ? 0 : state.config.indentWidth)
    }
}

/// The brackets left open before a position, read forward from far enough above it, skipping strings and
/// comments of the language.
public enum BracketScan {
    public struct Open: Equatable, Sendable {
        public let position: Int
        public let character: Character
        /// A "[" right after a word, ")" or "]": an index or an array type, not a bracketed node.
        public var isSubscript = false
    }

    /// Lines read above the position's line.
    static let lookBack = 2000

    public static func open(_ doc: TextDocument, before position: Int, language: LanguageData) -> [Open] {
        let target = doc.lineAt(position)
        var stack: [Open] = []
        var inBlock = false
        var template = false
        let quotes = Set(language.closeBrackets.filter { $0.count == 1 && CloseBrackets.closing($0) == $0 }
            .compactMap(\.first))
        for index in max(0, target.index - lookBack)...target.index {
            let line = doc.line(index)
            let units = Array(line.text.utf16)
            let end = index == target.index ? position - line.from : units.count
            var quote: UInt16? = template ? 96 : nil
            var column = 0
            while column < end {
                let unit = units[column]
                if inBlock {
                    if matches(units, column, language.blockComment?.close) {
                        inBlock = false
                        column += language.blockComment?.close.utf16.count ?? 1
                        continue
                    }
                } else if let open = quote {
                    if unit == 92 {
                        column += 2
                        continue
                    }
                    if unit == open {
                        quote = nil
                    }
                } else if matches(units, column, language.lineComment) {
                    break
                } else if matches(units, column, language.blockComment?.open) {
                    inBlock = true
                    column += language.blockComment?.open.utf16.count ?? 1
                    continue
                } else if let scalar = Unicode.Scalar(unit), quotes.contains(Character(scalar)) {
                    quote = unit
                } else if let scalar = Unicode.Scalar(unit) {
                    let character = Character(scalar)
                    if IndentRules.openers[character] != nil {
                        var open = Open(position: line.from + column, character: character)
                        if character == "[", column > 0, let previous = Unicode.Scalar(units[column - 1]) {
                            open.isSubscript = previous == ")" || previous == "]"
                                || TextUnits.category(String(previous)) == .word
                        }
                        stack.append(open)
                    } else if let last = stack.last, IndentRules.openers[last.character] == character {
                        stack.removeLast()
                    }
                }
                column += 1
            }
            template = quote == 96
        }
        return stack
    }

    static func matches(_ units: [UInt16], _ column: Int, _ token: String?) -> Bool {
        guard let token, !token.isEmpty else {
            return false
        }
        let tokenUnits = Array(token.utf16)
        return column + tokenUnits.count <= units.count
            && Array(units[column..<(column + tokenUnits.count)]) == tokenUnits
    }
}
