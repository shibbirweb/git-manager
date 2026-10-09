import Foundation

// What a key sends to the shell, as xterm.js's Keyboard.ts encodes it on macOS: arrows and Home/End in normal or
// application cursor mode with xterm's modifier parameter, the editing keys, F1 to F12, Shift+Tab, and Option+Left
// and Right as word moves (ESC b, ESC f) while Option is not Meta.

public enum TermKey: Equatable, Sendable {
    case up, down, left, right, home, end, pageUp, pageDown, insert, delete
    case backspace, tab, enter, escape
    case function(Int)
}

public struct TermModifiers: OptionSet, Sendable {
    public let rawValue: Int

    public init(rawValue: Int) {
        self.rawValue = rawValue
    }

    public static let shift = TermModifiers(rawValue: 1)
    public static let option = TermModifiers(rawValue: 2)
    public static let control = TermModifiers(rawValue: 4)

    /// xterm's modifier parameter: 1 plus shift 1, alt 2, control 4.
    var parameter: Int {
        1 + (contains(.shift) ? 1 : 0) + (contains(.option) ? 2 : 0) + (contains(.control) ? 4 : 0)
    }
}

public enum TermKeys {
    public static func sequence(
        _ key: TermKey, modifiers: TermModifiers = [], applicationCursor: Bool = false, optionIsMeta: Bool = false
    ) -> String {
        let escape = "\u{1B}"
        switch key {
        case .up, .down, .right, .left:
            let letter = ["A", "B", "C", "D"][[TermKey.up, .down, .right, .left].firstIndex(of: key) ?? 0]
            if modifiers == [.option] && !optionIsMeta && (key == .left || key == .right) {
                return escape + (key == .left ? "b" : "f")
            }
            if !modifiers.isEmpty {
                return "\(escape)[1;\(modifiers.parameter)\(letter)"
            }
            return escape + (applicationCursor ? "O" : "[") + letter
        case .home, .end:
            let letter = key == .home ? "H" : "F"
            if !modifiers.isEmpty {
                return "\(escape)[1;\(modifiers.parameter)\(letter)"
            }
            return escape + (applicationCursor ? "O" : "[") + letter
        case .pageUp:
            return tilde(5, modifiers)
        case .pageDown:
            return tilde(6, modifiers)
        case .insert:
            return tilde(2, modifiers)
        case .delete:
            return tilde(3, modifiers)
        case .backspace:
            if modifiers.contains(.control) {
                return "\u{08}"
            }
            return modifiers.contains(.option) ? escape + "\u{7F}" : "\u{7F}"
        case .tab:
            return modifiers.contains(.shift) ? "\(escape)[Z" : "\t"
        case .enter:
            return modifiers.contains(.option) ? escape + "\r" : "\r"
        case .escape:
            return escape
        case .function(let number):
            return function(number, modifiers)
        }
    }

    private static func tilde(_ code: Int, _ modifiers: TermModifiers) -> String {
        modifiers.isEmpty ? "\u{1B}[\(code)~" : "\u{1B}[\(code);\(modifiers.parameter)~"
    }

    private static func function(_ number: Int, _ modifiers: TermModifiers) -> String {
        if (1...4).contains(number) {
            let letter = ["P", "Q", "R", "S"][number - 1]
            return modifiers.isEmpty ? "\u{1B}O\(letter)" : "\u{1B}[1;\(modifiers.parameter)\(letter)"
        }
        let codes = [5: 15, 6: 17, 7: 18, 8: 19, 9: 20, 10: 21, 11: 23, 12: 24]
        guard let code = codes[number] else {
            return ""
        }
        return tilde(code, modifiers)
    }

    /// Text a paste sends: line breaks as carriage returns, wrapped in the bracketed paste markers when the program
    /// asked for them (xterm.js prepareTextForTerminal and bracketTextForPaste).
    public static func paste(_ text: String, bracketed: Bool) -> String {
        let body = text.replacingOccurrences(of: "\r\n", with: "\r").replacingOccurrences(of: "\n", with: "\r")
        return bracketed ? "\u{1B}[200~" + body + "\u{1B}[201~" : body
    }
}
