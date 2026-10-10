// The find bar's keys while one of its fields has the keyboard (findPanel.svelte.ts keydown): Escape closes it,
// Option+C / W / X toggle Match Case, Words and Regex (by key code: Option types other characters), Return finds the
// next match (Replace in the Replace field), Shift+Return the previous one, Option+Return selects every match,
// Cmd+Shift+Return in the Replace field replaces all, and Tab moves between the fields. Only this window's events.

import AppKit
import NativeCore

@MainActor
final class FindBarKeys {
    static let findField = "find-bar-find"
    static let replaceField = "find-bar-replace"

    private var monitor: Any?

    func start(window: NSWindow?, find: FindState, editor: EditorModel) {
        stop()
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak find, weak editor] event in
            guard let find, let editor else {
                return event
            }
            let used = MainActor.assumeIsolated { () -> Bool in
                guard event.window === editor.context.window, let field = Self.focusedField(event.window) else {
                    return false
                }
                return Self.handle(event, field: field, find: find, editor: editor)
            }
            return used ? nil : event
        }
    }

    func stop() {
        if let monitor {
            NSEvent.removeMonitor(monitor)
        }
        monitor = nil
    }

    /// Which of the bar's fields has the keyboard, if any.
    private static func focusedField(_ window: NSWindow?) -> FindState.Field? {
        let field = (window?.firstResponder as? NSTextView)?.delegate as? NSTextField
        switch field?.identifier?.rawValue {
        case findField:
            return .find
        case replaceField:
            return .replace
        default:
            return nil
        }
    }

    private static func handle(
        _ event: NSEvent, field: FindState.Field, find: FindState, editor: EditorModel
    ) -> Bool {
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        let mod = flags.contains(.command) || flags.contains(.control)
        let alt = flags.contains(.option), shift = flags.contains(.shift)
        let options: [UInt16: WritableKeyPath<FindOptions, Bool>] = [8: \.matchCase, 13: \.wholeWords, 7: \.regex]
        if alt && !mod && !shift, let option = options[event.keyCode] {
            editor.toggleFind(option)
            return true
        }
        switch event.keyCode {
        case 53:
            editor.closeFind()
            return true
        case 36, 76:
            if field == .find && alt && !mod {
                editor.selectAllMatches()
            } else if field == .replace && mod && shift {
                editor.replaceAll()
            } else if !mod && !alt {
                if shift {
                    editor.findNext(forward: false)
                } else if field == .replace {
                    editor.replaceOne()
                } else {
                    editor.findNext()
                }
            } else {
                return false
            }
            return true
        case 48 where !mod && !alt && find.replaceOpen:
            find.focus(field == .find ? .replace : .find, select: true)
            return true
        default:
            return false
        }
    }
}
