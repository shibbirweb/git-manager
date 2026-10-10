// The file editor's word highlight (CodeMirror's highlightSelectionMatches with highlightWordAroundCursor, as
// src/lib/editor/features.ts sets it up): with an empty selection, the word at the cursor and every other
// whole-word occurrence of it in the lines on screen. More than `maxMatches` occurrences highlight nothing.
// Offsets are UTF-16, like the editor's.

import Foundation

public enum WordMatches {
    public struct Match: Equatable, Sendable {
        /// 0-based line and the UTF-16 range in it.
        public let line: Int
        public let range: Range<Int>
        /// The occurrence under the cursor (cm-selectionMatch-main).
        public let main: Bool

        public init(line: Int, range: Range<Int>, main: Bool) {
            self.line = line
            self.range = range
            self.main = main
        }
    }

    public static let maxMatches = 100

    /// A word character as CodeMirror's charCategorizer sees it: a letter, a digit, "_", or one of the language's
    /// extra word characters ("$" in JavaScript and TypeScript).
    public static func isWord(_ unit: UInt16, extra: Set<UInt16> = []) -> Bool {
        if extra.contains(unit) {
            return true
        }
        if unit == 95 || (48...57).contains(unit) || (65...90).contains(unit) || (97...122).contains(unit) {
            return true
        }
        guard unit > 127, let scalar = Unicode.Scalar(unit) else {
            return false
        }
        return scalar.properties.isAlphabetic
    }

    /// The word around `column` of `line`, as UTF-16 offsets; nil when the cursor touches no word character.
    public static func word(in line: [UInt16], at column: Int, extra: Set<UInt16> = []) -> Range<Int>? {
        var start = min(max(0, column), line.count), end = start
        while start > 0, isWord(line[start - 1], extra: extra) {
            start -= 1
        }
        while end < line.count, isWord(line[end], extra: extra) {
            end += 1
        }
        return start == end ? nil : start..<end
    }

    /// The highlighted occurrences in `visible` (0-based line numbers) of the word at the cursor (`cursorLine`,
    /// `cursorColumn`). `lineAt` gives a line's UTF-16 text.
    public static func matches(
        cursorLine: Int, cursorColumn: Int, visible: Range<Int>, extra: Set<UInt16> = [],
        lineAt: (Int) -> [UInt16]
    ) -> [Match] {
        let cursorText = lineAt(cursorLine)
        guard let word = word(in: cursorText, at: cursorColumn, extra: extra) else {
            return []
        }
        let query = Array(cursorText[word])
        var found: [Match] = []
        for lineIndex in visible {
            let text = lineAt(lineIndex)
            guard text.count >= query.count else {
                continue
            }
            var start = 0
            while start + query.count <= text.count {
                guard text[start] == query[0], Array(text[start..<(start + query.count)]) == query else {
                    start += 1
                    continue
                }
                let end = start + query.count
                let before = start == 0 || !isWord(text[start - 1], extra: extra)
                let after = end == text.count || !isWord(text[end], extra: extra)
                if before && after {
                    let main = lineIndex == cursorLine && start <= cursorColumn && end >= cursorColumn
                    found.append(Match(line: lineIndex, range: start..<end, main: main))
                    if found.count > maxMatches {
                        return []
                    }
                }
                start = end
            }
        }
        return found
    }
}
