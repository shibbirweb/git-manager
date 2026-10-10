import NativeCore
import Testing

private func terminal(_ columns: Int = 20, _ rows: Int = 5, scrollback: Int = 100) -> TermEmulator {
    TermEmulator(columns: columns, rows: rows, scrollback: scrollback)
}

@Test func printingWrapsAndLineFeedsKeepTheColumn() {
    let term = terminal(10, 3)
    term.feed("abcdefghijKL\r\nx\ny")
    // LF without CR keeps the column (convertEol is off, as in xterm.js).
    #expect(term.screenText() == ["KL", "x", " y"])
    #expect(term.allText().first == "abcdefghij")
    #expect(term.screen.row(0).isWrapped)
    #expect(term.screen.cursorY == 2)
}

@Test func theScreenScrollsIntoTheScrollback() {
    let term = terminal(10, 3)
    term.feed("1\r\n2\r\n3\r\n4\r\n5")
    #expect(term.screenText() == ["3", "4", "5"])
    #expect(term.allText() == ["1", "2", "3", "4", "5"])
    #expect(term.maxViewOffset == 2)
    term.scrollView(by: -1)
    #expect(term.visibleLine(0).text() == "2")
    // Output while scrolled up keeps the view on its lines.
    term.feed("\r\n6")
    #expect(term.visibleLine(0).text() == "2")
    term.scrollViewToBottom()
    #expect(term.visibleLine(2).text() == "6")
}

@Test func aFullScrollbackDropsTheOldestLine() {
    let term = terminal(10, 2, scrollback: 3)
    for number in 1...10 {
        term.feed("\(number)\r\n")
    }
    #expect(term.allText() == ["7", "8", "9", "10", ""])
}

@Test func cursorMovesAndErases() {
    let term = terminal(10, 3)
    term.feed("hello\u{1B}[1;3HX\u{1B}[2;1Hworld\u{1B}[1G\u{1B}[K")
    #expect(term.screenText() == ["heXlo", "", ""])
    term.feed("\u{1B}[1;1Habc\u{1B}[2D\u{1B}[1P")
    #expect(term.screenText()[0] == "aclo")
    term.feed("\u{1B}[2J")
    #expect(term.screenText() == ["", "", ""])
}

@Test func scrollRegionsInsertAndDeleteLines() {
    let term = terminal(10, 4)
    term.feed("a\r\nb\r\nc\r\nd")
    term.feed("\u{1B}[2;3r\u{1B}[2;1H\u{1B}[L")
    #expect(term.screenText() == ["a", "", "b", "d"])
    term.feed("\u{1B}[M")
    #expect(term.screenText() == ["a", "b", "", "d"])
    // A line feed at the region's bottom scrolls only the region, nothing goes into the scrollback.
    term.feed("\u{1B}[3;1Hx\ny")
    #expect(term.screenText() == ["a", "x", " y", "d"])
    #expect(term.allText().count == 4)
}

@Test func sgrSetsColorsAndStyles() {
    let term = terminal()
    term.feed("\u{1B}[1;31mA\u{1B}[0;38;5;200;48;2;1;2;3mB\u{1B}[38:2::10:20:30mC\u{1B}[7;2;3mD\u{1B}[mE")
    let cells = term.screen.row(0).cells
    #expect(cells[0].style.isBold && cells[0].style.fgMode == .palette16 && cells[0].style.fgColor == 1)
    #expect(cells[1].style.fgMode == .palette256 && cells[1].style.fgColor == 200)
    #expect(cells[1].style.bgMode == .rgb && cells[1].style.bgColor == 0x010203)
    #expect(cells[2].style.fgMode == .rgb && cells[2].style.fgColor == 0x0A141E)
    #expect(cells[3].style.isInverse && cells[3].style.isDim && cells[3].style.isItalic)
    #expect(cells[4].style == .plain)
}

@Test func wideCharactersTakeTwoCellsAndCombiningMarksJoin() {
    let term = terminal(5, 2)
    term.feed("a\u{4E2D}e\u{301}\u{4E2D}")
    let line = term.screen.row(0)
    #expect(line.cells[1].width == 2 && line.cells[2].width == 0)
    #expect(line.text() == "a\u{4E2D}e\u{301}")
    // The second wide character does not fit in the last cell: it wraps.
    #expect(term.screen.row(1).text() == "\u{4E2D}")
}

@Test func reportsAnswerThroughTheReplyHandler() {
    let term = terminal()
    var answers: [String] = []
    term.reply = { answers.append(String(decoding: $0, as: UTF8.self)) }
    term.feed("ab\u{1B}[6n\u{1B}[c\u{1B}[>c\u{1B}[5n")
    #expect(answers == ["\u{1B}[1;3R", "\u{1B}[?1;2c", "\u{1B}[>0;276;0c", "\u{1B}[0n"])
}

@Test func theAlternateScreenKeepsTheNormalOne() {
    let term = terminal(10, 3)
    term.feed("shell$ ")
    term.feed("\u{1B}[?1049h\u{1B}[2J\u{1B}[Hvim")
    #expect(term.screenText()[0] == "vim")
    term.feed("\u{1B}[?1049l")
    #expect(term.screenText()[0] == "shell$")
    #expect(term.screen.cursorX == 7)
}

@Test func modesAndOscAreRecorded() {
    let term = terminal()
    term.feed("\u{1B}[?1h\u{1B}[?2004h\u{1B}[?25l\u{1B}[5 q\u{1B}]0;title\u{07}")
    term.feed("\u{1B}]7;file://mac/Users/me/my%20repo\u{1B}\\")
    #expect(term.applicationCursorKeys && term.bracketedPaste && !term.cursorVisible)
    #expect(term.cursorShape == .bar && term.cursorBlink == true)
    #expect(term.title == "title")
    #expect(term.reportedFolder == "/Users/me/my repo")
}

@Test func utf8SplitBetweenReadsStillDecodes() {
    let term = terminal()
    let bytes = Array("é€".utf8)
    term.feed(Array(bytes[0..<1]))
    term.feed(Array(bytes[1..<3]))
    term.feed(Array(bytes[3...]))
    #expect(term.screenText()[0] == "é€")
}

@Test func resizeKeepsTheCursorLine() {
    let term = terminal(10, 4)
    term.feed("1\r\n2\r\n3\r\n4")
    term.resize(columns: 6, rows: 2)
    #expect(term.screenText() == ["3", "4"])
    term.resize(columns: 12, rows: 4)
    #expect(term.screenText() == ["1", "2", "3", "4"])
    #expect(term.screen.cursorY == 3)
}

@Test func aSelectionCopiesItsTextWithWrappedLinesJoined() {
    let term = terminal(5, 4)
    term.feed("abcdefg\r\nxy  \r\nz")
    // "abcde" wrapped into "fg", then "xy", then "z".
    let all = TermSelection(anchor: TermPosition(line: 0, column: 0), head: TermPosition(line: 3, column: 1))
    #expect(all.text(in: term) == "abcdefg\nxy\nz")
    let middle = TermSelection(anchor: TermPosition(line: 1, column: 1), head: TermPosition(line: 0, column: 3))
    #expect(middle.text(in: term) == "def")
    #expect(middle.contains(line: 0, column: 4) && !middle.contains(line: 1, column: 1))
    #expect(TermSelection(anchor: all.head, head: all.head).text(in: term).isEmpty)
}
