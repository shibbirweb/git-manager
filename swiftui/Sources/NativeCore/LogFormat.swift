// The Log's texts, ported from src/lib/log/format.ts and LogView.svelte: relative and full dates (Intl's en-US
// formats), status letters, the order of ref labels, a path's name and folder, the toolbar's count and the split of
// a commit message into its subject and the rest.

import Foundation

public enum LogFormat {
    private static let minute = 60
    private static let hour = 60 * minute
    private static let day = 24 * hour

    /// Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }): "Sep 29, 2026".
    public static func shortDate(_ seconds: Int, timeZone: TimeZone = .current) -> String {
        formatter("MMM d, yyyy", timeZone: timeZone).string(from: Date(timeIntervalSince1970: TimeInterval(seconds)))
    }

    /// The details' date, Intl's en-US weekday, date and 2-digit time: "Tue, Oct 6, 2026 at 08:51 PM".
    public static func fullDate(_ seconds: Int, timeZone: TimeZone = .current) -> String {
        formatter("EEE, MMM d, yyyy 'at' hh:mm a", timeZone: timeZone)
            .string(from: Date(timeIntervalSince1970: TimeInterval(seconds)))
    }

    /// The list's date: "just now", "5 min ago", "2 h ago", "yesterday", "3 d ago", then the short date.
    public static func relativeTime(_ seconds: Int, now: Date = Date(), timeZone: TimeZone = .current) -> String {
        let elapsed = Int(now.timeIntervalSince1970.rounded(.down)) - seconds
        if elapsed < 0 {
            return shortDate(seconds, timeZone: timeZone)
        }
        if elapsed < minute {
            return "just now"
        }
        if elapsed < hour {
            return "\(elapsed / minute) min ago"
        }
        if elapsed < day {
            return "\(elapsed / hour) h ago"
        }
        if elapsed < 7 * day {
            let days = elapsed / day
            return days == 1 ? "yesterday" : "\(days) d ago"
        }
        return shortDate(seconds, timeZone: timeZone)
    }

    public static func statusLetter(_ status: String) -> String {
        switch status {
        case "added":
            return "A"
        case "deleted":
            return "D"
        case "renamed":
            return "R"
        case "copied":
            return "C"
        case "typechange":
            return "T"
        default:
            return "M"
        }
    }

    /// HEAD's branch first, then local branches, tags and remote branches; the same kind keeps its order.
    public static func sortRefs<Ref>(_ refs: [Ref], kind: (Ref) -> String) -> [Ref] {
        let order = ["head": 0, "local": 1, "tag": 2, "remote": 3]
        return refs.enumerated()
            .sorted { left, right in
                let leftRank = order[kind(left.element)] ?? 9
                let rightRank = order[kind(right.element)] ?? 9
                return leftRank == rightRank ? left.offset < right.offset : leftRank < rightRank
            }
            .map(\.element)
    }

    public static func fileName(_ filePath: String) -> String {
        guard let slash = filePath.lastIndex(of: "/") else {
            return filePath
        }
        return String(filePath[filePath.index(after: slash)...])
    }

    public static func fileDir(_ filePath: String) -> String {
        guard let slash = filePath.lastIndex(of: "/") else {
            return ""
        }
        return String(filePath[..<slash])
    }

    /// The toolbar's count: "300+ commits", "1 commit", or "4 of 300+ loaded commits" while filtering.
    public static func countLabel(loaded: Int, hasMore: Bool, filtered: Int?) -> String {
        let number = NumberFormatter()
        number.numberStyle = .decimal
        number.locale = Locale(identifier: "en_US")
        let text = { (value: Int) in number.string(from: NSNumber(value: value)) ?? "\(value)" }
        let loadedText = text(loaded) + (hasMore ? "+" : "")
        if let filtered {
            return "\(text(filtered)) of \(loadedText) loaded commits"
        }
        return "\(loadedText) \(loaded == 1 ? "commit" : "commits")"
    }

    /// CommitDetails.svelte's body: the first line trimmed, and the rest without its leading blank lines.
    public static func splitMessage(_ message: String) -> (subject: String, rest: String) {
        guard let newline = message.firstIndex(of: "\n") else {
            return (message.trimmingCharacters(in: .whitespacesAndNewlines), "")
        }
        let subject = String(message[..<newline]).trimmingCharacters(in: .whitespacesAndNewlines)
        var rest = String(message[message.index(after: newline)...])
        // /^\s*\n/: leading whitespace up to and including the last newline before the text.
        if let range = rest.range(of: #"^\s*\n"#, options: .regularExpression) {
            rest.removeSubrange(range)
        }
        while let last = rest.last, last.isWhitespace {
            rest.removeLast()
        }
        return (subject, rest)
    }

    /// Formatters are slow to make and the list asks for dates on every scrolled frame, so they are kept.
    private nonisolated(unsafe) static var formatters: [String: DateFormatter] = [:]
    private static let formattersLock = NSLock()

    private static func formatter(_ format: String, timeZone: TimeZone) -> DateFormatter {
        formattersLock.lock()
        defer {
            formattersLock.unlock()
        }
        let key = "\(format)|\(timeZone.identifier)"
        if let known = formatters[key] {
            return known
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = format
        formatters[key] = formatter
        return formatter
    }
}
