// Which change stays selected (and keeps its diff open) after a status refresh, and the paths a stage or unstage
// sends, as the current app does it (src/lib/views/changes/sections.ts resolveSelection, fileStatus.ts).

import Foundation

/// A row of the Changes list: a file in the Staged or the Changes group.
public struct ChangeRow: Equatable, Sendable {
    public let path: String
    public let staged: Bool

    public init(path: String, staged: Bool) {
        self.path = path
        self.staged = staged
    }
}

public enum ChangeSelection {
    /// The rows in list order: Staged, then Changes (conflicts are not selectable).
    public static func rows(staged: [String], unstaged: [String]) -> [ChangeRow] {
        staged.map { ChangeRow(path: $0, staged: true) } + unstaged.map { ChangeRow(path: $0, staged: false) }
    }

    /// After a refresh: the same row when it is still there; the same file in the other group when it moved (it
    /// was just staged or unstaged); otherwise the row now at the old row's place, or nil when nothing changed.
    public static func follow(_ current: ChangeRow?, rows: [ChangeRow], lastIndex: Int) -> ChangeRow? {
        guard let current else {
            return nil
        }
        if rows.contains(current) {
            return current
        }
        let moved = ChangeRow(path: current.path, staged: !current.staged)
        if rows.contains(moved) {
            return moved
        }
        guard !rows.isEmpty else {
            return nil
        }
        return rows[max(0, min(lastIndex, rows.count - 1))]
    }

    /// The paths to unstage: each file's, plus the old path of a staged rename, once each in order.
    public static func unstagePaths(_ files: [(path: String, origPath: String?)]) -> [String] {
        var seen = Set<String>()
        var paths: [String] = []
        for file in files {
            for path in [file.path, file.origPath].compactMap({ $0 }) where seen.insert(path).inserted {
                paths.append(path)
            }
        }
        return paths
    }
}
