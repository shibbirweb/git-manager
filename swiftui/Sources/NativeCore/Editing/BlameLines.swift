// The blame of the editor's text line by line (src/lib/editor/blameModel.ts fromInfo and mapBlame): each line's
// commit from the bridge's runs, and as the text changes every line an edit touches becomes the user's own,
// uncommitted, until the next blame answers.

import Foundation

public struct BlameLines: Equatable, Sendable {
    public let commits: [BlameCommit]
    /// Each line's index into `commits`; -1 for a line edited since the blame.
    public private(set) var lines: [Int]

    public static let localEdit = -1

    /// Expands `runs` to `lineCount` lines; lines after the last run take its commit, as fromInfo does.
    public init(_ blame: BlameRuns, lineCount: Int) {
        commits = blame.commits
        var lines: [Int] = []
        lines.reserveCapacity(lineCount)
        var index = 0
        while index + 1 < blame.runs.count {
            lines.append(contentsOf: repeatElement(blame.runs[index + 1], count: max(0, blame.runs[index])))
            index += 3
        }
        let last = lines.last ?? Self.localEdit
        while lines.count < lineCount {
            lines.append(last)
        }
        self.lines = Array(lines.prefix(lineCount))
    }

    public func commit(atLine line: Int) -> BlameCommit? {
        guard lines.indices.contains(line), commits.indices.contains(lines[line]) else {
            return nil
        }
        return commits[lines[line]]
    }

    /// mapBlame: the lines each change touches become local edits, the rest move with the text.
    public func mapped(_ changes: ChangeSet, oldDoc: TextDocument, newDoc: TextDocument) -> BlameLines {
        var edits: [(oldFrom: Int, oldTo: Int, newFrom: Int, newTo: Int)] = []
        changes.iterChanges { fromA, toA, fromB, toB, _ in
            edits.append((oldDoc.lineAt(fromA).index, oldDoc.lineAt(toA).index,
                          newDoc.lineAt(fromB).index, newDoc.lineAt(toB).index))
        }
        if edits.isEmpty {
            return self
        }
        var result = self
        for edit in edits.reversed() {
            let count = edit.newTo - edit.newFrom + 1
            let lower = min(edit.oldFrom, result.lines.count), upper = min(edit.oldTo + 1, result.lines.count)
            result.lines.replaceSubrange(lower..<upper, with: repeatElement(Self.localEdit, count: count))
        }
        while result.lines.count < newDoc.lineCount {
            result.lines.append(Self.localEdit)
        }
        result.lines = Array(result.lines.prefix(newDoc.lineCount))
        return result
    }
}
