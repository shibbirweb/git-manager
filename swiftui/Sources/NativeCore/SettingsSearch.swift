// Search in the Settings dialog, as src/lib/views/settings/settingsSearch.ts does it: words are runs of letters and
// digits, lowercased; a text matches when every search word starts one of its words. The section list keeps the
// sections with a match, and the open section keeps the blocks visibleBlocks keeps.

import Foundation

public struct SettingsSearchEntry: Equatable, Sendable {
    public let section: String
    /// The row or group title as the dialog shows it.
    public let label: String
    /// More words that find the row.
    public let keywords: String

    public init(section: String, label: String, keywords: String = "") {
        self.section = section
        self.label = label
        self.keywords = keywords
    }
}

/// A block of a section in page order: what the search keeps of it depends on its kind.
public enum SearchBlockKind: Sendable {
    case group, hint, row, subRow, other
}

public enum SettingsSearch {
    /// The words of a search: lowercased, unique, in order; punctuation separates words ("Cmd+E" is cmd and e).
    public static func words(_ query: String) -> [String] {
        var seen: [String] = []
        for word in split(query.lowercased()) where !seen.contains(word) {
            seen.append(word)
        }
        return seen
    }

    /// True when every search word starts a word of the text.
    public static func matches(_ text: String, _ searchWords: [String]) -> Bool {
        if searchWords.isEmpty {
            return false
        }
        let textWords = split(text.lowercased())
        return searchWords.allSatisfy { word in textWords.contains { $0.hasPrefix(word) } }
    }

    /// The entries every word finds in the label, its keywords or its section's name.
    public static func matchingEntries(
        _ searchWords: [String], sectionLabels: [String: String], index: [SettingsSearchEntry]
    ) -> [SettingsSearchEntry] {
        if searchWords.isEmpty {
            return []
        }
        return index.filter { entry in
            matches("\(entry.label) \(entry.keywords) \(sectionLabels[entry.section] ?? "")", searchWords)
        }
    }

    /// The character ranges of `text` to highlight: the part of each word that a search word starts, the longest.
    public static func highlightRanges(_ text: String, _ searchWords: [String]) -> [Range<Int>] {
        if searchWords.isEmpty {
            return []
        }
        var ranges: [Range<Int>] = []
        let characters = Array(text.lowercased())
        var index = 0
        while index < characters.count {
            if !isWordCharacter(characters[index]) {
                index += 1
                continue
            }
            var end = index
            while end < characters.count && isWordCharacter(characters[end]) {
                end += 1
            }
            let word = String(characters[index..<end])
            let longest = searchWords.filter { word.hasPrefix($0) }.map(\.count).max() ?? 0
            if longest > 0 {
                ranges.append(index..<(index + longest))
            }
            index = end
        }
        return ranges
    }

    /// Which blocks stay on screen during a search: a matched group title keeps its group; a matched row keeps the
    /// sub-rows under it; a group title and its hint show while any of its rows do; anything else follows the block
    /// before it, and shows when it comes first.
    public static func visibleBlocks(_ blocks: [(kind: SearchBlockKind, matched: Bool)]) -> [Bool] {
        var visible = Array(repeating: false, count: blocks.count)
        var groupOf = Array(repeating: -1, count: blocks.count)
        var group = -1
        var groupMatched = false
        var rowVisible = false
        for (index, block) in blocks.enumerated() {
            if block.kind == .group {
                group = index
                groupMatched = block.matched
                rowVisible = false
                continue
            }
            groupOf[index] = group
            if block.kind == .row {
                rowVisible = block.matched || groupMatched
                visible[index] = rowVisible
            } else if block.kind == .subRow {
                visible[index] = block.matched || groupMatched || rowVisible
            }
        }
        for (index, block) in blocks.enumerated() where block.kind == .group {
            visible[index] = block.matched || groupOf.indices.contains { groupOf[$0] == index && visible[$0] }
        }
        for (index, block) in blocks.enumerated() {
            if block.kind == .hint {
                visible[index] = groupOf[index] >= 0 && visible[groupOf[index]]
            } else if block.kind == .other {
                visible[index] = index == 0 || visible[index - 1]
            }
        }
        return visible
    }

    private static func split(_ text: String) -> [String] {
        text.split { !isWordCharacter($0) }.map(String.init)
    }

    private static func isWordCharacter(_ character: Character) -> Bool {
        character.isLetter || character.isNumber
    }
}
