// sortOptions of @codemirror/autocomplete: every source's options filtered and scored by FuzzyMatcher against the
// text typed since the result's start, sorted by score, then by label as String.localeCompare orders them (the "en"
// collation gives the same order), then the same label offered twice is listed once: the one with a type, an apply
// or info wins (so a word that is also a keyword shows as the keyword). Sections are not used by any source here.

import Foundation

public enum CompletionSort {
    /// One source's result for the sort: its index (the order sources are asked in), the result and the text typed
    /// from the result's start to its end.
    public struct Active {
        public var source: Int
        public var result: CompletionResult
        public var typed: String
        public var resultID: Int

        public init(source: Int, result: CompletionResult, typed: String, resultID: Int = 0) {
            self.source = source
            self.result = result
            self.typed = typed
            self.resultID = resultID
        }
    }

    private static let collation = Locale(identifier: "en")

    public static func options(_ active: [Active]) -> [CompletionOption] {
        var options: [CompletionOption] = []
        for entry in active {
            if !entry.result.filter {
                for (index, option) in entry.result.options.enumerated() {
                    options.append(CompletionOption(completion: option, source: entry.source, match: [],
                                                    score: 1_000_000_000 - options.count, resultID: entry.resultID,
                                                    index: index))
                }
                continue
            }
            let matcher = FuzzyMatcher(entry.typed)
            for (index, option) in entry.result.options.enumerated() {
                guard let found = matcher.match(option.label) else {
                    continue
                }
                let matched = option.displayLabel == nil ? found.matched : []
                options.append(CompletionOption(completion: option, source: entry.source, match: matched,
                                                score: found.score + (option.boost ?? 0), resultID: entry.resultID,
                                                index: index))
            }
        }
        // Array.prototype.sort is stable, as is this merge of the indexes.
        let sorted = options.indices.sorted { left, right in
            let one = options[left], two = options[right]
            if one.score != two.score {
                return one.score > two.score
            }
            let order = compare(one.completion, two.completion)
            return order == .orderedSame ? left < right : order == .orderedAscending
        }.map { options[$0] }
        var result: [CompletionOption] = []
        var previous: Completion?
        for option in sorted {
            let current = option.completion
            if let prev = previous, !differs(prev, current) {
                if score(current) > score(prev) {
                    result[result.count - 1] = option
                }
            } else {
                result.append(option)
            }
            previous = current
        }
        return result
    }

    /// compareCompletions: sortText or label, in locale order.
    static func compare(_ one: Completion, _ two: Completion) -> ComparisonResult {
        let left = one.sortText ?? one.label, right = two.sortText ?? two.label
        return left.compare(right, options: [], range: nil, locale: collation)
    }

    /// Whether two options next to each other in the sorted list are listed apart.
    private static func differs(_ prev: Completion, _ current: Completion) -> Bool {
        prev.label != current.label || prev.detail != current.detail
            || (prev.type != nil && current.type != nil && prev.type != current.type)
            || prev.apply != current.apply || prev.boost != current.boost
    }

    /// Which of two same options to keep.
    static func score(_ option: Completion) -> Int {
        (option.boost ?? 0) * 100 + (option.apply != nil ? 10 : 0) + (option.hasInfo ? 5 : 0)
            + (option.type != nil ? 1 : 0)
    }
}
