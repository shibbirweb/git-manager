// The fuzzy matcher of the current app's Command Palette and recent files (src/lib/commands/fuzzy.ts), ported line by
// line: the query's letters must appear in order; matches at word starts and runs of adjacent letters score higher,
// gaps cost a little, and each word of the query matches on its own ("push git" finds "Git: Push"). Positions are
// code points, as JavaScript's Array.from gives them, and each one compares lowercased, as toLowerCase does.
// Tests run the same inputs through the TypeScript (Fixtures/search-model.json).

import Foundation

public struct FuzzyMatch: Equatable, Sendable {
    public let score: Double
    /// Matched code point positions of the target, ascending.
    public let indices: [Int]
}

public enum Fuzzy {
    /// Longer targets are cut here: labels are short, and the cost stays bounded.
    static let maxTarget = 256
    static let maxWord = 64

    static let scoreMatch = 16.0
    static let bonusFirst = 10.0
    static let bonusWordStart = 8.0
    static let bonusCamel = 7.0
    static let bonusConsecutive = 6.0
    static let bonusCase = 1.0
    static let penaltyGap = 1.0
    static let penaltyGapMax = 6
    static let penaltyLeading = 1.0
    static let penaltyLeadingMax = 8.0
    static let penaltyUnmatched = 0.05
    /// Small: initials at word starts ("sc" for "Stash Changes") should beat a substring.
    static let bonusSubstring = 2.0

    static let separators: Set<String> = [" ", "-", "_", "/", "\\", ".", ":", ">", "(", "[", "<", ",", "@", "#", "$"]

    /// Matches `query` against `target`; nil when some word of the query is not in it. An empty query matches with
    /// score 0.
    public static func match(_ query: String, _ target: String) -> FuzzyMatch? {
        let trimmed = jsTrim(query)
        let words = splitWords(trimmed)
        if words.isEmpty {
            return FuzzyMatch(score: 0, indices: [])
        }
        let chars = Array(codePoints(target).prefix(maxTarget))
        let lower = chars.map { $0.lowercased() }
        var score = 0.0
        var matched = Set<Int>()
        for word in words {
            guard let result = matchWord(Array(codePoints(word).prefix(maxWord)), chars, lower) else {
                return nil
            }
            score += result.score
            matched.formUnion(result.indices)
        }
        // A whole-word or prefix hit beats a scattered one of the same letters.
        let compact = trimmed.lowercased()
        let lowerTarget = lower.joined()
        if Array(lowerTarget.unicodeScalars).starts(with: compact.unicodeScalars) {
            score += bonusFirst
        } else if containsScalars(lowerTarget, compact) {
            score += bonusSubstring
        }
        // Ties go to the shorter label: "Save" before "Save Workspace As".
        score -= Double(chars.count - matched.count) * penaltyUnmatched
        return FuzzyMatch(score: score, indices: matched.sorted())
    }

    /// Each code point of `text` as a string, like Array.from in JavaScript.
    public static func codePoints(_ text: String) -> [String] {
        text.unicodeScalars.map { String($0) }
    }

    /// String.prototype.trim: white space and line terminators at both ends.
    public static func jsTrim(_ text: String) -> String {
        let scalars = Array(text.unicodeScalars)
        var start = 0
        var end = scalars.count
        while start < end && isJSSpace(scalars[start]) {
            start += 1
        }
        while end > start && isJSSpace(scalars[end - 1]) {
            end -= 1
        }
        var result = String.UnicodeScalarView()
        result.append(contentsOf: scalars[start..<end])
        return String(result)
    }

    static func isJSSpace(_ scalar: Unicode.Scalar) -> Bool {
        scalar.properties.isWhitespace || scalar.value == 0xFEFF
    }

    /// query.trim().split(/\s+/) without empty words.
    static func splitWords(_ text: String) -> [String] {
        var words: [String] = []
        var current = String.UnicodeScalarView()
        for scalar in text.unicodeScalars {
            if isJSSpace(scalar) {
                if !current.isEmpty {
                    words.append(String(current))
                    current = String.UnicodeScalarView()
                }
            } else {
                current.append(scalar)
            }
        }
        if !current.isEmpty {
            words.append(String(current))
        }
        return words
    }

    /// Code point equality, as JavaScript compares strings (Swift's == would treat canonical equivalents as equal).
    static func same(_ first: String, _ second: String) -> Bool {
        first.unicodeScalars.elementsEqual(second.unicodeScalars)
    }

    /// String.prototype.includes over code points.
    static func containsScalars(_ text: String, _ part: String) -> Bool {
        let haystack = Array(text.unicodeScalars)
        let needle = Array(part.unicodeScalars)
        if needle.isEmpty {
            return true
        }
        if needle.count > haystack.count {
            return false
        }
        for start in 0...(haystack.count - needle.count)
        where haystack[start..<start + needle.count].elementsEqual(needle) {
            return true
        }
        return false
    }

    static func isUpper(_ character: String) -> Bool {
        !same(character, character.lowercased()) && same(character, character.uppercased())
    }

    static func isLowerOrDigit(_ character: String) -> Bool {
        let isDigit = character.unicodeScalars.count == 1 && ("0"..."9").contains(character.unicodeScalars.first ?? " ")
        return (!same(character, character.uppercased()) && same(character, character.lowercased())) || isDigit
    }

    /// The bonus for matching at `index`: string start, after a separator, or a camelCase hump.
    static func positionBonus(_ chars: [String], _ index: Int) -> Double {
        if index == 0 {
            return bonusFirst
        }
        let previous = chars[index - 1]
        if separators.contains(previous) {
            return bonusWordStart
        }
        if isUpper(chars[index]) && isLowerOrDigit(previous) {
            return bonusCamel
        }
        return 0
    }

    /// Best alignment of one query word in the target, by dynamic programming over (word letter, target position).
    static func matchWord(_ word: [String], _ chars: [String], _ lower: [String]) -> FuzzyMatch? {
        let m = word.count
        let n = chars.count
        if m == 0 {
            return FuzzyMatch(score: 0, indices: [])
        }
        if m > n {
            return nil
        }
        let wordLower = word.map { $0.lowercased() }
        // Quick reject: the letters must appear in order at all.
        var probe = 0
        var index = 0
        while index < n && probe < m {
            if same(lower[index], wordLower[probe]) {
                probe += 1
            }
            index += 1
        }
        if probe < m {
            return nil
        }
        let none = -Double.infinity
        // score[i * n + j]: best score with word letter i matched at target position j.
        var score = [Double](repeating: none, count: m * n)
        var from = [Int](repeating: -1, count: m * n)
        for j in 0..<n where same(lower[j], wordLower[0]) {
            let leading = min(penaltyLeadingMax, Double(j) * penaltyLeading)
            score[j] = scoreMatch + positionBonus(chars, j) + (same(chars[j], word[0]) ? bonusCase : 0) - leading
        }
        for i in 1..<max(1, m) {
            let row = i * n
            let previousRow = (i - 1) * n
            // Gaps cost at most penaltyGapMax, so every earlier letter further back than that costs the same: keep
            // their best in a running maximum and only scan the near window.
            let window = penaltyGapMax + 1
            var farBest = none
            var farFrom = -1
            var j = i
            while j < n {
                defer { j += 1 }
                let far = j - window
                if far >= i - 1 && score[previousRow + far] > farBest {
                    farBest = score[previousRow + far]
                    farFrom = far
                }
                if !same(lower[j], wordLower[i]) {
                    continue
                }
                let base = scoreMatch + positionBonus(chars, j) + (same(chars[j], word[i]) ? bonusCase : 0)
                var best = farBest == none ? none : farBest - Double(penaltyGapMax)
                var bestFrom = farBest == none ? -1 : farFrom
                var k = max(i - 1, j - window + 1)
                while k < j {
                    let before = score[previousRow + k]
                    if before != none {
                        let gap = j - k - 1
                        let cost = gap == 0 ? bonusConsecutive : -min(Double(penaltyGapMax), Double(gap) * penaltyGap)
                        let value = before + cost
                        if value > best {
                            best = value
                            bestFrom = k
                        }
                    }
                    k += 1
                }
                if bestFrom >= 0 {
                    score[row + j] = best + base
                    from[row + j] = bestFrom
                }
            }
        }
        let lastRow = (m - 1) * n
        var end = -1
        var total = none
        for j in (m - 1)..<n where score[lastRow + j] > total {
            total = score[lastRow + j]
            end = j
        }
        if end < 0 {
            return nil
        }
        var indices = [Int](repeating: 0, count: m)
        var position = end
        for i in stride(from: m - 1, through: 0, by: -1) {
            indices[i] = position
            position = i > 0 ? from[i * n + position] : position
        }
        return FuzzyMatch(score: total, indices: indices)
    }
}
