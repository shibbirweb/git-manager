// Lines as WebKit wraps `white-space: pre-wrap; overflow-wrap: anywhere` text (Settings > Automation's commands):
// breaks only at spaces while words fit, a word wider than the line breaks anywhere, spaces at a break hang at the
// end of the line, and the text's own newlines stay. Plain paragraphs use TextWrap.lines.

import Foundation

public extension TextWrap {
    /// `measure` gives a piece's advance width in the same unit as `width`.
    static func preWrapLines(_ text: String, width: Double, measure: (String) -> Double) -> [String] {
        text.components(separatedBy: "\n").flatMap { wrap($0, width: width, measure: measure) }
    }

    private static func wrap(_ line: String, width: Double, measure: (String) -> Double) -> [String] {
        var lines: [String] = []
        var current = ""
        for piece in pieces(line) {
            let candidate = current + piece
            // Trailing spaces hang: only the visible part has to fit.
            if current.isEmpty || measure(trimmedEnd(candidate)) <= width {
                current = candidate
                continue
            }
            lines.append(current)
            current = piece
        }
        // A word still too wide is cut anywhere.
        return (lines + [current]).flatMap { cutAnywhere($0, width: width, measure: measure) }
    }

    /// Words, each with the spaces after it; leading spaces stay with the first word.
    private static func pieces(_ line: String) -> [String] {
        var pieces: [String] = []
        var current = ""
        var inSpaces = false
        for character in line {
            if character == " " {
                inSpaces = true
                current.append(character)
                continue
            }
            if inSpaces && !current.trimmingCharacters(in: .whitespaces).isEmpty {
                pieces.append(current)
                current = ""
            }
            inSpaces = false
            current.append(character)
        }
        pieces.append(current)
        return pieces
    }

    private static func cutAnywhere(_ line: String, width: Double, measure: (String) -> Double) -> [String] {
        guard measure(trimmedEnd(line)) > width else {
            return [line]
        }
        var lines: [String] = []
        var current = ""
        for character in line {
            if !current.isEmpty && character != " " && measure(current + String(character)) > width {
                lines.append(current)
                current = ""
            }
            current.append(character)
        }
        return lines + [current]
    }

    private static func trimmedEnd(_ text: String) -> String {
        var trimmed = text
        while trimmed.last == " " {
            trimmed.removeLast()
        }
        return trimmed
    }
}
