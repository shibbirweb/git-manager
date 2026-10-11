// Column selection against @codemirror/view's rectangleFor (Fixtures/cm-rectangle.txt, from the package's own
// function run under Bun on this document: tabs, an empty and a short line, a line past 2000 characters and wide
// characters), the drag points, and Cmd keeping the starting selection.

import Foundation
@testable import NativeCore
import Testing

struct ColumnSelectionTests {
    static let lines = [
        "function total(items) {", "\tconst sum = 0;", "", "  if (x) {", "\t\tlet é = 1; // ü", "short",
        String(repeating: "x", count: 2100) + " end", "😀 emoji line here", "last line of text",
    ]
    let doc = TextDocument(lines.joined(separator: "\n"))

    @Test func rectanglesMatchThePackage() throws {
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
            .appendingPathComponent("Fixtures/cm-rectangle.txt")
        var count = 0
        for line in try String(contentsOf: url, encoding: .utf8).split(separator: "\n") where !line.hasPrefix("#") {
            let row = try #require(try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [Any])
            let tabSize = try #require(row[0] as? Int)
            let start = try #require(row[1] as? [Int]), end = try #require(row[2] as? [Int])
            let expected = try #require(row[3] as? [[Int]])
            let ranges = ColumnSelection.ranges(
                doc, from: .init(line: start[0], column: start[1], offset: start[2]),
                to: .init(line: end[0], column: end[1], offset: end[2]), tabSize: tabSize
            )
            #expect(ranges.map { [$0.anchor, $0.head] } == expected, "\(line)")
            count += 1
        }
        #expect(count == 20)
    }

    @Test func dragPointsTakeTheColumnFromTabsOrThePointer() {
        let second = doc.line(1)
        // After the tab and "con": column 4 + 3 with tab size 4.
        #expect(ColumnSelection.point(doc, position: second.from + 4, pointerColumn: 0, tabSize: 4)
            == .init(line: 2, column: 7, offset: 4))
        // At the line's end the pointer's column counts, past the text.
        #expect(ColumnSelection.point(doc, position: second.to, pointerColumn: 30, tabSize: 4).column == 30)
        let long = doc.line(6)
        #expect(ColumnSelection.point(doc, position: long.from + 2050, pointerColumn: 0, tabSize: 4).column == -1)
    }

    @Test func cmdKeepsTheStartingSelection() {
        let start = ColumnSelection.Point(line: 1, column: 0, offset: 0)
        let end = ColumnSelection.Point(line: 2, column: 1, offset: 1)
        let kept = EditorSelection([.range(150, 155)], mainIndex: 0)
        let added = ColumnSelection.selection(doc, from: start, to: end, tabSize: 4, adding: kept)
        #expect(added?.ranges.count == 3 && added?.main.from == 0)
        let alone = ColumnSelection.selection(doc, from: start, to: end, tabSize: 4, adding: nil)
        #expect(alone?.ranges.count == 2)
    }
}
