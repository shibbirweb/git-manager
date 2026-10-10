import NativeCore
import Testing

@Test func aStepOpensTenLinesAtOneEdgeOrTheWholeFold() {
    let fold = FoldRange(first: 30, last: 49)
    #expect(DiffFold.reveal(fold, edge: .top) == FoldRange(first: 40, last: 49))
    #expect(DiffFold.reveal(fold, edge: .bottom) == FoldRange(first: 30, last: 39))
    #expect(DiffFold.reveal(fold, edge: .all) == nil)
    // 13 lines less 10 would leave 3, under the 4 a fold needs: the step opens everything.
    #expect(DiffFold.reveal(FoldRange(first: 30, last: 42), edge: .top) == nil)
}

@Test func steppingReplacesOrRemovesOneFold() {
    let folds = [FoldRange(first: 1, last: 23), FoldRange(first: 30, last: 42)]
    #expect(DiffFold.stepping(folds, at: 0, edge: .bottom) == [FoldRange(first: 1, last: 13), folds[1]])
    #expect(DiffFold.stepping(folds, at: 1, edge: .top) == [folds[0]])
    #expect(DiffFold.stepping(folds, at: 5, edge: .all) == folds)
}

@Test func steppedFoldsShapeTheLayout() {
    let lines = (1...40).map { "line \($0)" }
    var changed = lines
    changed[34] = "changed"
    let hunks = [DiffHunk(oldStart: 34, oldEnd: 35, newStart: 34, newEnd: 35)]
    let original = lines.joined(separator: "\n"), modified = changed.joined(separator: "\n")
    let folded = DiffLayout(original: original, modified: modified, hunks: hunks)
    #expect(folded.leftFolds == [FoldRange(first: 1, last: 31)])
    let stepped = DiffFold.stepping(folded.leftFolds, at: 0, edge: .bottom)
    let layout = DiffLayout(original: original, modified: modified, hunks: hunks, folds: stepped)
    #expect(layout.right.first == .fold(FoldRange(first: 1, last: 21)))
    #expect(layout.right[1] == .line(number: 22, text: "line 22", kind: .unchanged))
    let open = DiffLayout(original: original, modified: modified, hunks: hunks, collapse: false, folds: stepped)
    #expect(open.leftFolds.isEmpty)
}

@Test func theCounterAndStepsFollowDiffView() {
    #expect(DiffNavigation.counterLabel(count: 0, current: -1) == "No changes")
    #expect(DiffNavigation.counterLabel(count: 1, current: -1) == "1 change")
    #expect(DiffNavigation.counterLabel(count: 3, current: -1) == "3 changes")
    #expect(DiffNavigation.counterLabel(count: 3, current: 1) == "2 of 3")
    #expect(DiffNavigation.step(current: -1, count: 3, direction: -1) == 2)
    #expect(DiffNavigation.step(current: 2, count: 3, direction: 1) == 0)
    #expect(DiffNavigation.step(current: 0, count: 3, direction: -1) == 2)
    #expect(DiffNavigation.step(current: 0, count: 0, direction: 1) == -1)
}

@Test func aChangeRowIsItsFirstLineOrTheLineAfterItsSpacer() {
    let rows: [DiffRow] = [
        .fold(FoldRange(first: 1, last: 5)),
        .line(number: 6, text: "a", kind: .unchanged),
        .spacer(lines: 2),
        .line(number: 7, text: "b", kind: .unchanged),
    ]
    #expect(DiffNavigation.row(ofLine: 3, in: rows) == 0)
    #expect(DiffNavigation.row(ofLine: 7, in: rows) == 3)
    #expect(DiffNavigation.row(ofLine: 9, in: rows) == 3)
}

@Test func aChangeIsCenteredAsWebKitScrollsTheMergeView() {
    // beta.7 on src/cart.ts with nothing folded: line 27 (row top 420) in a 690-point view scrolls to 82.
    #expect(DiffNavigation.centeredOffset(rowTop: 420, viewport: 690, contentHeight: 994) == 82)
    #expect(DiffNavigation.centeredOffset(rowTop: 100, viewport: 690, contentHeight: 994) == 0)
    #expect(DiffNavigation.centeredOffset(rowTop: 980, viewport: 690, contentHeight: 994) == 304)
}
