// Keeping what the syntax pass answered usable while the text changes: syntax spans move with each edit (a span
// an edit falls into keeps its color) until the next pass answers for the new text, as CodeMirror keeps showing
// the old tree's colors until its parser catches up. Also the matching bracket marks (bracketMatching).

import Foundation

extension SyntaxSpans {
    public func mapped(_ changes: ChangeSet) -> SyntaxSpans {
        if changes.isEmpty {
            return self
        }
        var result: [Span] = []
        result.reserveCapacity(spans.count)
        for span in spans {
            let from = changes.map(span.from, assoc: 1), to = changes.map(span.to, assoc: -1)
            if to > from {
                result.append(Span(from: from, to: to, style: span.style))
            }
        }
        return SyntaxSpans(spans: result)
    }
}

extension SyntaxColors {
    public func mapped(_ changes: ChangeSet) -> SyntaxColors {
        SyntaxColors(spans: spans.mapped(changes), brackets: brackets.mapped(changes))
    }
}

public enum BracketMatch {
    public struct Match: Equatable, Sendable {
        /// The bracket at the cursor and its partner (nil when it has none).
        public let start: Range<Int>
        public let end: Range<Int>?
    }

    static let pairs: [Character: (partner: Character, forward: Bool)] = [
        "(": (")", true), "[": ("]", true), "{": ("}", true), ")": ("(", false), "]": ("[", false), "}": ("{", false),
    ]

    /// The brackets each empty range touches, in CodeMirror's order: a closing one before the cursor, an opening one
    /// before it, an opening one after it, a closing one after it.
    public static func matches(_ state: EditorState, scanDistance: Int = 10_000) -> [Match] {
        var found: [Match] = []
        for range in state.selection.ranges where range.isEmpty {
            let head = range.head
            let tries: [(Int, Bool)] = [(head - 1, false), (head - 1, true), (head, true), (head, false)]
            for (position, forward) in tries where position >= 0 && position < state.doc.length {
                let text = state.sliceDoc(position, position + 1)
                guard let character = text.first, let pair = pairs[character], pair.forward == forward else {
                    continue
                }
                found.append(Match(start: position..<(position + 1),
                                   end: partner(state, at: position, scanDistance: scanDistance)))
                break
            }
        }
        return found
    }

    /// The bracket matching the one at `position`, scanning over strings and comments of the language.
    static func partner(_ state: EditorState, at position: Int, scanDistance: Int) -> Range<Int>? {
        guard let character = state.sliceDoc(position, position + 1).first, let pair = pairs[character] else {
            return nil
        }
        if pair.forward {
            let limit = min(state.doc.length, position + scanDistance)
            let text = Array(state.sliceDoc(position, limit).utf16)
            var depth = 0
            for (offset, unit) in text.enumerated() {
                if unit == character.utf16.first {
                    depth += 1
                } else if unit == pair.partner.utf16.first {
                    depth -= 1
                    if depth == 0 {
                        return (position + offset)..<(position + offset + 1)
                    }
                }
            }
            return nil
        }
        let start = max(0, position - scanDistance)
        let opens = BracketScan.open(state.doc, before: position, language: state.config.language)
        guard let open = opens.last(where: { $0.position >= start }), open.character == pair.partner else {
            return nil
        }
        return open.position..<(open.position + 1)
    }
}
