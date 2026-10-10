// Go to Line's input and target, checked against textCommands.ts parseLineTarget and lineTargetPosition.

import NativeCore
import Testing

@Test func lineTargetsParseLikeTheCurrentApp() {
    #expect(EditorCommands.parseLineTarget("42", lineCount: 100)! == (42, 1))
    #expect(EditorCommands.parseLineTarget(" 42 : 7 ", lineCount: 100)! == (42, 7))
    #expect(EditorCommands.parseLineTarget("42,7", lineCount: 100)! == (42, 7))
    #expect(EditorCommands.parseLineTarget("500", lineCount: 100)! == (100, 1))
    #expect(EditorCommands.parseLineTarget("0:0", lineCount: 100)! == (1, 1))
    #expect(EditorCommands.parseLineTarget("42:", lineCount: 100) == nil)
    #expect(EditorCommands.parseLineTarget("abc", lineCount: 100) == nil)
    #expect(EditorCommands.parseLineTarget("", lineCount: 100) == nil)
}

@Test func aLineTargetLandsInTheLineAndTheColumnStopsAtItsEnd() {
    let doc = TextDocument("one\ntwo three\nx")
    #expect(EditorCommands.lineTargetPosition(doc, line: 2, column: 5) == 8)
    #expect(EditorCommands.lineTargetPosition(doc, line: 2, column: 99) == 13)
    #expect(EditorCommands.lineTargetPosition(doc, line: 9, column: 1) == 14)
    let state = EditorState(doc: doc, selection: .single(9))
    #expect(EditorCommands.lineTargetText(state) == "2:6")
}
