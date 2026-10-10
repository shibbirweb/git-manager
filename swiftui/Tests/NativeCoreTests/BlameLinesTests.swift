// Blame line origins, the clicked line's target in the Log and the line search there, checked against
// blameModel.test.ts and lineMatch.test.ts.

import Foundation
import NativeCore
import Testing

private let commits = [
    BlameCommit(id: "a", authorName: "a", authorTime: 100, summary: "a", uncommitted: false),
    BlameCommit(id: "b", authorName: "b", authorTime: 200, summary: "b", uncommitted: false),
]

@Test func runsGiveEachLineItsOwnerAndOrigin() {
    let blame = BlameLines(BlameRuns(commits: commits, runs: [3, 0, 5, 2, 1, 0]), lineCount: 5)
    #expect(blame.lines == [0, 0, 0, 1, 1])
    #expect(blame.origins == [5, 6, 7, 0, 1])
    let padded = BlameLines(BlameRuns(commits: commits, runs: [1, 0, 4, 1, 1, 9]), lineCount: 3)
    #expect(padded.origins == [4, 9, BlameLines.unknownLine])
}

@Test func originsMoveWithEditsAndAreForgottenOnEditedLines() {
    let oldDoc = TextDocument(lines: ["one", "two", "three", "four"])
    let blame = BlameLines(BlameRuns(commits: commits, runs: [2, 0, 10, 2, 1, 3]), lineCount: 4)
    let changes = ChangeSet.of([ChangeSpec(from: 3, insert: "\nnew")], length: oldDoc.length)
    let newDoc = changes.apply(to: oldDoc)
    #expect(blame.mapped(changes, oldDoc: oldDoc, newDoc: newDoc).origins == [-1, -1, 11, 3, 4])
}

@Test func aClickedLineTargetsItsOriginElseItsText() {
    let blame = BlameLines(BlameRuns(commits: commits, runs: [1, 0, 7]), lineCount: 2)
    #expect(blame.commitLineTarget(0, lineText: "one") == (7, nil))
    #expect(blame.commitLineTarget(1, lineText: "two") == (1, "two"))
}

@Test func findLineLooksNearTheHintLikeTheCurrentApp() {
    let text = ["import a;", "", "function one() {", "  return 1;", "}", "", "function two() {", "  return 2;", "}"]
        .joined(separator: "\n")
    #expect(BlameLines.findLine(text, hintLine: 3, lineText: nil) == 3)
    #expect(BlameLines.findLine(text, hintLine: 7, lineText: "  return 2;") == 7)
    #expect(BlameLines.findLine(text, hintLine: 9, lineText: "  return 2;") == 7)
    #expect(BlameLines.findLine(text, hintLine: 0, lineText: "  return 1;") == 3)
    #expect(BlameLines.findLine(text, hintLine: 5, lineText: "}") == 4)
    #expect(BlameLines.findLine(text, hintLine: 7, lineText: "}") == 8)
    #expect(BlameLines.findLine(text, hintLine: 4, lineText: "missing") == 4)
    #expect(BlameLines.findLine(text, hintLine: 50, lineText: "missing") == 8)
    #expect(BlameLines.findLine(text, hintLine: -3, lineText: nil) == 0)
    #expect(BlameLines.findLine("one\r\ntwo\r\nthree", hintLine: 0, lineText: "three") == 2)
}

@Test func tooltipNamesTheCommitOrSaysItIsNotCommitted() {
    let commit = BlameCommit(id: "abc123", shortId: "abc1", authorName: "Leo", authorEmail: "leo@x.dev",
                             authorTime: 0, summary: "Add it", uncommitted: false)
    let utc = TimeZone(identifier: "UTC")!
    #expect(BlameNote.tooltip(commit, timeZone: utc) == "Add it\n\nLeo <leo@x.dev>\nThu, Jan 1, 1970 at 12:00 AM\n"
        + "commit abc123\n\nClick to show this commit in the Log, Option-click to copy its hash")
    #expect(BlameNote.tooltip(nil) == "Not committed yet. Click to show your changes.")
}
