// The word-level diff that marks the exact changes inside a merge chunk, ported from src/lib/merge/inline.ts.
// Offsets are UTF-16 units, as in JavaScript strings.

import Foundation

public enum WordDiff {
    /// Skip inline highlighting when the token product gets expensive.
    static let maxCells = 400_000

    /// The token boundaries of /\w+|\s+|[^\w\s]/gu: ASCII word runs, whitespace runs, or one code point.
    static func tokenize(_ units: [UInt16]) -> [ArraySlice<UInt16>] {
        var tokens: [ArraySlice<UInt16>] = []
        var index = 0
        while index < units.count {
            let unit = units[index]
            var end = index + 1
            if isWord(unit) {
                while end < units.count, isWord(units[end]) {
                    end += 1
                }
            } else if isSpace(unit) {
                while end < units.count, isSpace(units[end]) {
                    end += 1
                }
            } else if (0xD800...0xDBFF).contains(unit), end < units.count, (0xDC00...0xDFFF).contains(units[end]) {
                end += 1
            }
            tokens.append(units[index..<end])
            index = end
        }
        return tokens
    }

    static func isWord(_ unit: UInt16) -> Bool {
        (48...57).contains(unit) || (65...90).contains(unit) || (97...122).contains(unit) || unit == 95
    }

    /// JavaScript's \s.
    static func isSpace(_ unit: UInt16) -> Bool {
        switch unit {
        case 9...13, 32, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
            return true
        default:
            return false
        }
    }

    /// The spans of `after` that differ from `before`, as UTF-16 ranges into `after`. Whitespace-only differences are
    /// not marked. nil when the inputs are too large or too different to be useful.
    public static func changedSpans(before: String, after: String) -> [Range<Int>]? {
        let a = tokenize(Array(before.utf16)).map { Array($0) }
        let b = tokenize(Array(after.utf16)).map { Array($0) }
        if a.isEmpty || b.isEmpty || a.count * b.count > maxCells {
            return nil
        }
        // LCS table over tokens, filled from the end so the walk goes forward.
        let width = b.count + 1
        var table = [UInt32](repeating: 0, count: (a.count + 1) * width)
        for i in stride(from: a.count - 1, through: 0, by: -1) {
            for j in stride(from: b.count - 1, through: 0, by: -1) {
                table[i * width + j] = a[i] == b[j]
                    ? table[(i + 1) * width + j + 1] + 1
                    : max(table[(i + 1) * width + j], table[i * width + j + 1])
            }
        }
        var spans: [Range<Int>] = []
        var offset = 0, i = 0, j = 0, words = 0, keptWords = 0
        while j < b.count {
            let isWordToken = b[j].contains { !isSpace($0) }
            if i < a.count && a[i] == b[j] {
                if isWordToken {
                    words += 1
                    keptWords += 1
                }
                offset += b[j].count
                i += 1
                j += 1
            } else if i < a.count && table[(i + 1) * width + j] >= table[i * width + j + 1] {
                i += 1
            } else {
                if isWordToken {
                    words += 1
                    let span = offset..<(offset + b[j].count)
                    if let last = spans.last, last.upperBound == span.lowerBound {
                        spans[spans.count - 1] = last.lowerBound..<span.upperBound
                    } else {
                        spans.append(span)
                    }
                }
                offset += b[j].count
                j += 1
            }
        }
        // Mostly rewritten text reads better with the whole chunk colored.
        if words > 0 && Double(keptWords) < Double(words) * 0.3 {
            return nil
        }
        return spans
    }
}
