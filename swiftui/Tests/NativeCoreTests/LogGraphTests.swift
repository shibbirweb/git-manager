// LogGraph against the cases of src/lib/log/graph.test.ts, so both apps lay out the same lanes.

import NativeCore
import Testing

private func commit(_ commitId: String, _ parents: String...) -> GraphCommit {
    GraphCommit(commitId: commitId, parents: parents)
}

private func layout(_ commits: [GraphCommit]) -> [GraphRow] {
    GraphBuilder().push(commits)
}

private func describe(_ row: GraphRow) -> [String] {
    let names: [GraphSegmentKind: String] = [.pass: "pass", .incoming: "in", .outgoing: "out"]
    return row.segments.map { "\(names[$0.kind] ?? "?"):\($0.from)-\($0.to)" }.sorted()
}

/// The same deterministic random history as graph.test.ts, newest first.
private func randomHistory(_ count: Int, seed: Int) -> [GraphCommit] {
    var state = seed
    let random = { () -> Double in
        state = (state * 1_103_515_245 + 12345) % 2_147_483_648
        return Double(state) / 2_147_483_648
    }
    var oldestFirst: [GraphCommit] = []
    for index in 0..<count {
        var parents: [String] = []
        if index > 0 && random() > 0.03 {
            parents.append("c\(max(0, index - 1 - Int((random() * 4).rounded(.down))))")
            if index > 2 && random() < 0.2 {
                parents.append("c\(Int((random() * Double(index - 1)).rounded(.down)))")
            }
        }
        oldestFirst.append(GraphCommit(commitId: "c\(index)", parents: parents))
    }
    return oldestFirst.reversed()
}

@Test func linearHistoryStaysInOneLane() {
    let rows = layout([commit("c", "b"), commit("b", "a"), commit("a")])
    #expect(rows.map(\.lane) == [0, 0, 0])
    #expect(rows.map(\.width) == [1, 1, 1])
    #expect(Set(rows.map(\.color)).count == 1)
    #expect(describe(rows[0]) == ["out:0-0"])
    #expect(describe(rows[1]) == ["in:0-0", "out:0-0"])
    #expect(describe(rows[2]) == ["in:0-0"])
}

@Test func branchAndMerge() {
    let rows = layout([commit("m", "b", "d"), commit("d", "a"), commit("b", "a"), commit("a")])
    #expect(rows.map(\.lane) == [0, 1, 0, 0])
    #expect(describe(rows[0]) == ["out:0-0", "out:0-1"])
    #expect(describe(rows[1]) == ["in:1-1", "out:1-1", "pass:0-0"])
    #expect(describe(rows[2]) == ["in:0-0", "out:0-0", "pass:1-1"])
    #expect(describe(rows[3]) == ["in:0-0", "in:1-0"])
    #expect(rows[1].color != rows[0].color)
    #expect(rows[3].color == rows[0].color)
    #expect(rows[3].segments.first { $0.from == 1 }?.color == rows[1].color)
    #expect(rows.map(\.width).max() == 2)
    #expect(rows[0].edges == [2, 0, 0, 0, 2, 0, 1, Int32(rows[1].color)])
}

@Test func twoMergesInSequenceReuseFreedLanes() {
    let rows = layout([
        commit("m2", "c", "f"), commit("f", "b"), commit("c", "m1"), commit("m1", "b", "d"), commit("d", "a"),
        commit("b", "a"), commit("a"), commit("tip", "x"),
    ])
    #expect(rows.map(\.lane) == [0, 1, 0, 0, 2, 0, 0, 0])
    #expect(describe(rows[3]) == ["in:0-0", "out:0-0", "out:0-2", "pass:1-1"])
    #expect(describe(rows[5]) == ["in:0-0", "in:1-0", "out:0-0", "pass:2-2"])
    #expect(describe(rows[6]) == ["in:0-0", "in:2-0"])
    #expect(rows[6].width == 3)
    #expect(describe(rows[7]) == ["out:0-0"])
    #expect(rows[7].width == 1)
}

@Test func octopusMergeFansOut() {
    let rows = layout([
        commit("m", "p1", "p2", "p3", "p4"), commit("p1", "r"), commit("p2", "r"), commit("p3", "r"),
        commit("p4", "r"), commit("r"),
    ])
    #expect(describe(rows[0]) == ["out:0-0", "out:0-1", "out:0-2", "out:0-3"])
    #expect(rows.map(\.lane) == [0, 0, 1, 2, 3, 0])
    #expect(describe(rows[5]) == ["in:0-0", "in:1-0", "in:2-0", "in:3-0"])
    #expect(Set(rows[1...4].map(\.color)).count == 4)
}

@Test func multipleRootsAndDuplicateParents() {
    let rows = layout([commit("a2", "a1"), commit("b2", "b1"), commit("a1"), commit("b1")])
    #expect(rows.map(\.lane) == [0, 1, 0, 1])
    #expect(describe(rows[2]) == ["in:0-0", "pass:1-1"])
    #expect(describe(rows[3]) == ["in:1-1"])
    #expect(rows[3].width == 2)
    let merged = layout([commit("m", "x", "y"), commit("x"), commit("y")])
    #expect(merged.map(\.lane) == [0, 0, 1])
    #expect(describe(merged[1]) == ["in:0-0", "pass:1-1"])
    #expect(describe(merged[2]) == ["in:1-1"])
    #expect(describe(layout([commit("m", "a", "a"), commit("a")])[0]) == ["out:0-0"])
}

@Test func pagesGiveTheSameRowsAsOneBatch() {
    let history = randomHistory(400, seed: 7)
    let batch = layout(history)
    for split in [1, 37, 150, 399] {
        let builder = GraphBuilder()
        let paged = builder.push(Array(history[..<split])) + builder.push(Array(history[split...]))
        #expect(paged == batch)
        #expect(builder.maxWidth == batch.map(\.width).max())
    }
    for row in layout(randomHistory(300, seed: 3)) {
        #expect(row.lane < row.width)
        #expect(row.segments.allSatisfy { $0.from < row.width && $0.to < row.width })
    }
}

@Test func manyLanesStayExact() {
    let lanes = 300
    let commits = (0..<lanes * 3).map { index in
        GraphCommit(commitId: "c\(index)", parents: index + lanes < lanes * 3 ? ["c\(index + lanes)"] : [])
    }
    let middle = layout(commits)[lanes + 7]
    #expect(middle.lane == 7)
    #expect(middle.width == lanes)
    let passes = middle.segments.filter { $0.kind == .pass }
    #expect(passes.count == lanes - 1)
    #expect(passes.last?.from == lanes - 1)
}

@Test func cellStrokesFollowGraphCell() {
    let rows = layout([commit("m", "b", "d"), commit("d", "a"), commit("b", "a"), commit("a")])
    #expect(LogGraphCell.columnWidth(laneCount: 2) == 32)
    #expect(LogGraphCell.columnWidth(laneCount: 40) == 18 + 23 * 14)
    let strokes = LogGraphCell.strokes(rows[0], height: 26)
    #expect(strokes[0] == .init(start: .init(9, 13), end: .init(9, 26), controls: nil, color: rows[0].color))
    #expect(strokes[1].controls?.0 == .init(9, 26))
    #expect(strokes[1].controls?.1 == .init(23, 13))
    #expect(strokes[1].end == .init(23, 26))
    #expect(LogGraphCell.strokes(rows[3], height: 26, nodeOnly: true).isEmpty)
    #expect(LogGraphCell.nodeX(rows[1]) == 23)
}
