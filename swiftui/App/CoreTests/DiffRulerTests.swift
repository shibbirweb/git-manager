// The ruler ticks of the reference diff (demo/acme/storefront src/cart.ts), as the current app places them.

import NativeCore
import Testing

@Test func rulerTicksFollowTheModifiedPane() {
    var rows: [DiffRow] = [.fold(FoldRange(first: 1, last: 23))]
    rows += (24...41).map { .line(number: $0, text: "", kind: .unchanged) }
    rows.append(.fold(FoldRange(first: 42, last: 54)))
    rows += (55...61).map { .line(number: $0, text: "", kind: .unchanged) }
    let hunks = [
        DiffHunk(oldStart: 26, oldEnd: 26, newStart: 26, newEnd: 38),
        DiffHunk(oldStart: 45, oldEnd: 46, newStart: 57, newEnd: 58),
        DiffHunk(oldStart: 47, oldEnd: 48, newStart: 60, newEnd: 60),
    ]
    let metrics = RowMetrics(line: 16, fold: 22, padding: 4)
    let ticks = DiffRuler.ticks(rows: rows, hunks: hunks, metrics: metrics, trackHeight: 452)
    #expect(ticks == [
        RulerTick(top: 70, height: 192, kind: .added),
        RulerTick(top: 380, height: 16, kind: .modified),
        RulerTick(top: 428, height: 3, kind: .deleted),
    ])
}

@Test func touchingTicksOfOneKindMerge() {
    let rows: [DiffRow] = (1...4).map { .line(number: $0, text: "", kind: .changed) }
    let hunks = [
        DiffHunk(oldStart: 0, oldEnd: 1, newStart: 0, newEnd: 1),
        DiffHunk(oldStart: 1, oldEnd: 2, newStart: 1, newEnd: 2),
    ]
    let ticks = DiffRuler.ticks(rows: rows, hunks: hunks, metrics: RowMetrics(line: 10, fold: 20, padding: 0),
                                trackHeight: 40)
    #expect(ticks == [RulerTick(top: 0, height: 20, kind: .modified)])
}

@Test func rowIndexFindsOnlyTheRowsOnScreen() {
    var rows: [DiffRow] = [.fold(FoldRange(first: 1, last: 10))]
    rows += (11...5000).map { .line(number: $0, text: "", kind: .unchanged) }
    let index = RowIndex(rows: rows, metrics: RowMetrics(line: 16, fold: 22, padding: 4))
    #expect(index.tops[1] == 26)
    #expect(index.rowsBottom == 26 + 4990 * 16)
    #expect(index.visible(from: 0, to: 30) == 0..<2)
    // A 700-point band from 5 points into row 1000 reaches into row 1044.
    let top = index.tops[1000] + 5
    #expect(index.visible(from: top, to: top + 700) == 1000..<1045)
    #expect(index.visible(from: index.rowsBottom + 10, to: index.rowsBottom + 100).isEmpty)
}
