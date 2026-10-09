// The terminal emulator: what the shell's output does to the screen, after xterm.js's InputHandler, so a program
// behaves the same in both apps. Printing, wrapping, line feeds and scrolling are here; CSI sequences in
// TermEmulatorCSI.swift, modes, SGR, ESC and OSC in TermEmulatorModes.swift.

public enum TermCursorShape: Sendable {
    case block, underline, bar
}

public final class TermEmulator: TermParserHandler {
    public internal(set) var normal: TermScreen
    public internal(set) var alternate: TermScreen?
    public var screen: TermScreen { alternate ?? normal }
    public internal(set) var columns: Int
    public internal(set) var rows: Int
    public let scrollback: Int

    var style = TermStyle.plain
    var parser = TermParser()
    var tabStops: Set<Int> = []
    var lineDrawing = false

    // Modes (DECSET and SM)
    public internal(set) var applicationCursorKeys = false
    public internal(set) var applicationKeypad = false
    public internal(set) var bracketedPaste = false
    public internal(set) var cursorVisible = true
    public internal(set) var cursorShape = TermCursorShape.block
    /// nil: the setting decides; else the program asked for blinking or steady.
    public internal(set) var cursorBlink: Bool?
    public internal(set) var mouseTracking = 0
    public internal(set) var sgrMouse = false
    public internal(set) var focusEvents = false
    var originMode = false
    var wraparound = true
    var insertMode = false
    var newLineMode = false

    public internal(set) var title = ""
    /// The folder the shell reported with OSC 7 (file://host/path).
    public internal(set) var reportedFolder: String?
    /// How far the view is scrolled up from the bottom, in lines (0 follows the output).
    public internal(set) var viewOffset = 0
    /// Grows on every change of what the screen shows, so a view redraws only when it moved.
    public private(set) var version = 0

    /// Answers to the program (cursor position reports, device attributes), to write back to the shell.
    public var reply: ([UInt8]) -> Void = { _ in }
    public var bell: () -> Void = {}

    public init(columns: Int, rows: Int, scrollback: Int = 5000) {
        self.columns = max(2, columns)
        self.rows = max(1, rows)
        self.scrollback = max(0, scrollback)
        normal = TermScreen(columns: self.columns, rows: self.rows, scrollback: self.scrollback)
        resetTabStops()
    }

    public func feed(_ bytes: UnsafeBufferPointer<UInt8>) {
        parser.feed(bytes, to: self)
        version &+= 1
    }

    public func feed(_ bytes: [UInt8]) {
        bytes.withUnsafeBufferPointer { feed($0) }
    }

    public func feed(_ text: String) {
        feed(Array(text.utf8))
    }

    func touch() {
        version &+= 1
    }

    // MARK: Printing

    public func print(_ scalar: Unicode.Scalar) {
        let screen = self.screen
        var scalar = scalar
        if lineDrawing, let mapped = TermCharsets.lineDrawing[scalar.value] {
            scalar = mapped
        }
        let width = TermWidth.of(scalar)
        if width == 0 {
            combine(scalar, on: screen)
            return
        }
        if screen.cursorX + width > columns {
            if wraparound {
                if screen.cursorX < columns {
                    // A wide character that does not fit leaves the last cell empty and wraps.
                    screen.row(screen.cursorY).fill(.blank(style.erased), from: screen.cursorX, to: columns)
                }
                screen.cursorX = 0
                index()
                screen.row(screen.cursorY).isWrapped = true
            } else {
                screen.cursorX = columns - width
            }
        }
        let line = screen.row(screen.cursorY)
        if insertMode {
            shiftRight(line, from: screen.cursorX, by: width)
        }
        clearWide(line, at: screen.cursorX)
        line.cells[screen.cursorX] = TermCell(scalar: scalar.value, width: width, style: style)
        line.combined[screen.cursorX] = nil
        if width == 2 && screen.cursorX + 1 < columns {
            clearWide(line, at: screen.cursorX + 1)
            line.cells[screen.cursorX + 1] = TermCell(scalar: 0, width: 0, style: style)
        }
        screen.cursorX += width
    }

    /// Writing over half of a wide character blanks its other half.
    private func clearWide(_ line: TermLine, at column: Int) {
        let cell = line.cells[column]
        if cell.width == 2 && column + 1 < columns {
            line.cells[column + 1] = .blank(cell.style)
        } else if cell.width == 0 && column > 0 && line.cells[column - 1].width == 2 {
            line.cells[column - 1] = .blank(line.cells[column - 1].style)
        }
    }

    private func combine(_ scalar: Unicode.Scalar, on screen: TermScreen) {
        var column = screen.cursorX - 1
        var line = screen.row(screen.cursorY)
        if column < 0 {
            guard screen.cursorY > 0, line.isWrapped else {
                return
            }
            line = screen.row(screen.cursorY - 1)
            column = columns - 1
        }
        if line.cells[column].width == 0 && column > 0 {
            column -= 1
        }
        guard let base = line.cells[column].character else {
            return
        }
        var text = line.combined[column] ?? String(base)
        text.unicodeScalars.append(scalar)
        line.combined[column] = text
    }

    func shiftRight(_ line: TermLine, from column: Int, by count: Int) {
        guard column < columns else {
            return
        }
        let count = min(count, columns - column)
        line.cells.replaceSubrange(column..<column, with: [TermCell](repeating: .blank(style.erased), count: count))
        line.cells.removeLast(count)
        line.combined = Dictionary(uniqueKeysWithValues: line.combined.compactMap { entry in
            let moved = entry.key >= column ? entry.key + count : entry.key
            return moved < columns ? (moved, entry.value) : nil
        })
    }

    // MARK: Controls

    public func execute(_ control: UInt8) {
        let screen = self.screen
        switch control {
        case 0x07:
            bell()
        case 0x08:
            screen.cursorX = min(screen.cursorX, columns - 1)
            if screen.cursorX > 0 {
                screen.cursorX -= 1
            }
        case 0x09:
            screen.cursorX = nextTabStop(from: screen.cursorX)
        case 0x0A, 0x0B, 0x0C:
            index()
            if newLineMode {
                screen.cursorX = 0
            }
            if screen.cursorX >= columns {
                screen.cursorX = columns - 1
            }
        case 0x0D:
            screen.cursorX = 0
        case 0x0E, 0x0F:
            // SO and SI (G1 and G0); only G0 is used.
            break
        default:
            break
        }
    }

    /// Moves the cursor down a line, scrolling the region when it is at its bottom (IND).
    func index() {
        let screen = self.screen
        if screen.cursorY == screen.scrollBottom {
            scrollUp(1)
        } else if screen.cursorY < rows - 1 {
            screen.cursorY += 1
        }
    }

    /// Moves the cursor up a line, scrolling the region down when it is at its top (RI).
    func reverseIndex() {
        let screen = self.screen
        if screen.cursorY == screen.scrollTop {
            scrollDown(1)
        } else if screen.cursorY > 0 {
            screen.cursorY -= 1
        }
    }

    /// Scrolls the region up; with the whole screen as the region, the top line goes into the scrollback.
    func scrollUp(_ count: Int) {
        let screen = self.screen
        for _ in 0..<min(count, rows) {
            let blank = TermLine(columns: columns, fill: .blank(style.erased))
            if screen.scrollTop == 0 && screen.scrollBottom == rows - 1 && screen.hasScrollback {
                if !screen.ring.push(blank) {
                    screen.base += 1
                }
                // A view scrolled into the scrollback stays on its lines.
                if viewOffset > 0 {
                    viewOffset = min(viewOffset + 1, screen.base)
                }
            } else {
                screen.ring.rotate(
                    first: screen.base + screen.scrollTop, last: screen.base + screen.scrollBottom, up: true,
                    insert: blank
                )
            }
        }
    }

    func scrollDown(_ count: Int) {
        let screen = self.screen
        for _ in 0..<min(count, rows) {
            screen.ring.rotate(
                first: screen.base + screen.scrollTop, last: screen.base + screen.scrollBottom, up: false,
                insert: TermLine(columns: columns, fill: .blank(style.erased))
            )
        }
    }

    func nextTabStop(from column: Int) -> Int {
        var next = column + 1
        while next < columns - 1 && !tabStops.contains(next) {
            next += 1
        }
        return min(next, columns - 1)
    }

    func resetTabStops() {
        tabStops = Set(stride(from: 8, to: columns, by: 8))
    }
}
