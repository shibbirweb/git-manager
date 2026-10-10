// Character-level helpers the commands share, as @codemirror/state has them: grapheme cluster breaks in UTF-16
// offsets (findClusterBreak), the word / space / other categories of charCategorizer, and column counting with tabs
// (countColumn, findColumn).

import Foundation

public enum CharCategory: Equatable, Sendable {
    case word, space, other
}

public enum TextUnits {
    /// The next (or previous) grapheme cluster boundary from UTF-16 offset `position` in `text`.
    public static func clusterBreak(_ text: String, _ position: Int, forward: Bool = true) -> Int {
        let total = text.utf16.count
        if forward ? position >= total : position <= 0 {
            return forward ? total : 0
        }
        var offset = 0, previous = 0
        for character in text {
            let next = offset + character.utf16.count
            if forward && next > position {
                return next
            }
            if !forward && next >= position {
                return offset < position ? offset : previous
            }
            previous = offset
            offset = next
        }
        return forward ? total : offset
    }

    /// The category of `character` (a cluster or a single unit as a string): CodeMirror's makeCategorizer.
    public static func category(_ character: String, wordChars: Set<UInt16> = []) -> CharCategory {
        if character.unicodeScalars.allSatisfy({ $0.properties.isWhitespace }) {
            return .space
        }
        for scalar in character.unicodeScalars {
            if scalar == "_" || scalar.properties.isAlphabetic || scalar.properties.numericType != nil {
                return .word
            }
        }
        if character.utf16.contains(where: { wordChars.contains($0) }) {
            return .word
        }
        return .other
    }

    /// The column `text` (up to UTF-16 offset `to`) ends at, with tabs to the next multiple of `tabSize`.
    public static func countColumn(_ text: String, tabSize: Int, to end: Int? = nil) -> Int {
        var column = 0, offset = 0
        let limit = end ?? Int.max
        for character in text {
            if offset >= limit {
                break
            }
            if character == "\t" {
                column += tabSize - column % tabSize
            } else {
                column += 1
            }
            offset += character.utf16.count
        }
        return column
    }

    /// The UTF-16 offset in `text` at visual column `column` (the line's end when it is shorter); with `strict`,
    /// nil when the line is shorter.
    public static func findColumn(_ text: String, column goal: Int, tabSize: Int, strict: Bool = false) -> Int? {
        var column = 0, offset = 0
        for character in text {
            if column >= goal {
                return offset
            }
            column += character == "\t" ? tabSize - column % tabSize : 1
            offset += character.utf16.count
        }
        if column >= goal {
            return offset
        }
        return strict ? nil : offset
    }

    /// The leading whitespace of `text`.
    public static func indentation(_ text: String) -> String {
        String(text.prefix { $0 == " " || $0 == "\t" })
    }

    /// The whitespace CodeMirror's indentString makes for `columns`: tabs first when the unit is a tab.
    public static func indentString(columns: Int, unit: String, tabSize: Int) -> String {
        var result = "", remaining = columns
        if unit.first == "\t" {
            while remaining >= tabSize {
                result += "\t"
                remaining -= tabSize
            }
        }
        return result + String(repeating: " ", count: max(0, remaining))
    }
}
