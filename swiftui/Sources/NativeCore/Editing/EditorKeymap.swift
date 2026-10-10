// The file editor's keys on macOS, in the order the current app's keymaps take them (src/lib/editor/setup.ts):
// the close-brackets Backspace, the find bar's keys (Cmd+D...), the Code menu's keys (editorCommands.ts), then
// CodeMirror's default keymap, the history keymap and Tab. Keys are written as CodeMirror names them
// ("Mod-Shift-z"); a binding's `shift` variant runs when Shift is held.

import Foundation

public enum EditorAction: String, CaseIterable, Sendable {
    case cursorCharLeft, cursorCharRight, selectCharLeft, selectCharRight
    case cursorGroupLeft, cursorGroupRight, selectGroupLeft, selectGroupRight
    case cursorLineBoundaryLeft, cursorLineBoundaryRight, selectLineBoundaryLeft, selectLineBoundaryRight
    case cursorLineUp, cursorLineDown, selectLineUp, selectLineDown
    case cursorDocStart, cursorDocEnd, selectDocStart, selectDocEnd
    case cursorPageUp, cursorPageDown, selectPageUp, selectPageDown
    case cursorLineStart, cursorLineEnd, selectLineStart, selectLineEnd
    case insertNewlineAndIndent, insertBlankLine, selectAll, selectLine, simplifySelection
    case deleteCharBackward, deleteCharForward, deleteGroupBackward, deleteGroupForward
    case deleteLineBoundaryBackward, deleteLineBoundaryForward, deleteToLineEnd, splitLine
    case moveLineUp, moveLineDown, copyLineUp, copyLineDown, addCursorAbove, addCursorBelow
    case indentMore, indentLess, deleteLine, toggleComment, toggleBlockComment
    case undo, redo, undoSelection, redoSelection
    case selectNextOccurrence, selectAllOccurrences
    case duplicate, joinLines, toggleCase, sortLines
    case foldCode, unfoldCode, foldAll, unfoldAll
    case deleteBracketPair
    // Handled by the window, not the state: the clipboard and the file.
    case copy, cut, paste, save
}

public struct KeyBinding: Sendable {
    public let key: String
    public let run: EditorAction
    public let shift: EditorAction?

    public init(_ key: String, _ run: EditorAction, shift: EditorAction? = nil) {
        self.key = key
        self.run = run
        self.shift = shift
    }
}

public enum EditorKeymap {
    /// macOS bindings, first match wins.
    public static let bindings: [KeyBinding] = [
        KeyBinding("Mod-s", .save),
        KeyBinding("Backspace", .deleteBracketPair),
        KeyBinding("Ctrl-Meta-g", .selectAllOccurrences),
        KeyBinding("Mod-d", .selectNextOccurrence),
        KeyBinding("Mod-Alt-/", .toggleBlockComment),
        KeyBinding("Mod-Shift-d", .duplicate),
        KeyBinding("Ctrl-Shift-j", .joinLines),
        KeyBinding("Mod-Shift-u", .toggleCase),
        KeyBinding("Mod-Alt-]", .unfoldCode),
        KeyBinding("Mod-Alt-[", .foldCode),
        KeyBinding("Ctrl-Alt-]", .unfoldAll),
        KeyBinding("Ctrl-Alt-[", .foldAll),
        // defaultKeymap
        KeyBinding("Alt-ArrowUp", .moveLineUp),
        KeyBinding("Shift-Alt-ArrowUp", .copyLineUp),
        KeyBinding("Alt-ArrowDown", .moveLineDown),
        KeyBinding("Shift-Alt-ArrowDown", .copyLineDown),
        KeyBinding("Mod-Alt-ArrowUp", .addCursorAbove),
        KeyBinding("Mod-Alt-ArrowDown", .addCursorBelow),
        KeyBinding("Escape", .simplifySelection),
        KeyBinding("Mod-Enter", .insertBlankLine),
        KeyBinding("Ctrl-l", .selectLine),
        KeyBinding("Mod-[", .indentLess),
        KeyBinding("Mod-]", .indentMore),
        KeyBinding("Shift-Mod-k", .deleteLine),
        KeyBinding("Mod-/", .toggleComment),
        KeyBinding("Ctrl-A", .toggleBlockComment),
        // standardKeymap
        KeyBinding("ArrowLeft", .cursorCharLeft, shift: .selectCharLeft),
        KeyBinding("Alt-ArrowLeft", .cursorGroupLeft, shift: .selectGroupLeft),
        KeyBinding("Cmd-ArrowLeft", .cursorLineBoundaryLeft, shift: .selectLineBoundaryLeft),
        KeyBinding("ArrowRight", .cursorCharRight, shift: .selectCharRight),
        KeyBinding("Alt-ArrowRight", .cursorGroupRight, shift: .selectGroupRight),
        KeyBinding("Cmd-ArrowRight", .cursorLineBoundaryRight, shift: .selectLineBoundaryRight),
        KeyBinding("ArrowUp", .cursorLineUp, shift: .selectLineUp),
        KeyBinding("Cmd-ArrowUp", .cursorDocStart, shift: .selectDocStart),
        KeyBinding("Ctrl-ArrowUp", .cursorPageUp, shift: .selectPageUp),
        KeyBinding("ArrowDown", .cursorLineDown, shift: .selectLineDown),
        KeyBinding("Cmd-ArrowDown", .cursorDocEnd, shift: .selectDocEnd),
        KeyBinding("Ctrl-ArrowDown", .cursorPageDown, shift: .selectPageDown),
        KeyBinding("PageUp", .cursorPageUp, shift: .selectPageUp),
        KeyBinding("PageDown", .cursorPageDown, shift: .selectPageDown),
        KeyBinding("Home", .cursorLineBoundaryLeft, shift: .selectLineBoundaryLeft),
        KeyBinding("Mod-Home", .cursorDocStart, shift: .selectDocStart),
        KeyBinding("End", .cursorLineBoundaryRight, shift: .selectLineBoundaryRight),
        KeyBinding("Mod-End", .cursorDocEnd, shift: .selectDocEnd),
        KeyBinding("Enter", .insertNewlineAndIndent, shift: .insertNewlineAndIndent),
        KeyBinding("Mod-a", .selectAll),
        KeyBinding("Backspace", .deleteCharBackward, shift: .deleteCharBackward),
        KeyBinding("Delete", .deleteCharForward),
        KeyBinding("Alt-Backspace", .deleteGroupBackward),
        KeyBinding("Alt-Delete", .deleteGroupForward),
        KeyBinding("Mod-Backspace", .deleteLineBoundaryBackward),
        KeyBinding("Mod-Delete", .deleteLineBoundaryForward),
        // The Emacs-style keys macOS text fields have.
        KeyBinding("Ctrl-b", .cursorCharLeft, shift: .selectCharLeft),
        KeyBinding("Ctrl-f", .cursorCharRight, shift: .selectCharRight),
        KeyBinding("Ctrl-p", .cursorLineUp, shift: .selectLineUp),
        KeyBinding("Ctrl-n", .cursorLineDown, shift: .selectLineDown),
        KeyBinding("Ctrl-a", .cursorLineStart, shift: .selectLineStart),
        KeyBinding("Ctrl-e", .cursorLineEnd, shift: .selectLineEnd),
        KeyBinding("Ctrl-d", .deleteCharForward),
        KeyBinding("Ctrl-h", .deleteCharBackward),
        KeyBinding("Ctrl-k", .deleteToLineEnd),
        KeyBinding("Ctrl-Alt-h", .deleteGroupBackward),
        KeyBinding("Ctrl-o", .splitLine),
        KeyBinding("Ctrl-v", .cursorPageDown),
        // historyKeymap, then indentWithTab
        KeyBinding("Mod-z", .undo),
        KeyBinding("Mod-Shift-z", .redo),
        KeyBinding("Mod-y", .redo),
        KeyBinding("Mod-u", .undoSelection),
        KeyBinding("Tab", .indentMore, shift: .indentLess),
    ]

    /// The CodeMirror name of a key press: modifiers in the order Alt, Ctrl, Meta (Cmd), Shift, then the key.
    public static func name(key: String, command: Bool, option: Bool, control: Bool, shift: Bool) -> String {
        var parts: [String] = []
        if option {
            parts.append("Alt")
        }
        if control {
            parts.append("Ctrl")
        }
        if command {
            parts.append("Meta")
        }
        if shift {
            parts.append("Shift")
        }
        return (parts + [key]).joined(separator: "-")
    }

    /// A binding's key normalized like the press names: Mod and Cmd are Meta, modifiers sorted.
    static func normalized(_ key: String) -> String {
        var parts = key.split(separator: "-", omittingEmptySubsequences: false).map(String.init)
        var name = parts.removeLast()
        if name.isEmpty && !parts.isEmpty {
            parts.removeLast()
            name = "-"
        }
        let modifiers = Set(parts.map { ["Mod": "Meta", "Cmd": "Meta", "Control": "Ctrl"][$0] ?? $0 })
        var result = ["Alt", "Ctrl", "Meta", "Shift"].filter { modifiers.contains($0) }
        result.append(name.count == 1 ? name.lowercased() : name)
        if name.count == 1 && name != name.lowercased() && !result.contains("Shift") {
            result.insert("Shift", at: result.count - 1)
        }
        return result.joined(separator: "-")
    }

    static let table: [String: [KeyBinding]] = Dictionary(grouping: bindings) { normalized($0.key) }

    /// The actions for a press, in order (the next runs when one does nothing). `key` is CodeMirror's key name
    /// ("a", "ArrowLeft", "["), unshifted.
    public static func actions(key: String, command: Bool, option: Bool, control: Bool, shift: Bool) -> [EditorAction] {
        let keyName = key.count == 1 ? key.lowercased() : key
        var found: [EditorAction] = []
        let full = name(key: keyName, command: command, option: option, control: control, shift: shift)
        found += (table[full] ?? []).map(\.run)
        if shift {
            let plain = name(key: keyName, command: command, option: option, control: control, shift: false)
            found += (table[plain] ?? []).compactMap(\.shift)
        }
        return found
    }
}
