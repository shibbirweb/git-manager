// The welcome screen's project list (src/lib/views/welcomeModel.ts): a colored badge of each project's initials,
// the search over names and paths, and the keys that move the selection.

import Foundation

public enum WelcomeList {
    /// Badge colors as terminal palette tokens (--term-<color>); yellow is left out, white letters do not read on it.
    public static let badgeColors = ["blue", "green", "magenta", "cyan", "red"]

    /// The words of a name: split at spaces, dashes, underscores, dots, commas and plus signs and where a lower
    /// letter or digit meets an upper one; words without a letter or digit are dropped.
    static func nameWords(_ name: String) -> [String] {
        let split = name.replacingOccurrences(of: #"([a-z0-9])([A-Z])"#, with: "$1 $2", options: .regularExpression)
        let wordy = CharacterSet.letters.union(.decimalDigits)
        return split.components(separatedBy: CharacterSet(charactersIn: " \t\n\r-_.,+"))
            .filter { word in word.unicodeScalars.contains { wordy.contains($0) } }
    }

    /// Two letters for a badge: the first letters of the first two words, or the first two letters of one word.
    public static func initials(_ name: String) -> String {
        let words = nameWords(name)
        guard let first = words.first else {
            return "?"
        }
        if words.count == 1 {
            return String(first.unicodeScalars.prefix(2).map(Character.init)).uppercased()
        }
        let second = words[1]
        return (first.unicodeScalars.first.map(String.init) ?? "")
            .appending(second.unicodeScalars.first.map(String.init) ?? "").uppercased()
    }

    /// A color that stays the same for a project from run to run (the same 32-bit string hash).
    public static func badgeColor(_ key: String) -> String {
        var hash: UInt32 = 0
        for scalar in key.unicodeScalars {
            hash = hash &* 31 &+ scalar.value
        }
        return badgeColors[Int(hash % UInt32(badgeColors.count))]
    }

    /// The entries whose name or paths hold every word of `query`, ignoring case; an empty query keeps them all.
    public static func filter(_ entries: [RecentEntry], query: String) -> [RecentEntry] {
        let words = query.lowercased().split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard !words.isEmpty else {
            return entries
        }
        return entries.filter { entry in
            let text = ([entry.label] + entry.paths).joined(separator: "\n").lowercased()
            return words.allSatisfy { text.contains($0) }
        }
    }

    /// The row an arrow key, Home or End moves to; nil for other keys or an empty list.
    public static func moveSelection(_ index: Int, key: String, count: Int) -> Int? {
        guard count > 0 else {
            return nil
        }
        switch key {
        case "ArrowDown":
            return min(count - 1, index + 1)
        case "ArrowUp":
            return max(0, index - 1)
        case "Home":
            return 0
        case "End":
            return count - 1
        default:
            return nil
        }
    }
}
