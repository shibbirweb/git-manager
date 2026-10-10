// Occurrence commands and highlights from @codemirror/search and src/lib/editor/findModel.ts: Cmd+D
// (selectNextOccurrence: the word at each cursor, then the next match of the selection, wrapping), Select All
// Occurrences, and the matches of a single selection the editor tints (highlightSelectionMatches).

import Foundation

extension EditorCommands {
    /// Select All Occurrences works up to this many matches (findModel.ts SELECT_CAP).
    public static let selectCap = 1000

    /// Every match of `query` from `from` to `to`, left to right without overlapping (SearchCursor).
    static func matches(_ state: EditorState, _ query: String, from: Int = 0, to: Int? = nil,
                        limit: Int = Int.max) -> [Range<Int>] {
        let needle = Array(query.utf16)
        guard !needle.isEmpty else {
            return []
        }
        let end = min(to ?? state.doc.length, state.doc.length)
        let start = max(0, from)
        guard end - start >= needle.count else {
            return []
        }
        let hay = Array(state.doc.slice(start, end).utf16)
        var found: [Range<Int>] = []
        var index = 0
        while index + needle.count <= hay.count {
            if hay[index] == needle[0] && hay[index..<(index + needle.count)].elementsEqual(needle) {
                found.append((start + index)..<(start + index + needle.count))
                if found.count >= limit {
                    break
                }
                index += needle.count
            } else {
                index += 1
            }
        }
        return found
    }

    /// selectWord: each cursor selects the word around it; nil when nothing changes.
    static func selectWord(_ state: EditorState) -> TransactionSpec? {
        let selection = EditorSelection(state.selection.ranges.map { state.wordAt($0.head) ?? .cursor($0.head) },
                                        mainIndex: state.selection.mainIndex)
        return selection.sameAs(state.selection) ? nil : TransactionSpec(selection: selection)
    }

    /// Cmd+D.
    public static func selectNextOccurrence(_ state: EditorState) -> TransactionSpec? {
        let ranges = state.selection.ranges
        if ranges.contains(where: \.isEmpty) {
            return selectWord(state)
        }
        let searched = state.sliceDoc(ranges[0].from, ranges[0].to)
        if ranges.contains(where: { state.sliceDoc($0.from, $0.to) != searched }) {
            return nil
        }
        guard let found = nextOccurrence(state, searched) else {
            return nil
        }
        var spec = TransactionSpec(selection: state.selection.adding(.range(found.lowerBound, found.upperBound),
                                                                     main: false))
        spec.scrollIntoView = true
        return spec
    }

    /// findNextOccurrence: after the last range, wrapping to the start; whole words when the main range is one.
    static func nextOccurrence(_ state: EditorState, _ query: String) -> Range<Int>? {
        let main = state.selection.main, ranges = state.selection.ranges
        let word = state.wordAt(main.head)
        let fullWord = word.map { $0.from == main.from && $0.to == main.to } ?? false
        let accept: (Range<Int>) -> Bool = { match in
            guard fullWord else {
                return true
            }
            guard let found = state.wordAt(match.lowerBound) else {
                return false
            }
            return found.from == match.lowerBound && found.to == match.upperBound
        }
        if let match = matches(state, query, from: ranges[ranges.count - 1].to).first(where: accept) {
            return match
        }
        let wrapEnd = max(0, ranges[ranges.count - 1].from - 1)
        return matches(state, query, from: 0, to: wrapEnd).first { match in
            !ranges.contains { $0.from == match.lowerBound } && accept(match)
        }
    }

    /// Select All Occurrences: every match of the selection (whole words of the word at a cursor), case sensitive.
    public static func selectAllOccurrences(_ state: EditorState) -> TransactionSpec? {
        var from = state.selection.main.from, to = state.selection.main.to
        var wholeWord = false
        if from == to {
            guard let word = state.wordAt(from) else {
                return nil
            }
            from = word.from
            to = word.to
            wholeWord = true
        }
        let found = matches(state, state.sliceDoc(from, to)).filter { !wholeWord || isWholeWord(state, $0) }
        guard !found.isEmpty, found.count <= selectCap else {
            return nil
        }
        let main = found.firstIndex { $0.lowerBound == from } ?? 0
        return TransactionSpec(selection: EditorSelection(found.map { .range($0.lowerBound, $0.upperBound) },
                                                          mainIndex: main),
                               userEvent: "select.search.matches")
    }

    /// The search's whole-word test: each end of the match sits on a word boundary.
    static func isWholeWord(_ state: EditorState, _ match: Range<Int>) -> Bool {
        func boundary(_ position: Int) -> Bool {
            let before = state.category(state.sliceDoc(position - 1, position))
            let after = state.category(state.sliceDoc(position, position + 1))
            return before != .word || after != .word
        }
        return boundary(match.lowerBound) && boundary(match.upperBound)
    }
}

public enum SelectionMatches {
    /// The other matches of a single non-empty selection (up to 200 characters) in `visible`, as
    /// highlightSelectionMatches tints them; none for several ranges or more than `maxMatches`.
    public static func ranges(_ state: EditorState, visible: Range<Int>, maxMatches: Int = 100) -> [Range<Int>] {
        let selection = state.selection
        guard selection.ranges.count == 1, !selection.main.isEmpty else {
            return []
        }
        let range = selection.main
        guard range.to - range.from <= 200 else {
            return []
        }
        let query = state.sliceDoc(range.from, range.to)
        var found: [Range<Int>] = []
        for match in EditorCommands.matches(state, query, from: visible.lowerBound, to: visible.upperBound)
        where match.lowerBound >= range.to || match.upperBound <= range.from {
            found.append(match)
            if found.count > maxMatches {
                return []
            }
        }
        return found
    }
}
