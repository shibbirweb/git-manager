import NativeCore
import Testing

struct TextPreWrapTests {
    /// Every character one unit wide.
    private func lines(_ text: String, _ width: Double) -> [String] {
        TextWrap.preWrapLines(text, width: width) { Double($0.count) }
    }

    @Test func breaksAtSpacesFirst() {
        #expect(lines("claude mcp add git-manager http://127.0.0.1:1/mcp", 30)
            == ["claude mcp add git-manager ", "http://127.0.0.1:1/mcp"])
        #expect(lines("short", 30) == ["short"])
    }

    @Test func aLongWordBreaksAnywhere() {
        #expect(lines("abcdefghij", 4) == ["abcd", "efgh", "ij"])
    }

    @Test func spacesHangAndNewlinesStay() {
        #expect(lines("abc   def", 3) == ["abc   ", "def"])
        #expect(lines("{\n  \"a\": 1\n}", 20) == ["{", "  \"a\": 1", "}"])
    }
}
