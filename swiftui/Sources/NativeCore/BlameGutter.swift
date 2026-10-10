// The blame gutter beside the code (src/lib/editor/blame.ts blameGutter, blameModel.ts ageRanks): one cell per line,
// the first line of each block of lines from one commit showing "shortId author age" with a line above it, and every
// cell a 3-point bar on its left in the accent at 20% to 95% by the commit's age (newest strongest) or the warning
// color for uncommitted lines.

import Foundation

public enum BlameGutter {
    /// The gutter's width with its 1-point right border (.cm-blame-gutter).
    public static let width = 236.0

    public struct Cell: Equatable, Sendable {
        /// The label, on a block's first line only.
        public let text: String?
        /// Starts a block: the line above it.
        public let first: Bool
        public let uncommitted: Bool
        /// The bar's accent share in percent (20 to 95), as --blame-heat.
        public let heatPercent: Int
    }

    /// ageRanks: each commit's rank among the distinct author times, 0 (oldest) to 1 (newest); 1 for an uncommitted
    /// one or when there is only one time.
    public static func ageRanks(_ commits: [BlameCommit]) -> [Double] {
        let times = Array(Set(commits.filter { !$0.uncommitted }.map(\.authorTime))).sorted()
        return commits.map { commit in
            if commit.uncommitted || times.count <= 1 {
                return 1
            }
            return Double(times.firstIndex(of: commit.authorTime) ?? 0) / Double(times.count - 1)
        }
    }

    /// gutterText: "Uncommitted", or the short id, author and age. The page joins them with two spaces, which HTML
    /// collapses to one.
    public static func text(_ commit: BlameCommit?, now: Date = Date(), timeZone: TimeZone = .current) -> String {
        guard let commit, !commit.uncommitted else {
            return "Uncommitted"
        }
        let age = BlameNote.relativeTime(commit.authorTime, now: now, timeZone: timeZone)
        return "\(commit.id.prefix(7)) \(commit.authorName) \(age)"
    }

    /// The cell of 0-based `line` (markerFor).
    public static func cell(
        _ blame: BlameLines, line: Int, ranks: [Double], now: Date = Date(), timeZone: TimeZone = .current
    ) -> Cell? {
        guard blame.lines.indices.contains(line) else {
            return nil
        }
        let owner = blame.lines[line]
        let first = line == 0 || blame.lines[line - 1] != owner
        let commit = blame.commit(atLine: line)
        let uncommitted = owner < 0 || commit?.uncommitted ?? true
        let heat = owner >= 0 && ranks.indices.contains(owner) ? ranks[owner] : 1
        return Cell(
            text: first ? text(uncommitted ? nil : commit, now: now, timeZone: timeZone) : nil,
            first: first, uncommitted: uncommitted, heatPercent: Int((20 + heat * 75).rounded())
        )
    }
}
