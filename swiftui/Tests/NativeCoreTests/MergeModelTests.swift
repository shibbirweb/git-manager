// The cases of src/lib/merge/model.test.ts, on the Swift port (MergeModel, MergeText, MergeNavigation).

import NativeCore
import Testing

private func range(_ start: Int, _ end: Int) -> LineRange {
    LineRange(start: start, end: end)
}

// base: a b c d e; ours changes b, theirs changes e, both change c differently.
private let base = MergeText.lines("a\nb\nc\nd\ne\n")
private let ours = "a\nB\nC-ours\nd\ne\n"
private let theirs = "a\nb\nC-theirs\nd\nE\n"
private let sides = MergeSides(ours: MergeText.lines(ours), theirs: MergeText.lines(theirs))
private let engineChunks = [
    MergeChunk(id: 0, kind: .conflict, base: range(1, 3), ours: range(1, 3), theirs: range(1, 3)),
    MergeChunk(id: 1, kind: .theirsOnly, base: range(4, 5), ours: range(4, 5), theirs: range(4, 5)),
]

private func linesOf(_ lines: [String], _ chunk: ChunkState) -> [String] {
    MergeText.slice(lines, chunk.result)
}

@Test func replaceLinesFollowsLineArraySemantics() {
    #expect(MergeText.text(MergeText.replaceLines(["a", "b", "c"], range(1, 2), with: ["x", "y"])) == "a\nx\ny\nc")
    #expect(MergeText.text(MergeText.replaceLines(["a", "b", "c"], range(1, 2), with: [])) == "a\nc")
    #expect(MergeText.text(MergeText.replaceLines(["a", "b", "c"], range(1, 3), with: [])) == "a")
    #expect(MergeText.text(MergeText.replaceLines(["a", "b"], range(1, 1), with: ["x"])) == "a\nx\nb")
    #expect(MergeText.text(MergeText.replaceLines(["a", "b"], range(2, 2), with: ["x"])) == "a\nb\nx")
    var seed = 7
    func random(_ bound: Int) -> Int {
        seed = (seed * 1_103_515_245 + 12345) % 2_147_483_648
        return seed % bound
    }
    for _ in 0..<500 {
        let lines = (0..<(1 + random(6))).map { "l\($0)" }
        let start = random(lines.count + 1)
        let end = start + random(lines.count - start + 1)
        let insert = (0..<random(3)).map { "n\($0)" }
        let actual = MergeText.text(MergeText.replaceLines(lines, range(start, end), with: insert))
        let expected = Array(lines[0..<start]) + insert + Array(lines[end...])
        // Removing every line leaves CodeMirror's single empty line.
        #expect(actual == (expected.isEmpty ? "" : expected.joined(separator: "\n")))
    }
}

@Test func startsFromTheBaseWithOnlyTheUnchangedSideDone() {
    let chunks = MergeModel.initialChunks(engineChunks)
    #expect(!(chunks[0].oursDone || chunks[0].theirsDone))
    #expect(chunks[1].oursDone)
    #expect(!chunks[1].theirsDone)
    #expect(MergeNavigation.unresolvedCounts(chunks) == ResolutionCounts(changes: 2, conflicts: 1))
}

@Test func appliesOneSideThenAppendsTheOtherOnAConflict() throws {
    let first = try #require(MergeModel.applySide(
        base, chunks: MergeModel.initialChunks(engineChunks), chunkId: 0, side: .ours, sides: sides
    ))
    #expect(linesOf(first.lines, first.chunks[0]) == ["B", "C-ours"])
    #expect(!first.chunks[0].isResolved)
    let second = try #require(MergeModel.applySide(
        first.lines, chunks: first.chunks, chunkId: 0, side: .theirs, sides: sides
    ))
    #expect(linesOf(second.lines, second.chunks[0]) == ["B", "C-ours", "b", "C-theirs"])
    #expect(second.chunks[0].isResolved)
    // The later chunk shifted by the two appended lines.
    #expect(second.chunks[1].result == range(6, 7))
    #expect(linesOf(second.lines, second.chunks[1]) == ["e"])
    #expect(MergeModel.applySide(second.lines, chunks: second.chunks, chunkId: 0, side: .ours, sides: sides) == nil)
}

@Test func ignoringKeepsTheBaseText() throws {
    let action = try #require(MergeModel.ignoreSide(
        base, chunks: MergeModel.initialChunks(engineChunks), chunkId: 1, side: .theirs
    ))
    #expect(action.lines == base)
    #expect(action.chunks[1].isResolved)
}

@Test func appliesAllNonConflictingChangesAtOnce() throws {
    let chunks = MergeModel.initialChunks(engineChunks)
    let action = try #require(MergeModel.applyNonConflicting(base, chunks: chunks, sides: sides))
    #expect(MergeText.text(action.lines) == "a\nb\nc\nd\nE\n")
    #expect(MergeNavigation.unresolvedCounts(action.chunks) == ResolutionCounts(changes: 1, conflicts: 1))
    #expect(MergeModel.applyNonConflicting(action.lines, chunks: action.chunks, sides: sides) == nil)
    #expect(MergeModel.applyNonConflicting(base, chunks: chunks, sides: sides, only: .ours) == nil)
}

@Test func acceptsAWholeSide() {
    let action = MergeModel.acceptWholeSide(chunks: MergeModel.initialChunks(engineChunks), sides: sides, side: .theirs)
    #expect(MergeText.text(action.lines) == theirs)
    #expect(MergeNavigation.unresolvedCounts(action.chunks).changes == 0)
}

private let mapped = MergeModel.initialChunks([
    MergeChunk(id: 0, kind: .oursOnly, base: range(2, 4), ours: range(2, 3), theirs: range(2, 4)),
    MergeChunk(id: 1, kind: .theirsOnly, base: range(6, 6), ours: range(5, 5), theirs: range(6, 7)),
])
private let doc = MergeText.lines("0\n1\n2\n3\n4\n5\n6\n7")

/// UTF-16 offset of the start (or the end) of 1-based line `number` of `doc`.
private func offset(_ number: Int, end: Bool = false) -> Int {
    let start = doc[0..<(number - 1)].reduce(0) { $0 + $1.utf16.count + 1 }
    return end ? start + doc[number - 1].utf16.count : start
}

private func edit(_ from: Int, _ to: Int, _ insert: String) -> [ChunkState] {
    MergeModel.mapChunks(mapped, edits: [MergeEditSpan.span(lines: doc, from: from, to: to, insert: insert)])
}

@Test func mapChunksFollowsUserEdits() {
    let below = edit(offset(1, end: true), offset(1, end: true), "\nnew")
    #expect(below[0].result == range(3, 5))
    #expect(below[1].result == range(7, 7))
    #expect(!below[0].edited)
    let inside = edit(offset(3, end: true), offset(3, end: true), "\nx")
    #expect(inside[0].result == range(2, 5))
    #expect(inside[0].edited)
    #expect(inside[1].result == range(7, 7))
    #expect(edit(offset(8), offset(8, end: true), "changed") == mapped)
    // An empty chunk is not edited when the following line changes.
    #expect(!edit(offset(7), offset(7), "x")[1].edited)
    let crossing = edit(offset(2), offset(3) + 1, "")
    #expect(crossing[0].result.start == 1)
    #expect(crossing[0].edited)
}

@Test func scrollMappingInterpolatesBetweenAnchors() {
    let anchors = MergeNavigation.sideToResultAnchors(
        MergeModel.initialChunks(engineChunks), side: .ours, sideLines: 6, resultLines: 6
    )
    #expect(MergeNavigation.mapLine(0, anchors) == 0)
    #expect(MergeNavigation.mapLine(2, anchors) == 2)
    #expect(MergeNavigation.mapLine(6, anchors) == 6)
    let compressed: [MergeNavigation.Anchor] = [(0, 0), (10, 10), (30, 12), (40, 22)]
    #expect(MergeNavigation.mapLine(20, compressed) == 11)
    #expect(MergeNavigation.mapLine(35, compressed) == 17)
}

@Test func navigationWrapsAndMarkersAreFound() {
    let chunks = MergeModel.initialChunks(engineChunks)
    #expect(MergeNavigation.findUnresolved(chunks, fromLine: 0, direction: 1)?.id == 0)
    #expect(MergeNavigation.findUnresolved(chunks, fromLine: 4, direction: 1)?.id == 0)
    #expect(MergeNavigation.findUnresolved(chunks, fromLine: 5, direction: -1)?.id == 1)
    #expect(MergeText.hasConflictMarkers("a\n<<<<<<< HEAD\nb\n=======\nc\n>>>>>>> x\n"))
    #expect(!MergeText.hasConflictMarkers("a\n<<<<<<<< not a marker\n"))
}

@Test func slicesTheSameLinesFromLinesAndFromAString() {
    let text = "zero\none\n\nthree"
    let starts = MergeText.lineStarts(text)
    for lineRange in [range(0, 1), range(1, 3), range(2, 4), range(0, 4), range(3, 9), range(2, 2)] {
        let expected = MergeText.slice(MergeText.lines(text), lineRange)
        #expect(MergeText.range(of: text, starts: starts, lineRange) == expected.joined(separator: "\n"))
    }
    #expect(MergeText.lineStarts("a\nbc\n") == [0, 2, 5])
    #expect(MergeText.lineStarts("") == [0])
}

@Test func statusTextFollowsTheToolbar() {
    #expect(ResolutionCounts(changes: 0, conflicts: 0).statusText == "All changes processed")
    #expect(ResolutionCounts(changes: 1, conflicts: 0).statusText == "1 change left")
    #expect(ResolutionCounts(changes: 9, conflicts: 2).statusText == "9 changes left, 2 conflicts")
}

@Test func conflictRowsNameWhatEachSideDid() {
    #expect(ConflictLabels.sideStatus(kind: "bothAdded", side: .ours) == "Added")
    #expect(ConflictLabels.sideStatus(kind: "deletedByUs", side: .ours) == "Deleted")
    #expect(ConflictLabels.sideStatus(kind: "deletedByUs", side: .theirs) == "Modified")
    #expect(ConflictLabels.sideStatus(kind: "deletedByThem", side: .theirs) == "Deleted")
    #expect(ConflictLabels.opLabel("cherryPick") == "Cherry-Pick")
    #expect(ConflictLabels.split("src/app.ts") == ("app.ts", "src"))
    #expect(ConflictLabels.split("README.md") == ("README.md", nil))
    let paths = ["a", "b", "c", "d"]
    let picked = ConflictLabels.select("b", in: paths, selected: ["a"], anchor: "a", command: false, shift: false)
    #expect(picked.selected == ["b"] && picked.anchor == "b")
    #expect(ConflictLabels.select("d", in: paths, selected: ["b"], anchor: "b", command: false, shift: true)
        .selected == ["b", "c", "d"])
    #expect(ConflictLabels.select("b", in: paths, selected: ["a", "b"], anchor: "a", command: true, shift: false)
        .selected == ["a"])
}

@Test func wordDiffMarksChangedWords() {
    func highlighted(_ before: String, _ after: String) -> [String] {
        let units = Array(after.utf16)
        return (WordDiff.changedSpans(before: before, after: after) ?? []).map {
            String(utf16CodeUnits: Array(units[$0]), count: $0.count)
        }
    }
    #expect(highlighted("const total = price * qty;", "const total = price * quantity;") == ["quantity"])
    #expect(highlighted("call(a, b)", "call(a.b, b)") == [".b"])
    #expect(highlighted("a  b", "a b") == [])
    #expect(WordDiff.changedSpans(before: "alpha beta gamma", after: "one two three four") == nil)
    #expect(highlighted("line one\nline two", "line one\nline 2") == ["2"])
}
