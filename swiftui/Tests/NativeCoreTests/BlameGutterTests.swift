import Foundation
import NativeCore
import Testing

private let utc = TimeZone(identifier: "UTC")!
private let now = Date(timeIntervalSince1970: 1_790_000_000)

private func commit(_ id: String, _ time: Int64, uncommitted: Bool = false) -> BlameCommit {
    BlameCommit(id: id, authorName: "Leo Park", authorTime: time, summary: "s", uncommitted: uncommitted)
}

@Test func ranksOrderCommitsByAge() {
    let commits = [commit("b", 200), commit("a", 100), commit("c", 300), commit("u", 0, uncommitted: true)]
    #expect(BlameGutter.ageRanks(commits) == [0.5, 0, 1, 1])
    #expect(BlameGutter.ageRanks([commit("a", 100), commit("b", 100)]) == [1, 1])
}

@Test func cellsMarkBlocksAndHeat() {
    let commits = [commit("d60edea5", 100), commit("6f857be1", 200)]
    // Lines 0-1 from the first commit, line 2 from the second, line 3 edited since.
    let blame = BlameLines(BlameRuns(commits: commits, runs: [2, 0, 0, 1, 1, 0, 1, 0, 0]), lineCount: 4)
    var lines = blame
    let ranks = BlameGutter.ageRanks(commits)
    let first = BlameGutter.cell(lines, line: 0, ranks: ranks, now: now, timeZone: utc)
    #expect(first?.first == true)
    #expect(first?.heatPercent == 20)
    #expect(first?.text?.hasPrefix("d60edea Leo Park ") == true)
    #expect(BlameGutter.cell(lines, line: 1, ranks: ranks, now: now, timeZone: utc)?.text == nil)
    let newer = BlameGutter.cell(lines, line: 2, ranks: ranks, now: now, timeZone: utc)
    #expect(newer?.first == true)
    #expect(newer?.heatPercent == 95)
    lines = blame
    #expect(BlameGutter.cell(lines, line: 9, ranks: ranks) == nil)
    #expect(BlameGutter.text(nil) == "Uncommitted")
}
