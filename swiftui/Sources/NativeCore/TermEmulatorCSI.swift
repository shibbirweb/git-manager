// CSI sequences: cursor moves, erasing, inserting and deleting, scrolling, reports, as xterm.js's InputHandler.

extension TermEmulator {
    public func csi(_ sequence: TermCSI) {
        if sequence.prefix == "?" || sequence.prefix == ">" || !sequence.intermediates.isEmpty {
            privateCSI(sequence)
            return
        }
        let screen = self.screen
        switch sequence.final {
        case "@":
            restrictCursor()
            shiftRight(screen.row(screen.cursorY), from: screen.cursorX, by: sequence.count(0))
        case "A":
            moveUp(sequence.count(0))
        case "B", "e":
            moveDown(sequence.count(0))
        case "C", "a":
            restrictCursor()
            screen.cursorX = min(columns - 1, screen.cursorX + sequence.count(0))
        case "D":
            restrictCursor()
            screen.cursorX = max(0, screen.cursorX - sequence.count(0))
        case "E":
            moveDown(sequence.count(0))
            screen.cursorX = 0
        case "F":
            moveUp(sequence.count(0))
            screen.cursorX = 0
        case "G", "`":
            screen.cursorX = min(columns, sequence.count(0)) - 1
        case "H", "f":
            moveTo(row: sequence.count(0) - 1, column: sequence.count(1) - 1)
        case "I":
            for _ in 0..<sequence.count(0) {
                screen.cursorX = nextTabStop(from: screen.cursorX)
            }
        case "J":
            eraseInDisplay(sequence.param(0))
        case "K":
            eraseInLine(sequence.param(0))
        case "L":
            insertLines(sequence.count(0))
        case "M":
            deleteLines(sequence.count(0))
        case "P":
            deleteCharacters(sequence.count(0))
        case "S":
            scrollUp(sequence.count(0))
        case "T":
            scrollDown(sequence.count(0))
        case "X":
            restrictCursor()
            let line = screen.row(screen.cursorY)
            line.fill(.blank(style.erased), from: screen.cursorX, to: screen.cursorX + sequence.count(0))
        case "Z":
            var column = min(screen.cursorX, columns - 1)
            for _ in 0..<sequence.count(0) {
                repeat {
                    column -= 1
                } while column > 0 && !tabStops.contains(column)
            }
            screen.cursorX = max(0, column)
        case "b":
            repeatPrevious(sequence.count(0))
        case "c":
            if sequence.param(0) == 0 {
                reply(Array("\u{1B}[?1;2c".utf8))
            }
        case "d":
            moveTo(row: sequence.count(0) - 1, column: screen.cursorX)
        case "g":
            clearTabStops(sequence.param(0))
        case "h", "l":
            setAnsiModes(sequence.params, on: sequence.final == "h")
        case "m":
            selectGraphicRendition(sequence)
        case "n":
            deviceStatus(sequence.param(0))
        case "r":
            setScrollRegion(top: sequence.count(0), bottom: sequence.count(1, default: rows))
        case "s":
            saveCursor()
        case "u":
            restoreCursor()
        default:
            break
        }
    }

    private func privateCSI(_ sequence: TermCSI) {
        switch (sequence.prefix, sequence.intermediates, sequence.final) {
        case ("?", "", "h"), ("?", "", "l"):
            for mode in sequence.params {
                setPrivateMode(mode, on: sequence.final == "h")
            }
        case (">", "", "c"):
            reply(Array("\u{1B}[>0;276;0c".utf8))
        case (nil, " ", "q"):
            setCursorStyle(sequence.param(0))
        case (nil, "!", "p"):
            softReset()
        default:
            break
        }
    }

    /// A cursor waiting to wrap (one past the last column) moves from the last column.
    func restrictCursor() {
        let screen = self.screen
        screen.cursorX = min(screen.cursorX, columns - 1)
        screen.cursorY = min(max(screen.cursorY, 0), rows - 1)
    }

    private func moveUp(_ count: Int) {
        let screen = self.screen
        restrictCursor()
        let top = screen.cursorY >= screen.scrollTop ? screen.scrollTop : 0
        screen.cursorY = max(top, screen.cursorY - count)
    }

    private func moveDown(_ count: Int) {
        let screen = self.screen
        restrictCursor()
        let bottom = screen.cursorY <= screen.scrollBottom ? screen.scrollBottom : rows - 1
        screen.cursorY = min(bottom, screen.cursorY + count)
    }

    /// CUP: with origin mode on, rows count from the scroll region's top and stay inside it.
    func moveTo(row: Int, column: Int) {
        let screen = self.screen
        let top = originMode ? screen.scrollTop : 0
        let bottom = originMode ? screen.scrollBottom : rows - 1
        screen.cursorY = min(max(top + row, top), bottom)
        screen.cursorX = min(max(column, 0), columns - 1)
    }

    private func eraseInDisplay(_ mode: Int) {
        let screen = self.screen
        restrictCursor()
        let blank = TermCell.blank(style.erased)
        switch mode {
        case 0:
            eraseInLine(0)
            for row in (screen.cursorY + 1)..<rows {
                resetLine(screen.row(row), blank)
            }
        case 1:
            for row in 0..<screen.cursorY {
                resetLine(screen.row(row), blank)
            }
            eraseInLine(1)
        case 2:
            for row in 0..<rows {
                resetLine(screen.row(row), blank)
            }
        case 3:
            clearScrollback()
        default:
            break
        }
    }

    private func resetLine(_ line: TermLine, _ blank: TermCell) {
        line.fill(blank, from: 0, to: columns)
        line.isWrapped = false
    }

    func eraseInLine(_ mode: Int) {
        let screen = self.screen
        restrictCursor()
        let line = screen.row(screen.cursorY)
        let blank = TermCell.blank(style.erased)
        switch mode {
        case 0:
            line.fill(blank, from: screen.cursorX, to: columns)
            if screen.cursorY + 1 < rows {
                screen.row(screen.cursorY + 1).isWrapped = false
            }
        case 1:
            line.fill(blank, from: 0, to: screen.cursorX + 1)
        case 2:
            line.fill(blank, from: 0, to: columns)
        default:
            break
        }
    }

    /// ED 3: drops the scrollback, keeping the screen.
    func clearScrollback() {
        let screen = self.screen
        guard screen.base > 0 else {
            return
        }
        var ring = TermRing(capacity: screen.ring.capacity)
        for row in 0..<rows {
            ring.push(screen.row(row))
        }
        screen.ring = ring
        screen.base = 0
        viewOffset = 0
    }

    private func insertLines(_ count: Int) {
        let screen = self.screen
        restrictCursor()
        guard screen.cursorY >= screen.scrollTop && screen.cursorY <= screen.scrollBottom else {
            return
        }
        for _ in 0..<min(count, screen.scrollBottom - screen.cursorY + 1) {
            screen.ring.rotate(
                first: screen.base + screen.cursorY, last: screen.base + screen.scrollBottom, up: false,
                insert: TermLine(columns: columns, fill: .blank(style.erased))
            )
        }
        screen.cursorX = 0
    }

    private func deleteLines(_ count: Int) {
        let screen = self.screen
        restrictCursor()
        guard screen.cursorY >= screen.scrollTop && screen.cursorY <= screen.scrollBottom else {
            return
        }
        for _ in 0..<min(count, screen.scrollBottom - screen.cursorY + 1) {
            screen.ring.rotate(
                first: screen.base + screen.cursorY, last: screen.base + screen.scrollBottom, up: true,
                insert: TermLine(columns: columns, fill: .blank(style.erased))
            )
        }
        screen.cursorX = 0
    }

    private func deleteCharacters(_ count: Int) {
        let screen = self.screen
        restrictCursor()
        let line = screen.row(screen.cursorY)
        let column = screen.cursorX
        let count = min(count, columns - column)
        line.cells.removeSubrange(column..<(column + count))
        line.cells += [TermCell](repeating: .blank(style.erased), count: count)
        line.combined = Dictionary(uniqueKeysWithValues: line.combined.compactMap { entry in
            if entry.key < column {
                return entry
            }
            return entry.key >= column + count ? (entry.key - count, entry.value) : nil
        })
    }

    /// REP: prints the character before the cursor again.
    private func repeatPrevious(_ count: Int) {
        let screen = self.screen
        let column = min(screen.cursorX, columns) - 1
        guard column >= 0, let character = screen.row(screen.cursorY).cells[column].character,
              let scalar = character.unicodeScalars.first else {
            return
        }
        for _ in 0..<count {
            print(scalar)
        }
    }

    private func clearTabStops(_ mode: Int) {
        if mode == 0 {
            tabStops.remove(min(screen.cursorX, columns - 1))
        } else if mode == 3 {
            tabStops.removeAll()
        }
    }

    private func deviceStatus(_ mode: Int) {
        let screen = self.screen
        if mode == 5 {
            reply(Array("\u{1B}[0n".utf8))
        } else if mode == 6 {
            let row = screen.cursorY + 1 - (originMode ? screen.scrollTop : 0)
            reply(Array("\u{1B}[\(row);\(min(screen.cursorX, columns - 1) + 1)R".utf8))
        }
    }

    private func setScrollRegion(top: Int, bottom: Int) {
        let screen = self.screen
        let bottom = min(bottom, rows)
        guard top < bottom else {
            return
        }
        screen.scrollTop = top - 1
        screen.scrollBottom = bottom - 1
        moveTo(row: 0, column: 0)
    }
}
