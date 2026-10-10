// The editing engine's parts that need CodeMirror's view to compare against (motion by row and word, folds,
// clipboard, keys), checked against what the view does for monospaced unwrapped text; and the rope's speed on a
// 4000-line file.

import Foundation
@testable import NativeCore
import Testing

private func state(_ text: String, _ anchor: Int, _ head: Int? = nil, indent: Int = 2) -> EditorState {
    EditorState(doc: TextDocument(text), selection: .single(anchor, head ?? anchor),
                config: EditorConfig(tabSize: indent, indentUnit: String(repeating: " ", count: indent),
                                     language: LanguageData.forLanguage("TypeScript")))
}

private func apply(_ action: EditorAction, _ start: EditorState, rows: Int = 3) -> EditorState {
    EditorActions.run(action, start, EditorContext(style: .cLike(continued: true), pageRows: rows))?.state ?? start
}

private func heads(_ state: EditorState) -> [Int] {
    state.selection.ranges.map(\.head)
}

@Test func theRopeFindsLinesAndReplacesAcrossChunks() {
    let lines = (0..<4000).map { "line \($0) é" }
    var doc = TextDocument(lines: lines)
    #expect(doc.lineCount == 4000)
    #expect(doc.line(1234).text == "line 1234 é")
    let line = doc.line(2000)
    #expect(doc.lineAt(line.from + 3).index == 2000)
    #expect(doc.lineAt(line.to).index == 2000)
    doc.replace(doc.line(63).to, doc.line(65).from + 2, with: "X\nY")
    #expect(doc.line(63).text == "line 63 éX")
    #expect(doc.line(64).text == "Yne 65 é")
    #expect(doc.lineCount == 3999)
    #expect(doc.string == doc.allLines.joined(separator: "\n"))
    #expect(doc.slice(doc.line(63).from, doc.line(64).to) == "line 63 éX\nYne 65 é")
}

@Test func typingInALongFileStaysFast() {
    let text = (0..<4000).map { "  const value\($0) = compute(\($0), \"text\"); // note" }.joined(separator: "\n")
    var editor = state(text, TextDocument(text).line(2000).to)
    let started = Date()
    for character in "let typed = value + 1;" {
        editor = editor.update(EditorInput.type(editor, String(character), style: .cLike(continued: true))).state
    }
    editor = apply(.insertNewlineAndIndent, editor)
    let elapsed = Date().timeIntervalSince(started)
    #expect(editor.doc.line(2000).text.hasSuffix("let typed = value + 1;"))
    #expect(elapsed < 0.5, "23 keystrokes took \(elapsed) s")
}

@Test func arrowsMoveByCharacterGroupAndRow() {
    let text = "foo.bar  baz\n\tab\nxy"
    var editor = state(text, 0, indent: 4)
    editor = apply(.cursorGroupRight, editor)
    #expect(heads(editor) == [3])
    editor = apply(.cursorGroupRight, editor)
    #expect(heads(editor) == [4])
    editor = apply(.cursorGroupRight, editor)
    #expect(heads(editor) == [7])
    editor = apply(.cursorGroupRight, editor)
    #expect(heads(editor) == [12])
    editor = apply(.cursorCharRight, editor)
    #expect(heads(editor) == [13])
    // Column 9 ("baz" starts at 9) lands after the tab (4 columns) and "ab" at the line's end.
    editor = state(text, 9, indent: 4)
    editor = apply(.cursorLineDown, editor)
    #expect(heads(editor) == [16])
    editor = apply(.cursorLineDown, editor)
    #expect(heads(editor) == [19])
    #expect(editor.selection.main.goalColumn == 9)
    editor = apply(.cursorLineUp, editor)
    editor = apply(.cursorLineUp, editor)
    #expect(heads(editor) == [9])
    editor = apply(.cursorLineUp, editor)
    #expect(heads(editor) == [0])
}

@Test func homeStopsAtTheIndentationFirst() {
    let text = "    return x;"
    var editor = apply(.cursorLineBoundaryLeft, state(text, 10))
    #expect(heads(editor) == [4])
    editor = apply(.cursorLineBoundaryLeft, editor)
    #expect(heads(editor) == [0])
    editor = apply(.selectLineBoundaryRight, editor)
    #expect(editor.selection.main.from == 0 && editor.selection.main.to == 13)
}

@Test func shiftExtendsAndArrowsCollapseSelections() {
    var editor = apply(.selectCharRight, state("abcdef", 1))
    editor = apply(.selectGroupRight, editor)
    #expect(editor.selection.main.anchor == 1 && editor.selection.main.head == 6)
    editor = apply(.cursorCharLeft, editor)
    #expect(heads(editor) == [1])
}

@Test func addCursorBelowAndEscape() {
    var editor = apply(.addCursorBelow, state("abc\nde\nfgh", 3))
    #expect(heads(editor) == [3, 6])
    #expect(editor.selection.mainIndex == 1)
    editor = apply(.simplifySelection, editor)
    #expect(heads(editor) == [6])
}

@Test func foldsJoinLinesIntoOneRow() {
    let text = "const a = [\n  1,\n  2,\n];\nnext();\n"
    let ranges = FoldRanges([CodeFold(from: 11, to: 22)])
    var editor = state(text, 0)
    #expect(ranges.foldable(editor, lineStart: 0, lineEnd: 11) == CodeFold(from: 11, to: 22))
    #expect(ranges.foldable(editor, lineStart: 12, lineEnd: 16) == nil)
    editor = editor.update(editor.foldCode(ranges)!).state
    #expect(editor.folds == [CodeFold(from: 11, to: 22)])
    let layout = FoldLayout(folds: editor.folds, doc: editor.doc)
    #expect(layout.rowCount == 3)
    #expect(layout.lines(forRow: 0) == 0...3)
    #expect(layout.lines(forRow: 1) == 4...4)
    #expect(layout.row(forLine: 2) == 0)
    #expect(layout.row(forLine: 4) == 1)
    // The folded row and every row after it sit a point lower on the page.
    #expect(layout.foldRows(through: 0) == 1)
    #expect(layout.foldRows(through: 2) == 1)
    #expect(FoldLayout(folds: [], doc: editor.doc).foldRows(through: 3) == 0)
    // Down from the folded row goes to the next row; the cursor jumps over the fold.
    editor = apply(.cursorLineDown, editor)
    #expect(heads(editor) == [25])
    editor = editor.update(TransactionSpec(selection: .single(11))).state
    editor = apply(.cursorCharRight, editor)
    #expect(heads(editor) == [22])
    // A cursor landing inside a fold opens it.
    editor = editor.update(TransactionSpec(selection: .single(15))).state
    #expect(editor.folds.isEmpty)
}

@Test func foldsFollowEditsAndUnfold() {
    let text = "f() {\n  a;\n}\n"
    var editor = state(text, 0)
    editor = editor.update(TransactionSpec(effects: [.fold(from: 5, to: 11)])).state
    editor = editor.update(EditorInput.type(editor, "x", style: .none)).state
    #expect(editor.folds == [CodeFold(from: 6, to: 12)])
    editor = editor.update(editor.unfoldCode()!).state
    #expect(editor.folds.isEmpty)
    editor = editor.update(TransactionSpec(effects: [.fold(from: 6, to: 12)])).state
    let deleted = editor.update(TransactionSpec(changes: editor.changes([ChangeSpec(from: 8, to: 9)]),
                                                userEvent: "delete.backward"))
    #expect(deleted.state.folds.isEmpty)
}

@Test func copyCutAndPasteFollowCodeMirror() {
    let editor = state("one\ntwo\nthree", 5)
    let copied = EditorInput.copied(editor)
    #expect(copied.text == "two" && copied.linewise)
    let cut = editor.update(EditorInput.cut(editor)!).state
    #expect(cut.doc.string == "one\nthree")
    let pasted = cut.update(EditorInput.paste(cut, "two", lastLinewiseCopy: "two")).state
    #expect(pasted.doc.string == "one\ntwo\nthree")
    var multi = state("a\nb", 0)
    multi = multi.update(TransactionSpec(selection: EditorSelection([.cursor(1), .cursor(3)]))).state
    let spread = multi.update(EditorInput.paste(multi, "X\nY", lastLinewiseCopy: nil)).state
    #expect(spread.doc.string == "aX\nbY")
}

@Test func keysResolveInTheAppsOrder() {
    #expect(EditorKeymap.actions(key: "d", command: true, option: false, control: false, shift: false)
        == [.selectNextOccurrence])
    #expect(EditorKeymap.actions(key: "Backspace", command: false, option: false, control: false, shift: false)
        == [.deleteBracketPair, .deleteCharBackward])
    #expect(EditorKeymap.actions(key: "ArrowLeft", command: false, option: false, control: false, shift: true)
        == [.selectCharLeft])
    #expect(EditorKeymap.actions(key: "u", command: true, option: false, control: false, shift: true)
        == [.toggleCase])
    #expect(EditorKeymap.actions(key: "z", command: true, option: false, control: false, shift: true) == [.redo])
    #expect(EditorKeymap.actions(key: "ArrowUp", command: false, option: true, control: false, shift: true)
        == [.copyLineUp])
    #expect(EditorKeymap.actions(key: "[", command: true, option: true, control: false, shift: false) == [.foldCode])
    #expect(EditorKeymap.actions(key: "Tab", command: false, option: false, control: false, shift: true)
        == [.indentLess])
}

@Test func aSelectionTintsItsOtherMatches() {
    var editor = state("foo bar foo foobar", 0, 3)
    #expect(SelectionMatches.ranges(editor, visible: 0..<18) == [8..<11, 12..<15])
    editor = editor.update(TransactionSpec(selection: EditorSelection([.range(0, 3), .range(8, 11)]))).state
    #expect(SelectionMatches.ranges(editor, visible: 0..<18).isEmpty)
}
