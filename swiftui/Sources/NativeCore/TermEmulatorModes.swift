import Foundation

// Modes (SM, RM, DECSET, DECRST), colors and styles (SGR), ESC and OSC sequences, cursor save and restore and the
// alternate screen, as xterm.js's InputHandler.

extension TermEmulator {
    func setAnsiModes(_ modes: [Int], on: Bool) {
        for mode in modes {
            if mode == 4 {
                insertMode = on
            } else if mode == 20 {
                newLineMode = on
            }
        }
    }

    func setPrivateMode(_ mode: Int, on: Bool) {
        switch mode {
        case 1:
            applicationCursorKeys = on
        case 6:
            originMode = on
            moveTo(row: 0, column: 0)
        case 7:
            wraparound = on
        case 12:
            cursorBlink = on
        case 25:
            cursorVisible = on
        case 66:
            applicationKeypad = on
        case 9, 1000, 1002, 1003:
            mouseTracking = on ? mode : 0
        case 1004:
            focusEvents = on
        case 1006:
            sgrMouse = on
        case 1048:
            if on {
                saveCursor()
            } else {
                restoreCursor()
            }
        case 47, 1047, 1049:
            if mode == 1049 && on {
                saveCursor()
            }
            setAlternateScreen(on)
            if mode == 1049 && !on {
                restoreCursor()
            }
        case 2004:
            bracketedPaste = on
        default:
            break
        }
    }

    private func setAlternateScreen(_ on: Bool) {
        if on && alternate == nil {
            let screen = TermScreen(columns: columns, rows: rows, scrollback: 0)
            screen.cursorX = normal.cursorX
            screen.cursorY = normal.cursorY
            alternate = screen
            viewOffset = 0
        } else if !on, let screen = alternate {
            normal.cursorX = screen.cursorX
            normal.cursorY = screen.cursorY
            alternate = nil
        }
    }

    func setCursorStyle(_ value: Int) {
        switch value {
        case 0, 1, 2:
            cursorShape = .block
        case 3, 4:
            cursorShape = .underline
        case 5, 6:
            cursorShape = .bar
        default:
            return
        }
        cursorBlink = value == 0 ? nil : value % 2 == 1
    }

    func saveCursor() {
        let screen = self.screen
        screen.saved = TermScreen.SavedCursor(
            x: screen.cursorX, y: screen.cursorY, style: style, originMode: originMode, charsetG0Line: lineDrawing
        )
    }

    func restoreCursor() {
        let screen = self.screen
        let saved = screen.saved
        screen.cursorX = min(saved.x, columns - 1)
        screen.cursorY = min(saved.y, rows - 1)
        style = saved.style
        originMode = saved.originMode
        lineDrawing = saved.charsetG0Line
    }

    /// DECSTR: modes and the scroll region back to their defaults, the screen kept.
    func softReset() {
        cursorVisible = true
        insertMode = false
        originMode = false
        wraparound = true
        applicationCursorKeys = false
        applicationKeypad = false
        style = .plain
        lineDrawing = false
        let screen = self.screen
        screen.scrollTop = 0
        screen.scrollBottom = rows - 1
        screen.saved = TermScreen.SavedCursor()
    }

    /// RIS (ESC c): a new terminal of the same size.
    func fullReset() {
        alternate = nil
        normal = TermScreen(columns: columns, rows: rows, scrollback: scrollback)
        softReset()
        bracketedPaste = false
        mouseTracking = 0
        sgrMouse = false
        focusEvents = false
        cursorShape = .block
        cursorBlink = nil
        newLineMode = false
        viewOffset = 0
        resetTabStops()
    }

    public func escape(intermediates: String, final: Character) {
        switch (intermediates, final) {
        case ("", "7"):
            saveCursor()
        case ("", "8"):
            restoreCursor()
        case ("", "D"):
            index()
        case ("", "E"):
            screen.cursorX = 0
            index()
        case ("", "H"):
            tabStops.insert(min(screen.cursorX, columns - 1))
        case ("", "M"):
            reverseIndex()
        case ("", "c"):
            fullReset()
        case ("", "="):
            applicationKeypad = true
        case ("", ">"):
            applicationKeypad = false
        case ("(", "0"):
            lineDrawing = true
        case ("(", _):
            lineDrawing = false
        default:
            break
        }
    }

    public func osc(_ identifier: Int, _ data: String) {
        switch identifier {
        case 0, 2:
            title = data
        case 7:
            reportedFolder = Self.folder(fromOsc7: data) ?? reportedFolder
        default:
            break
        }
    }

    /// The path of an OSC 7 file:// URL, percent decoded.
    static func folder(fromOsc7 data: String) -> String? {
        guard data.hasPrefix("file://") else {
            return nil
        }
        let rest = data.dropFirst("file://".count)
        guard let slash = rest.firstIndex(of: "/") else {
            return nil
        }
        return String(rest[slash...]).removingPercentEncoding
    }

    // MARK: SGR

    func selectGraphicRendition(_ sequence: TermCSI) {
        let params = sequence.params.isEmpty ? [0] : sequence.params
        var index = 0
        while index < params.count {
            let code = params[index]
            switch code {
            case 0:
                style = .plain
            case 1:
                style.setFlag(fg: TermStyle.bold, true)
            case 2:
                style.setFlag(bg: TermStyle.dim, true)
            case 3:
                style.setFlag(bg: TermStyle.italic, true)
            case 4:
                let kind = sequence.subParams[index]?.first ?? 1
                style.setFlag(fg: TermStyle.underline, kind != 0)
            case 5:
                style.setFlag(fg: TermStyle.blink, true)
            case 7:
                style.setFlag(fg: TermStyle.inverse, true)
            case 8:
                style.setFlag(fg: TermStyle.invisible, true)
            case 9:
                style.setFlag(fg: TermStyle.strikethrough, true)
            case 21:
                style.setFlag(fg: TermStyle.underline, true)
            case 22:
                style.setFlag(fg: TermStyle.bold, false)
                style.setFlag(bg: TermStyle.dim, false)
            case 23:
                style.setFlag(bg: TermStyle.italic, false)
            case 24:
                style.setFlag(fg: TermStyle.underline, false)
            case 25:
                style.setFlag(fg: TermStyle.blink, false)
            case 27:
                style.setFlag(fg: TermStyle.inverse, false)
            case 28:
                style.setFlag(fg: TermStyle.invisible, false)
            case 29:
                style.setFlag(fg: TermStyle.strikethrough, false)
            case 30...37:
                style.setForeground(.palette16, UInt32(code - 30))
            case 39:
                style.setForeground(.standard, 0)
            case 40...47:
                style.setBackground(.palette16, UInt32(code - 40))
            case 49:
                style.setBackground(.standard, 0)
            case 53:
                style.setFlag(bg: TermStyle.overline, true)
            case 55:
                style.setFlag(bg: TermStyle.overline, false)
            case 90...97:
                style.setForeground(.palette16, UInt32(code - 90 + 8))
            case 100...107:
                style.setBackground(.palette16, UInt32(code - 100 + 8))
            case 38, 48, 58:
                index += extendedColor(code, at: index, sequence)
            default:
                break
            }
            index += 1
        }
    }

    /// 38, 48 and 58 with 5;n or 2;r;g;b, or the same after colons. Returns how many more parameters it took.
    private func extendedColor(_ code: Int, at index: Int, _ sequence: TermCSI) -> Int {
        var values: [Int]
        var taken = 0
        if let sub = sequence.subParams[index], !sub.isEmpty {
            values = sub
            // 38:2:<colorspace>:r:g:b carries a color space id before the channels.
            if values.first == 2 && values.count >= 5 {
                values = [2] + values.suffix(3)
            }
        } else {
            values = Array(sequence.params.dropFirst(index + 1).prefix(4))
            taken = values.first == 5 ? 2 : (values.first == 2 ? 4 : 0)
        }
        var mode: TermColorMode?
        var color: UInt32 = 0
        if values.first == 5, values.count >= 2 {
            mode = .palette256
            color = UInt32(min(255, max(0, values[1])))
        } else if values.first == 2, values.count >= 4 {
            mode = .rgb
            let channel = { (value: Int) in UInt32(min(255, max(0, value))) }
            color = channel(values[1]) << 16 | channel(values[2]) << 8 | channel(values[3])
        }
        if let mode {
            if code == 38 {
                style.setForeground(mode, color)
            } else if code == 48 {
                style.setBackground(mode, color)
            }
        }
        return min(taken, sequence.params.count - index - 1)
    }
}
