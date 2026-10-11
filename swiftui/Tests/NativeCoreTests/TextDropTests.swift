// Dropping text against @codemirror/view's dropText run under Bun on the same document: moves forward and
// backward, drops inside or at the edges of the dragged text, Option's copy, and text from elsewhere (line breaks
// normalized).

import Foundation
@testable import NativeCore
import Testing

struct TextDropTests {
    static let doc = "alpha beta gamma\ndelta epsilon\nzeta"
    /// Drop position, dragged range (nil: from elsewhere), moves, then the text and the selection CodeMirror gave.
    static let cases: [(Int, Range<Int>?, Bool, String, Int, Int)] = [
        (17, 6..<10, true, "alpha  gamma\nbetadelta epsilon\nzeta", 13, 17),
        (0, 11..<16, true, "gammaalpha beta \ndelta epsilon\nzeta", 0, 5),
        (8, 6..<10, true, doc, 6, 6),
        (10, 6..<10, true, doc, 6, 10),
        (6, 6..<10, true, doc, 6, 6),
        (17, 6..<10, false, "alpha beta gamma\nbetadelta epsilon\nzeta", 17, 21),
        (31, nil, false, "alpha beta gamma\ndelta epsilon\nX\nYzeta", 31, 34),
    ]

    @Test func dropsLikeThePage() throws {
        for (drop, dragged, moves, text, anchor, head) in Self.cases {
            let state = EditorState(doc: TextDocument(Self.doc))
            let dropped = dragged.map { state.sliceDoc($0.lowerBound, $0.upperBound) } ?? "X\r\nY"
            let spec = try #require(TextDrop.spec(state, text: dropped, at: drop, dragged: dragged, moves: moves))
            let next = state.update(spec).state
            #expect(next.doc.string == text, "drop at \(drop)")
            #expect(next.selection.main.anchor == anchor && next.selection.main.head == head, "drop at \(drop)")
            #expect(spec.userEvent == (moves && dragged != nil ? "move.drop" : "input.drop"))
        }
    }
}
