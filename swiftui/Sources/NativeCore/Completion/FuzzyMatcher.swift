// CodeMirror's FuzzyMatcher (@codemirror/autocomplete), which filters and scores the completion options against the
// typed text. Ported line by line on UTF-16 code units, as JavaScript strings are, so the scores, the matched ranges
// and therefore the popup's order and highlights are the page's. Scores are more negative the worse the match.

import Foundation

public final class FuzzyMatcher {
    enum Penalty {
        static let gap = -1100
        static let notStart = -700
        static let caseFold = -200
        static let byWord = -100
        static let notFull = -100
    }

    private enum CharType {
        case nonWord, upper, lower
    }

    public let pattern: [UInt16]
    private var chars: [Int] = []
    private var folded: [Int] = []
    private let astral: Bool
    /// The last match's score and matched ranges (from, to pairs in UTF-16 units of the word).
    public private(set) var score = 0
    public private(set) var matched: [Int] = []
    /// The page's `byWord.length`: its buffer is kept between matches and only grows, so a later word's scoring
    /// depends on the words matched before it with the same matcher.
    private var byWordLength = 0

    public init(_ pattern: String) {
        self.pattern = Array(pattern.utf16)
        var position = 0
        while position < self.pattern.count {
            let char = Self.codePoint(self.pattern, position), size = Self.size(char)
            chars.append(char)
            let part = Self.string(char), upper = part.uppercased()
            folded.append(Self.firstCodePoint(upper == part ? part.lowercased() : upper))
            position += size
        }
        astral = self.pattern.count != chars.count
    }

    /// Matches `word` (an option's label); nil when it does not match, else the score and the matched ranges.
    public func match(_ word: String) -> (score: Int, matched: [Int])? {
        let word = Array(word.utf16)
        guard let score = matchScore(word) else {
            return nil
        }
        return (score, matched)
    }

    private func ret(_ score: Int, _ matched: [Int]) -> Int {
        self.score = score
        self.matched = matched
        return score
    }

    // swiftlint:disable:next cyclomatic_complexity function_body_length
    private func matchScore(_ word: [UInt16]) -> Int? {
        if pattern.isEmpty {
            return ret(Penalty.notFull, [])
        }
        if word.count < pattern.count {
            return nil
        }
        // For single-character queries, only match when they occur right at the start.
        if chars.count == 1 {
            let first = Self.codePoint(word, 0), firstSize = Self.size(first)
            var score = firstSize == word.count ? 0 : Penalty.notFull
            if first == chars[0] {
                // A precise match.
            } else if first == folded[0] {
                score += Penalty.caseFold
            } else {
                return nil
            }
            return ret(score, [0, firstSize])
        }
        let direct = Self.indexOf(pattern, in: word)
        if direct == 0 {
            return ret(word.count == pattern.count ? 0 : Penalty.notFull, [0, pattern.count])
        }
        let len = chars.count
        var any = [Int](repeating: 0, count: len), precise = any, byWord = any
        var anyTo = 0
        if direct < 0 {
            var index = 0
            let end = min(word.count, 200)
            while index < end && anyTo < len {
                let next = Self.codePoint(word, index)
                if next == chars[anyTo] || next == folded[anyTo] {
                    any[anyTo] = index
                    anyTo += 1
                }
                index += Self.size(next)
            }
            // No match, exit immediately.
            if anyTo < len {
                return nil
            }
        }
        // The extent of the precise (non-folded, not necessarily adjacent) match.
        var preciseTo = 0
        // A match that hits only characters that appear to start words; byWordFolded when one was case folded.
        var byWordTo = 0, byWordFolded = false
        // A partial adjacent match.
        var adjacentTo = 0, adjacentStart = -1, adjacentEnd = -1
        let hasLower = word.contains { $0 >= 97 && $0 <= 122 }
        var wordAdjacent = true
        var index = 0, prevType = CharType.nonWord
        let end = min(word.count, 200)
        while index < end && byWordTo < len {
            let next = Self.codePoint(word, index)
            if direct < 0 {
                if preciseTo < len && next == chars[preciseTo] {
                    precise[preciseTo] = index
                    preciseTo += 1
                }
                if adjacentTo < len {
                    if next == chars[adjacentTo] || next == folded[adjacentTo] {
                        if adjacentTo == 0 {
                            adjacentStart = index
                        }
                        adjacentEnd = index + 1
                        adjacentTo += 1
                    } else {
                        adjacentTo = 0
                    }
                }
            }
            let type = Self.charType(next)
            if index == 0 || type == .upper && hasLower || prevType == .nonWord && type != .nonWord {
                let hit = chars[byWordTo] == next || folded[byWordTo] == next
                if hit && chars[byWordTo] != next {
                    byWordFolded = true
                }
                if hit {
                    byWord[byWordTo] = index
                    byWordTo += 1
                    byWordLength = max(byWordLength, byWordTo)
                } else if byWordLength > 0 {
                    wordAdjacent = false
                }
            }
            prevType = type
            index += Self.size(next)
        }
        if byWordTo == len && byWord[0] == 0 && wordAdjacent {
            return result(Penalty.byWord + (byWordFolded ? Penalty.caseFold : 0), byWord, word)
        }
        if adjacentTo == len && adjacentStart == 0 {
            return ret(Penalty.caseFold - word.count + (adjacentEnd == word.count ? 0 : Penalty.notFull),
                       [0, adjacentEnd])
        }
        if direct > -1 {
            return ret(Penalty.notStart - word.count, [direct, direct + pattern.count])
        }
        if adjacentTo == len {
            return ret(Penalty.caseFold + Penalty.notStart - word.count, [adjacentStart, adjacentEnd])
        }
        if byWordTo == len {
            return result(Penalty.byWord + (byWordFolded ? Penalty.caseFold : 0) + Penalty.notStart
                + (wordAdjacent ? 0 : Penalty.gap), byWord, word)
        }
        return chars.count == 2 ? nil
            : result((any[0] != 0 ? Penalty.notStart : 0) + Penalty.caseFold + Penalty.gap, any, word)
    }

    private func result(_ score: Int, _ positions: [Int], _ word: [UInt16]) -> Int {
        var ranges: [Int] = []
        for position in positions {
            let to = position + (astral ? Self.size(Self.codePoint(word, position)) : 1)
            if !ranges.isEmpty && ranges[ranges.count - 1] == position {
                ranges[ranges.count - 1] = to
            } else {
                ranges.append(position)
                ranges.append(to)
            }
        }
        return ret(score - word.count, ranges)
    }

    // MARK: - JavaScript string helpers

    private static func charType(_ code: Int) -> CharType {
        if code < 0xFF {
            if code >= 48 && code <= 57 || code >= 97 && code <= 122 {
                return .lower
            }
            return code >= 65 && code <= 90 ? .upper : .nonWord
        }
        let text = string(code)
        if text != text.lowercased() {
            return .upper
        }
        return text != text.uppercased() ? .lower : .nonWord
    }

    /// The code point at a UTF-16 index (codePointAt): a lone surrogate counts as itself.
    static func codePoint(_ units: [UInt16], _ index: Int) -> Int {
        guard index < units.count else {
            return 0
        }
        let first = Int(units[index])
        if first >= 0xD800 && first <= 0xDBFF && index + 1 < units.count {
            let second = Int(units[index + 1])
            if second >= 0xDC00 && second <= 0xDFFF {
                return (first - 0xD800) << 10 + (second - 0xDC00) + 0x10000
            }
        }
        return first
    }

    static func size(_ code: Int) -> Int {
        code < 0x10000 ? 1 : 2
    }

    private static func string(_ code: Int) -> String {
        Unicode.Scalar(UInt32(code)).map { String(Character($0)) } ?? String(utf16CodeUnits: [UInt16(code)], count: 1)
    }

    private static func firstCodePoint(_ text: String) -> Int {
        codePoint(Array(text.utf16), 0)
    }

    /// String.indexOf on UTF-16 units: the first index of `needle` in `haystack`, or -1.
    static func indexOf(_ needle: [UInt16], in haystack: [UInt16]) -> Int {
        guard !needle.isEmpty else {
            return 0
        }
        guard needle.count <= haystack.count else {
            return -1
        }
        for start in 0...(haystack.count - needle.count) where haystack[start] == needle[0] {
            var index = 1
            while index < needle.count && haystack[start + index] == needle[index] {
                index += 1
            }
            if index == needle.count {
                return start
            }
        }
        return -1
    }
}
