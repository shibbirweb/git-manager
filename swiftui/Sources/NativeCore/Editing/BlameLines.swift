// The blame of the editor's text line by line (src/lib/editor/blameModel.ts fromInfo and mapBlame): each line's
// commit from the bridge's runs, and as the text changes every line an edit touches becomes the user's own,
// uncommitted, until the next blame answers.

import Foundation

public struct BlameLines: Equatable, Sendable {
    public let commits: [BlameCommit]
    /// Each line's index into `commits`; -1 for a line edited since the blame.
    public private(set) var lines: [Int]
    /// Each line's 0-based line in its commit's version of the file; -1 when unknown (an edit, or past the runs).
    public private(set) var origins: [Int]

    public static let localEdit = -1
    public static let unknownLine = -1

    /// Expands `runs` to `lineCount` lines; lines after the last run take its commit, as fromInfo does.
    public init(_ blame: BlameRuns, lineCount: Int) {
        commits = blame.commits
        var lines: [Int] = []
        var origins: [Int] = []
        lines.reserveCapacity(lineCount)
        var index = 0
        while index + 1 < blame.runs.count {
            let length = max(0, blame.runs[index])
            let originalStart = index + 2 < blame.runs.count ? blame.runs[index + 2] : Self.unknownLine
            lines.append(contentsOf: repeatElement(blame.runs[index + 1], count: length))
            origins.append(contentsOf: (0..<length).map { originalStart < 0 ? Self.unknownLine : originalStart + $0 })
            index += 3
        }
        let last = lines.last ?? Self.localEdit
        while lines.count < lineCount {
            lines.append(last)
            origins.append(Self.unknownLine)
        }
        self.lines = Array(lines.prefix(lineCount))
        self.origins = Array(origins.prefix(lineCount))
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
            let originLower = min(edit.oldFrom, result.origins.count)
            let originUpper = min(edit.oldTo + 1, result.origins.count)
            let unknown = repeatElement(Self.unknownLine, count: count)
            result.origins.replaceSubrange(originLower..<originUpper, with: unknown)
        }
        while result.lines.count < newDoc.lineCount {
            result.lines.append(Self.localEdit)
        }
        while result.origins.count < newDoc.lineCount {
            result.origins.append(Self.unknownLine)
        }
        result.lines = Array(result.lines.prefix(newDoc.lineCount))
        result.origins = Array(result.origins.prefix(newDoc.lineCount))
        return result
    }
}

extension BlameLines {
    /// commitLineTarget: the clicked line's line in the commit's version, or the editor's line with its text when
    /// the origin is unknown, so the Log can look for it (findLine).
    public func commitLineTarget(_ line: Int, lineText: String) -> (line: Int, lineText: String?) {
        if origins.indices.contains(line), origins[line] >= 0 {
            return (origins[line], nil)
        }
        return (line, lineText)
    }

    /// lineMatch.ts findLine: `lineText` nearest to `hintLine` (above first at equal distance), else the hint.
    public static func findLine(_ text: String, hintLine: Int, lineText: String?) -> Int {
        // By UTF-16 units: Swift counts "\r\n" as one character, which a split on "\n" would not find.
        let lines = text.components(separatedBy: "\n")
        let hint = max(0, min(hintLine, lines.count - 1))
        guard let lineText else {
            return hint
        }
        let wanted = lineText.hasSuffix("\r") ? String(lineText.dropLast()) : lineText
        let matches = { (index: Int) -> Bool in
            let candidate = lines[index]
            return (candidate.hasSuffix("\r") ? String(candidate.dropLast()) : candidate) == wanted
        }
        for distance in 0..<lines.count {
            if hint - distance >= 0 && matches(hint - distance) {
                return hint - distance
            }
            if distance > 0 && hint + distance < lines.count && matches(hint + distance) {
                return hint + distance
            }
        }
        return hint
    }
}
