import NativeCore
import Testing

@Test func arrowsFollowTheCursorKeyMode() {
    #expect(TermKeys.sequence(.up) == "\u{1B}[A")
    #expect(TermKeys.sequence(.up, applicationCursor: true) == "\u{1B}OA")
    #expect(TermKeys.sequence(.right, modifiers: [.shift]) == "\u{1B}[1;2C")
    #expect(TermKeys.sequence(.home, applicationCursor: true) == "\u{1B}OH")
    // Option+Left and Right move by words while Option is not Meta (xterm.js on macOS).
    #expect(TermKeys.sequence(.left, modifiers: [.option]) == "\u{1B}b")
    #expect(TermKeys.sequence(.right, modifiers: [.option]) == "\u{1B}f")
}

@Test func editingAndFunctionKeys() {
    #expect(TermKeys.sequence(.backspace) == "\u{7F}")
    #expect(TermKeys.sequence(.backspace, modifiers: [.option]) == "\u{1B}\u{7F}")
    #expect(TermKeys.sequence(.delete) == "\u{1B}[3~")
    #expect(TermKeys.sequence(.pageUp, modifiers: [.control]) == "\u{1B}[5;5~")
    #expect(TermKeys.sequence(.tab, modifiers: [.shift]) == "\u{1B}[Z")
    #expect(TermKeys.sequence(.function(1)) == "\u{1B}OP")
    #expect(TermKeys.sequence(.function(12)) == "\u{1B}[24~")
}

@Test func pastesUseCarriageReturnsAndBrackets() {
    #expect(TermKeys.paste("a\nb\r\nc", bracketed: false) == "a\rb\rc")
    #expect(TermKeys.paste("ls", bracketed: true) == "\u{1B}[200~ls\u{1B}[201~")
}
