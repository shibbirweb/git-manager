import NativeCore
import Testing

@Suite struct SyntaxWindowTests {
    private func text(lines: Int) -> String {
        (0..<lines).map { "line \($0)" }.joined(separator: "\n")
    }

    @Test func firstPassEndsAMarginPastTheLine() {
        let sample = text(lines: 1000)
        let end = SyntaxWindow.firstPassEnd(sample, line: 10, margin: 5)
        // Lines 0 to 15 and their newlines.
        let expected = (0...15).map { "line \($0)".utf16.count + 1 }.reduce(0, +)
        #expect(end == expected)
    }

    @Test func aShortTextIsColoredInOnePass() {
        #expect(SyntaxWindow.firstPassEnd(text(lines: 100), line: 0) == nil)
        #expect(SyntaxWindow.firstPassEnd(text(lines: 1000), line: 600) == nil)
        #expect(SyntaxWindow.firstPassEnd("", line: 0) == nil)
    }

    @Test func diffEndsFollowTheFirstChange() {
        let sample = text(lines: 2000)
        let hunks = [DiffHunk(oldStart: 20, oldEnd: 21, newStart: 40, newEnd: 41)]
        let ends = SyntaxWindow.diffEnds(original: sample, modified: sample, hunks: hunks)
        #expect(ends.original == SyntaxWindow.firstPassEnd(sample, line: 20))
        #expect(ends.modified == SyntaxWindow.firstPassEnd(sample, line: 40))
        #expect(ends.original ?? 0 < ends.modified ?? 0)
    }
}
