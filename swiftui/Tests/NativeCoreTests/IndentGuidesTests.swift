// Indent guides against the current app's on the reference diff (diff-widgets.json, left pane of src/cart.ts).

import NativeCore
import Testing

@Test func blankLinesTakeTheLevelOfTheBlockAroundThem() {
    let levels = IndentGuides.levels(lines: ["a {", "    b", "", "    c", "}"])
    #expect(levels == [0, 2, 2, 2, 0])
}

@Test func guidesMatchTheReferenceLeftPane() {
    var levels = Array(repeating: 1, count: 49)
    for (line, level) in [1: 0, 24: 2, 28: 2, 45: 2, 46: 2, 48: 0, 49: 0] {
        levels[line - 1] = level
    }
    var rows: [DiffRow] = [.fold(FoldRange(first: 1, last: 23))]
    rows += (24...26).map { .line(number: $0, text: "", kind: .unchanged) }
    rows.append(.spacer(lines: 12))
    rows += (27...29).map { .line(number: $0, text: "", kind: .unchanged) }
    rows.append(.fold(FoldRange(first: 30, last: 42)))
    rows += (43...49).map { .line(number: $0, text: "", kind: .unchanged) }
    let runs = IndentGuides.runs(rows: rows, levels: levels, metrics: RowMetrics(line: 16, fold: 22, padding: 4))
    // diff-widgets.json, less the pane's top at 134: x 354 runs 160-224 and 416-550, x 370 runs 160-176,
    // 416-432 and 502-534.
    let expected: [IndentGuides.Run] = [
        .init(level: 0, top: 26, bottom: 90), .init(level: 0, top: 282, bottom: 416),
        .init(level: 1, top: 26, bottom: 42), .init(level: 1, top: 282, bottom: 298),
        .init(level: 1, top: 368, bottom: 400),
    ]
    #expect(runs == expected)
}
