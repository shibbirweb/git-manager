import NativeCore
import Testing

private func mark(_ start: Int, _ end: Int, _ type: ChangeType, id: Int = 0) -> MergeLineMark {
    MergeLineMark(chunkId: id, range: LineRange(start: start, end: end), type: type)
}

@Test func linesTakeTheirChunksTintAndEdges() {
    let lines = ["a", "bb", "cc", "d"]
    let styles = MergePaneLayout.styles(lines: lines, marks: [mark(1, 3, .modified), mark(3, 3, .added, id: 1)]) {
        $0.chunkId == 0 ? [1..<2, 3..<5] : nil
    }
    #expect(styles[1]?.tint == .modified && styles[1]?.edgeTop == true && styles[1]?.edgeBottom == false)
    #expect(styles[2]?.edgeBottom == true && styles[2]?.edgeTop == false)
    // Offsets run across lines: 3..<5 is the second line's "cc".
    #expect(styles[1]?.inline == [1..<2])
    #expect(styles[2]?.inline == [0..<2])
    #expect(styles[3]?.gapBefore == .added && styles[3]?.tint == nil)
    let end = MergePaneLayout.styles(lines: lines, marks: [mark(4, 4, .deleted)])
    #expect(end[3]?.gapAfter == .deleted)
}

@Test func rulerTicksScaleToTheTrackAndMergeOverlaps() {
    let ticks = MergePaneLayout.ticks(
        marks: [mark(0, 1, .added), mark(1, 2, .added), mark(10, 10, .conflict)], lineCount: 20, lineHeight: 16,
        padding: 4, trackHeight: 164
    )
    #expect(ticks.count == 2)
    #expect(ticks[0].top == 0 && ticks[0].height == 16)
    #expect(ticks[1].top == 80 && ticks[1].height == 3)
}

@Test func theWordAtTheCursorIsMarkedWhereverItStandsAlone() {
    #expect(WordMatches.word(at: 0, in: "import { a } from \"x\";") == "import")
    #expect(WordMatches.word(at: 0, in: "") == nil)
    #expect(WordMatches.word(at: 0, in: "  x") == nil)
    #expect(WordMatches.word(at: 3, in: "abc def") == "abc")
    #expect(WordMatches.ranges(of: "import", in: "import { importer } import_x import") == [0..<6, 29..<35])
}

@Test func spansFollowTheScrollAndEmptyRanges() {
    #expect(MergePaneLayout.span(LineRange(start: 2, end: 4), lineCount: 10, lineHeight: 16, padding: 4, offset: 0)
        == (36, 68))
    #expect(MergePaneLayout.span(LineRange(start: 3, end: 3), lineCount: 10, lineHeight: 16, padding: 4, offset: 10)
        == (42, 42))
    #expect(MergePaneLayout.span(LineRange(start: 10, end: 10), lineCount: 10, lineHeight: 16, padding: 4, offset: 0)
        == (164, 164))
}
