// Completion's keys, ahead of the editor's own as the page's Prec.highest keymaps are (features.ts): Ctrl+Space asks,
// Escape closes, Up and Down move by one (wrapping), Page Up and Page Down by the popup's height, Enter and Tab pick.
// Then the snippet's keys: Tab and Shift+Tab move between its fields, Escape lets go. A key that does nothing here
// goes on to the editor.

import Foundation
import NativeCore

extension EditorCompletion {
    /// The popup's height in rows, for Page Up and Page Down (its view sets it).
    static var pageRows = 4

    /// Runs the key's completion or snippet command; false when the key is not for them.
    func handleKey(_ key: String, command: Bool, option: Bool, control: Bool, shift: Bool) -> Bool {
        if command || option {
            return false
        }
        if control {
            if key == " " && !shift && enabled {
                send([.start(explicit: true)])
                return true
            }
            return false
        }
        if !shift && enabled && completionKey(key) {
            return true
        }
        return snippetKey(key, shift: shift)
    }

    private func completionKey(_ key: String) -> Bool {
        let now = Self.now()
        switch key {
        case "Escape":
            guard state.isActive else {
                return false
            }
            send([.close])
        case "ArrowDown", "ArrowUp", "PageDown", "PageUp":
            let page = key.hasPrefix("Page") ? Self.pageRows : nil
            guard let index = CompletionCommands.move(state, forward: key == "ArrowDown" || key == "PageDown",
                                                      pageRows: page, now: now) else {
                return false
            }
            send([.setSelected(index)])
        case "Enter", "Tab":
            guard let option = CompletionCommands.acceptable(state, now: now) else {
                return false
            }
            pick(option)
        default:
            return false
        }
        return true
    }

    private func snippetKey(_ key: String, shift: Bool) -> Bool {
        guard let session, let current = snippet else {
            return false
        }
        if key == "Escape" && !shift {
            setSnippet(nil)
            session.repaint()
            return true
        }
        guard key == "Tab", let moved = current.move(shift ? -1 : 1) else {
            return false
        }
        startingSnippet = .some(moved.snippet)
        session.scrollRequests += 1
        session.dispatch(TransactionSpec(selection: moved.selection, scrollIntoView: true))
        return true
    }

    /// A click at `position`: inside another snippet field it selects that field (snippetPointerHandler).
    func click(at position: Int) -> Bool {
        guard let session, let moved = snippet?.click(at: position) else {
            return false
        }
        startingSnippet = .some(moved.snippet)
        session.scrollRequests += 1
        session.dispatch(TransactionSpec(selection: moved.selection, scrollIntoView: true))
        return true
    }
}
