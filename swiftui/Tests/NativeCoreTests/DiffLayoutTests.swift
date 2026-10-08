// swiftui/scripts/test.sh runs these with the gm-measure tests.

import NativeCore
import Testing

@Test func foldsMatchTheCurrentAppOnTheReferenceDiff() {
    // demo/acme/storefront src/cart.ts: lines 27-38 inserted, line 46 changed to 58 (49 lines before, 61 after).
    let right = DiffFold.ranges(changes: [(27, 39), (58, 59)], lineCount: 61)
    #expect(right == [FoldRange(first: 1, last: 23), FoldRange(first: 42, last: 54)])
    let left = DiffFold.ranges(changes: [(27, 27), (46, 47)], lineCount: 49)
    #expect(left == [FoldRange(first: 1, last: 23), FoldRange(first: 30, last: 42)])
}

@Test func shortRunsAreNotFolded() {
    #expect(DiffFold.ranges(changes: [(5, 6)], lineCount: 8).isEmpty)
}

@Test func panesStayLevelAndFoldTheSameRuns() {
    let original = (1...10).map { "line \($0)" }.joined(separator: "\n") + "\n"
    var newLines = (1...10).map { "line \($0)" }
    newLines.insert(contentsOf: ["new a", "new b"], at: 5)
    newLines[0] = "first changed"
    let modified = newLines.joined(separator: "\n") + "\n"
    let hunks = [
        DiffHunk(oldStart: 0, oldEnd: 1, newStart: 0, newEnd: 1),
        DiffHunk(oldStart: 5, oldEnd: 5, newStart: 5, newEnd: 7),
    ]
    let layout = DiffLayout(original: original, modified: modified, hunks: hunks, collapse: false)
    #expect(layout.left.first == .line(number: 1, text: "line 1", kind: .changed))
    #expect(layout.right.first == .line(number: 1, text: "first changed", kind: .changed))
    #expect(layout.left[5] == .spacer(lines: 2))
    #expect(layout.right[5] == .line(number: 6, text: "new a", kind: .added))
    let height = { (rows: [DiffRow]) in
        rows.reduce(0) { total, row in
            if case .spacer(let lines) = row {
                return total + lines
            }
            return total + 1
        }
    }
    #expect(height(layout.left) == height(layout.right))
}

@Test func unchangedRunsFoldOnBothSides() {
    let lines = (1...30).map { "line \($0)" }
    let original = lines.joined(separator: "\n")
    var changed = lines
    changed[14] = "middle"
    let layout = DiffLayout(original: original, modified: changed.joined(separator: "\n"),
                            hunks: [DiffHunk(oldStart: 14, oldEnd: 15, newStart: 14, newEnd: 15)])
    #expect(layout.left.first == .fold(FoldRange(first: 1, last: 11)))
    #expect(layout.right.first == .fold(FoldRange(first: 1, last: 11)))
    #expect(layout.left.last == .fold(FoldRange(first: 19, last: 30)))
}

@Test func aFinalLineBreakStartsAnEmptyNumberedLine() {
    let layout = DiffLayout(original: "a\n", modified: "a\n", hunks: [], collapse: false)
    let expected: [DiffRow] = [
        .line(number: 1, text: "a", kind: .unchanged),
        .line(number: 2, text: "", kind: .unchanged),
    ]
    #expect(layout.left == expected)
}

@Test func ligaturesAreBrokenWithoutChangingTheText() {
    let shown = DiffLayout.withoutLigatures("if (a <= b) => c")
    #expect(shown.replacingOccurrences(of: "\u{200C}", with: "") == "if (a <= b) => c")
    #expect(shown.contains("<\u{200C}="))
    #expect(shown.contains("=\u{200C}>"))
}

@Test func foldEdgesStepOnlyNextToCodeAndWhenAFoldStays() {
    let first = DiffFold.edges(FoldRange(first: 1, last: 23), lineCount: 61)
    #expect(first.top == false && first.bottom == true)
    let middle = DiffFold.edges(FoldRange(first: 30, last: 49), lineCount: 100)
    #expect(middle.top == true && middle.bottom == true)
    let last = DiffFold.edges(FoldRange(first: 80, last: 100), lineCount: 100)
    #expect(last.top == true && last.bottom == false)
    let small = DiffFold.edges(FoldRange(first: 30, last: 42), lineCount: 100)
    #expect(small.top == false && small.bottom == false)
}
