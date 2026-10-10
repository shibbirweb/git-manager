// The find bar's pure logic (src/lib/editor/findModel.ts) and its commands (@codemirror/search findNext,
// findPrevious, replaceNext, replaceAll and selectMatches over a FindQuery): the counter, the selection that seeds
// the field, where typing jumps, and the transactions the bar's buttons and keys make.

import Foundation

public enum FindModel {
    /// The counter stops here so typing stays fast in huge files.
    public static let countCap = 10_000
    /// CodeMirror's own limit for selecting every match.
    public static let selectCap = 1_000
    /// Longer selections do not seed the find field.
    public static let maxSelectionQuery = 500

    public struct MatchCount: Equatable, Sendable {
        public let total: Int
        /// There are more than `total`.
        public let capped: Bool
        /// 1-based index of the match the main selection covers.
        public let current: Int?

        public init(total: Int, capped: Bool, current: Int?) {
            self.total = total
            self.capped = capped
            self.current = current
        }
    }

    public struct Counter: Equatable, Sendable {
        public let text: String
        /// No match, or an invalid regex: the field and the counter turn red.
        public let problem: Bool

        public init(text: String, problem: Bool) {
            self.text = text
            self.problem = problem
        }
    }

    /// Why a regex cannot be used, or nil when it can (or Regex is off).
    public static func regexError(_ search: String, regex: Bool) -> String? {
        guard regex, !search.isEmpty else {
            return nil
        }
        do {
            _ = try NSRegularExpression(pattern: search)
            return nil
        } catch {
            return "Invalid regular expression: /\(search)/"
        }
    }

    /// The field's text for a selection, or nil to keep the query: only a short one-line selection seeds it,
    /// escaped when Regex is on.
    public static func selectionQuery(_ selected: String, regex: Bool) -> String? {
        let length = (selected as NSString).length
        if selected.isEmpty || length > maxSelectionQuery || selected.contains(where: { $0 == "\n" || $0 == "\r" })
            || selected.unicodeScalars.contains(where: { $0 == "\r" || $0 == "\n" }) {
            return nil
        }
        return regex ? NSRegularExpression.escapedPattern(for: selected) : selected
    }

    public static func count(_ state: EditorState, _ query: FindQuery, cap: Int = countCap) -> MatchCount {
        guard query.valid else {
            return MatchCount(total: 0, capped: false, current: nil)
        }
        let found = query.matches(in: state.doc, limit: cap + 1)
        let main = state.selection.main
        let current = found.prefix(cap).firstIndex { $0.lowerBound == main.from && $0.upperBound == main.to }
        return MatchCount(total: min(found.count, cap), capped: found.count > cap, current: current.map { $0 + 1 })
    }

    /// "3/12", "12 results", "1 result", "0 results", "10000+" or "Invalid regex".
    public static func counter(_ search: String, _ count: MatchCount, error: String?) -> Counter {
        if error != nil {
            return Counter(text: "Invalid regex", problem: true)
        }
        if search.isEmpty {
            return Counter(text: "", problem: false)
        }
        if count.total == 0 {
            return Counter(text: "0 results", problem: true)
        }
        let total = count.capped ? "\(count.total)+" : "\(count.total)"
        if let current = count.current {
            return Counter(text: "\(current)/\(total)", problem: false)
        }
        if count.capped {
            return Counter(text: total, problem: false)
        }
        return Counter(text: "\(total) \(count.total == 1 ? "result" : "results")", problem: false)
    }

    /// The first match at or after `anchor`, wrapping to the start: where typing jumps.
    public static func firstMatch(_ state: EditorState, _ query: FindQuery, from anchor: Int) -> Range<Int>? {
        let doc = state.doc
        if let after = query.matches(in: doc, from: min(anchor, doc.length), limit: 1).first {
            return after
        }
        let end = min(doc.length, anchor + (query.search as NSString).length)
        return query.matches(in: doc, from: 0, to: end, limit: 1).first
    }
}

extension EditorCommands {
    /// findNext: the next match after the main selection, wrapping; nil when there is none other than it.
    public static func findNext(_ state: EditorState, _ query: FindQuery) -> TransactionSpec? {
        let main = state.selection.main
        guard let next = nextMatch(state.doc, query, from: main.from, to: main.to) else {
            return nil
        }
        return TransactionSpec(selection: .single(next.lowerBound, next.upperBound), userEvent: "select.search",
                               scrollIntoView: true)
    }

    public static func findPrevious(_ state: EditorState, _ query: FindQuery) -> TransactionSpec? {
        let main = state.selection.main
        guard let previous = previousMatch(state.doc, query, from: main.from, to: main.to) else {
            return nil
        }
        return TransactionSpec(selection: .single(previous.lowerBound, previous.upperBound),
                               userEvent: "select.search", scrollIntoView: true)
    }

    /// replaceNext: the selected match replaced, then the next one selected; or just the next one found.
    public static func replaceNext(_ state: EditorState, _ query: FindQuery) -> TransactionSpec? {
        let doc = state.doc
        let main = state.selection.main
        guard let match = nextMatch(doc, query, from: main.from, to: main.from) else {
            return nil
        }
        var changes: [ChangeSpec] = []
        var next: Range<Int>? = match
        if match.lowerBound == main.from && match.upperBound == main.to {
            changes.append(ChangeSpec(from: match.lowerBound, to: match.upperBound,
                                      insert: query.replacement(for: match, in: doc)))
            next = nextMatch(doc, query, from: match.lowerBound, to: match.upperBound)
        }
        let changeSet = ChangeSet.of(changes, length: doc.length)
        let selection = next.map { range -> EditorSelection in
            .single(changeSet.mapPos(range.lowerBound, assoc: 1) ?? range.lowerBound,
                    changeSet.mapPos(range.upperBound, assoc: 1) ?? range.upperBound)
        }
        return TransactionSpec(changes: changeSet, selection: selection, userEvent: "input.replace",
                               scrollIntoView: selection != nil)
    }

    /// replaceAll: every match replaced in one change, with how many there were.
    public static func replaceAll(_ state: EditorState, _ query: FindQuery) -> (spec: TransactionSpec, count: Int)? {
        let doc = state.doc
        let found = query.matches(in: doc)
        guard !found.isEmpty else {
            return nil
        }
        let changes = found.map { ChangeSpec(from: $0.lowerBound, to: $0.upperBound,
                                             insert: query.replacement(for: $0, in: doc)) }
        return (TransactionSpec(changes: ChangeSet.of(changes, length: doc.length), userEvent: "input.replace.all"),
                found.count)
    }

    /// selectMatches: a cursor on every match, at most `cap`; nil when there are none or more than that.
    public static func selectMatches(_ state: EditorState, _ query: FindQuery,
                                     cap: Int = FindModel.selectCap) -> TransactionSpec? {
        let found = query.matches(in: state.doc, limit: cap + 1)
        guard !found.isEmpty, found.count <= cap else {
            return nil
        }
        let ranges = found.map { SelectionRange.range($0.lowerBound, $0.upperBound) }
        return TransactionSpec(selection: EditorSelection(ranges, mainIndex: 0),
                               userEvent: "select.search.matches")
    }

    /// StringQuery.nextMatch: the first match at or after `to` (overlapping), else from the start; nil when that is
    /// the selection itself.
    static func nextMatch(_ doc: TextDocument, _ query: FindQuery, from: Int, to: Int) -> Range<Int>? {
        var found = query.matches(in: doc, from: to, limit: 1, overlapping: true).first
        if found == nil {
            let end = min(doc.length, from + (query.search as NSString).length)
            found = query.matches(in: doc, from: 0, to: end, limit: 1, overlapping: true).first
        }
        guard let found, !(found.lowerBound == from && found.upperBound == to) else {
            return nil
        }
        return found
    }

    /// prevMatch: the last match before `from`, else the last one after `to` (wrapping).
    static func previousMatch(_ doc: TextDocument, _ query: FindQuery, from: Int, to: Int) -> Range<Int>? {
        var found = query.matches(in: doc, from: 0, to: from, overlapping: true).last
        if found == nil {
            let start = max(0, to - (query.search as NSString).length)
            found = query.matches(in: doc, from: start, overlapping: true).last
        }
        guard let found, !(found.lowerBound == from && found.upperBound == to) else {
            return nil
        }
        return found
    }
}
