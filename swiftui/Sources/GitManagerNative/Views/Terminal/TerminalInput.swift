// Keys, paste and copy for the terminal canvas: special keys through TermKeys (xterm.js's encoding), typed text as
// macOS composes it (Option makes characters, as macOptionIsMeta is off by default), Control letters as control
// characters, Cmd+V pasted with bracketed paste when the program asked for it, and Cmd+C copying the selection.

import AppKit
import NativeCore

@MainActor
final class TerminalInput {
    weak var view: TerminalCanvasView?

    private var session: TerminalSession? { view?.session }

    func keyDown(_ event: NSEvent) {
        guard let session else {
            return
        }
        let modifiers = Self.modifiers(event)
        if let key = Self.key(event.keyCode) {
            let cursorKeys = session.term.applicationCursorKeys
            session.write(TermKeys.sequence(key, modifiers: modifiers, applicationCursor: cursorKeys))
        } else if modifiers.contains(.control), let text = Self.control(event) {
            session.write(text)
        } else if let text = event.characters, !text.isEmpty {
            session.write(text)
        }
        // Typing follows the output again, as xterm.js scrolls to the bottom on input.
        if session.term.viewOffset != 0 {
            session.term.scrollViewToBottom()
            session.changed()
        }
        view?.restartBlink()
    }

    /// Cmd+V and Cmd+C; other Cmd shortcuts go on to the menus.
    func keyEquivalent(_ event: NSEvent) -> Bool {
        guard event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command, let session else {
            return false
        }
        switch event.charactersIgnoringModifiers {
        case "v":
            if let text = NSPasteboard.general.string(forType: .string) {
                session.write(TermKeys.paste(text, bracketed: session.term.bracketedPaste))
            }
            return true
        case "c":
            // Copy with nothing selected does nothing, as in xterm.js.
            guard let selection = view?.selection, !selection.isEmpty else {
                return false
            }
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(selection.text(in: session.term), forType: .string)
            return true
        default:
            return false
        }
    }

    private static func modifiers(_ event: NSEvent) -> TermModifiers {
        var modifiers: TermModifiers = []
        let flags = event.modifierFlags
        if flags.contains(.shift) {
            modifiers.insert(.shift)
        }
        if flags.contains(.option) {
            modifiers.insert(.option)
        }
        if flags.contains(.control) {
            modifiers.insert(.control)
        }
        return modifiers
    }

    /// Ctrl with a letter or one of @[\]^_ (and Space) gives the control character.
    private static func control(_ event: NSEvent) -> String? {
        guard let base = event.charactersIgnoringModifiers?.lowercased().unicodeScalars.first else {
            return nil
        }
        switch base.value {
        case 0x61...0x7A:
            return String(UnicodeScalar(UInt8(base.value - 0x60)))
        case 0x20, 0x40, 0x32:
            return "\u{0}"
        case 0x5B...0x5F:
            return String(UnicodeScalar(UInt8(base.value - 0x40)))
        default:
            return event.characters
        }
    }

    private static func key(_ keyCode: UInt16) -> TermKey? {
        switch keyCode {
        case 126: return .up
        case 125: return .down
        case 123: return .left
        case 124: return .right
        case 115: return .home
        case 119: return .end
        case 116: return .pageUp
        case 121: return .pageDown
        case 117: return .delete
        case 51: return .backspace
        case 48: return .tab
        case 36, 76: return .enter
        case 53: return .escape
        case 122: return .function(1)
        case 120: return .function(2)
        case 99: return .function(3)
        case 118: return .function(4)
        case 96: return .function(5)
        case 97: return .function(6)
        case 98: return .function(7)
        case 100: return .function(8)
        case 101: return .function(9)
        case 109: return .function(10)
        case 103: return .function(11)
        case 111: return .function(12)
        default: return nil
        }
    }
}
