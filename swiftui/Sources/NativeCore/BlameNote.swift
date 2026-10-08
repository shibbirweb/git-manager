// The cursor line's blame note (src/lib/editor/blame.ts describe, blameModel.ts fromInfo, log/format.ts
// relativeTime): "Leo Park, Aug 31, 2026 • Add the product catalog", or "You, Uncommitted changes" for a line not
// committed yet, from the bridge's `blame_contents` runs.

import Foundation

/// One commit of a blame, as the bridge sends it (src-tauri/src/git/blame.rs BlameCommit).
public struct BlameCommit: Decodable, Equatable, Sendable {
    public let id: String
    public let authorName: String
    /// Seconds since the epoch.
    public let authorTime: Int64
    public let summary: String
    public let uncommitted: Bool

    public init(id: String, authorName: String, authorTime: Int64, summary: String, uncommitted: Bool) {
        self.id = id
        self.authorName = authorName
        self.authorTime = authorTime
        self.summary = summary
        self.uncommitted = uncommitted
    }
}

/// The bridge's answer: the commits and `[length, commit, originalStart]` per run of lines.
public struct BlameRuns: Decodable, Equatable, Sendable {
    public let commits: [BlameCommit]
    public let runs: [Int]

    public init(commits: [BlameCommit], runs: [Int]) {
        self.commits = commits
        self.runs = runs
    }
}

public enum BlameNote {
    public static let uncommitted = "You, Uncommitted changes"

    /// The commit that owns 0-based `line`, nil for a line no run covers. Like fromInfo, a line after the last run
    /// (git counts no line after a trailing newline; the editor has an empty last line) takes the last run's commit.
    public static func commit(atLine line: Int, in blame: BlameRuns) -> BlameCommit? {
        var start = 0
        var last: Int?
        var index = 0
        while index + 2 < blame.runs.count {
            let length = blame.runs[index], commit = blame.runs[index + 1]
            if line < start + length {
                return blame.commits.indices.contains(commit) ? blame.commits[commit] : nil
            }
            start += length
            last = commit
            index += 3
        }
        guard let last, blame.commits.indices.contains(last) else {
            return nil
        }
        return blame.commits[last]
    }

    /// The note's text for `commit`; nil (no blame, an untracked file) reads as uncommitted, as allUncommitted does.
    public static func label(_ commit: BlameCommit?, now: Date = Date()) -> String {
        guard let commit, !commit.uncommitted else {
            return uncommitted
        }
        let summary = commit.summary.isEmpty ? "(no message)" : commit.summary
        return "\(commit.authorName), \(relativeTime(commit.authorTime, now: now)) • \(summary)"
    }

    /// "just now", "5 min ago", "3 h ago", "yesterday", "4 d ago", else "Aug 31, 2026" in the local time zone.
    public static func relativeTime(_ seconds: Int64, now: Date = Date(), timeZone: TimeZone = .current) -> String {
        let minute: Int64 = 60, hour = 60 * minute, day = 24 * hour
        let elapsed = Int64(floor(now.timeIntervalSince1970)) - seconds
        if elapsed >= 0 && elapsed < minute {
            return "just now"
        }
        if elapsed >= 0 && elapsed < hour {
            return "\(elapsed / minute) min ago"
        }
        if elapsed >= 0 && elapsed < day {
            return "\(elapsed / hour) h ago"
        }
        if elapsed >= 0 && elapsed < 7 * day {
            let days = elapsed / day
            return days == 1 ? "yesterday" : "\(days) d ago"
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.timeZone = timeZone
        formatter.dateFormat = "MMM d, yyyy"
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(seconds)))
    }
}
