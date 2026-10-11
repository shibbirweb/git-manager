// Completion's state machine as @codemirror/autocomplete moves it: typing makes a source pending, a result stays
// while the typed text fits its validFor, backspacing past its start drops it, a cursor move resets it, Escape
// closes; then the snippet fields' Tab moves and the popup's geometry.

import Foundation
@testable import NativeCore
import Testing

struct CompletionStateTests {
    private func typed(_ state: EditorState, _ text: String) -> Transaction {
        var spec = state.replaceSelection(text)
        spec.userEvent = "input.type"
        return state.update(spec)
    }

    private func result(from: Int, labels: [String]) -> CompletionResult {
        CompletionResult(from: from, options: labels.map { Completion(label: $0) },
                         validFor: CompletionValidFor(source: "^\\w*$"))
    }

    @Test func typingAsksAndAResultFollowsTheTypedWord() {
        var editor = EditorState(doc: TextDocument("t"), selection: .single(1))
        var completion = CompletionState(sources: [0])
        let first = typed(editor, "h")
        editor = first.state
        completion = completion.update(first, state: editor, now: 0)
        #expect(completion.pending.map(\.source) == [0])
        let answer = ActiveCompletion(source: 0, explicit: false, limit: 1,
                                      result: result(from: 0, labels: ["this", "throw", "true"]),
                                      from: 0, to: 2, resultID: 1)
        completion = completion.update(nil, effects: [.setActive([answer])], state: editor, now: 0)
        #expect(completion.open?.options.map(\.completion.label) == ["this", "throw"])
        let next = typed(editor, "r")
        editor = next.state
        completion = completion.update(next, state: editor, now: 10)
        #expect(completion.open?.options.map(\.completion.label) == ["throw"])
        #expect(completion.open?.timestamp == 0, "the popup keeps the time it opened")
    }

    @Test func backspacingPastTheStartOrMovingTheCursorDropsTheResult() {
        let editor = EditorState(doc: TextDocument("th"), selection: .single(2))
        var completion = CompletionState(sources: [0])
        let answer = ActiveCompletion(source: 0, explicit: false, limit: 1,
                                      result: result(from: 0, labels: ["this"]), from: 0, to: 2, resultID: 1)
        completion = completion.update(nil, effects: [.setActive([answer])], state: editor, now: 0)
        #expect(completion.open != nil)
        var back = TransactionSpec(changes: editor.changes([ChangeSpec(from: 0, to: 2)]), selection: .single(0))
        back.userEvent = "delete.backward"
        let deleted = editor.update(back)
        #expect(completion.update(deleted, state: deleted.state, now: 0).open == nil)
        let moved = editor.update(TransactionSpec(selection: .single(0), userEvent: "select"))
        #expect(completion.update(moved, state: moved.state, now: 0).open == nil)
        #expect(completion.update(nil, effects: [.close], state: editor, now: 0).open == nil)
    }

    @Test func aTextThatNoLongerFitsAsksAgain() {
        var editor = EditorState(doc: TextDocument("th"), selection: .single(2))
        var completion = CompletionState(sources: [0])
        let answer = ActiveCompletion(source: 0, explicit: false, limit: 1,
                                      result: result(from: 0, labels: ["this"]), from: 0, to: 2, resultID: 1)
        completion = completion.update(nil, effects: [.setActive([answer])], state: editor, now: 0)
        let dot = typed(editor, ".")
        editor = dot.state
        completion = completion.update(dot, state: editor, now: 0)
        #expect(completion.pending.map(\.source) == [0])
    }

    @Test func snippetFieldsMoveAndLetGo() {
        let fields = [
            SnippetField(field: 0, from: 9, to: 14), SnippetField(field: 0, from: 20, to: 25),
            SnippetField(field: 1, from: 28, to: 33), SnippetField(field: 2, from: 50, to: 50),
        ]
        let snippet = ActiveSnippet(ranges: fields, active: 0)
        let next = snippet.move(1)
        #expect(next?.selection.ranges.map { [$0.from, $0.to] } == [[28, 33]])
        #expect(next?.snippet?.active == 1)
        let last = next?.snippet?.move(1)
        #expect(last?.selection.main.head == 50 && last?.snippet == nil)
        #expect(snippet.move(-1) == nil)
        #expect(snippet.selectionInsideField(EditorSelection([.range(9, 14), .range(20, 25)], mainIndex: 0)))
        #expect(!snippet.selectionInsideField(.single(27)))
    }

    @Test func popupGeometryFollowsThePage() {
        let four = CompletionPopupLayout(rowWidths: Array(repeating: (23.4, 0), count: 4))
        #expect(four.width == 242 && four.height == 96 && !four.overflows)
        let many = CompletionPopupLayout(rowWidths: Array(repeating: (23.4, 0), count: 20))
        #expect(many.listHeight == 208 && many.overflows && many.rowWidth == 230)
        #expect(many.scrollTop(showing: 12, from: 0) == 3 + 13 * 22 - 208)
        let placed = CompletionPopupLayout.place(width: 242, height: 96, anchorX: 401.24, lineTop: 467,
                                                 lineBottom: 484, space: (0, 0, 1400, 860))
        #expect(placed.x == 401.24 && placed.y == 484 && !placed.above)
        let low = CompletionPopupLayout.place(width: 242, height: 96, anchorX: 1300, lineTop: 800,
                                              lineBottom: 817, space: (0, 0, 1400, 860))
        #expect(low.above && low.y == 800 - 96 && low.x == 1400 - 242)
    }
}
