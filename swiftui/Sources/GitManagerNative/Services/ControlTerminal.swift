// The terminal's control tools, named and shaped like the current app's MCP tools (src/lib/mcp/toolDefs.ts and
// handlers.ts): `show_panel` (panel terminal, visible), `list_terminals`, `new_terminal` and `send_terminal_text`,
// plus `terminal_text`, native only, which returns the screen's lines so a test can wait for output.

import AppKit
import Foundation

enum ControlTerminal {
    /// The answer for a terminal action, or nil when `action` is not one.
    static func answer(_ action: String, _ args: [String: Any]) -> String? {
        switch action {
        case "show_panel":
            guard args["panel"] as? String == "terminal" else {
                return Control.reply(ok: false, text: "Only the terminal panel is built in the native app")
            }
            let visible = args["visible"] as? Bool ?? true
            Control.onMain {
                if visible {
                    WindowContext.focused.terminal.show()
                } else {
                    WindowContext.focused.terminal.hide()
                }
            }
            return waitForShell(visible: visible)
        case "list_terminals":
            return Control.reply(ok: true, structured: Control.onMain { list() })
        case "new_terminal":
            Control.onMain {
                WindowContext.focused.terminal.show()
                WindowContext.focused.terminal.create()
            }
            return waitForShell(visible: true)
        case "send_terminal_text":
            return send(args)
        case "terminal_text":
            return Control.reply(ok: true, structured: Control.onMain { screen() })
        default:
            return nil
        }
    }

    /// Answers once the shell has started (its info is known), as the current app's tools wait for a terminal id.
    private static func waitForShell(visible: Bool) -> String {
        let deadline = Date().addingTimeInterval(5)
        while visible && Date() < deadline {
            let started = Control.onMain { () -> Bool in
                let session = WindowContext.focused.terminal.session
                return session?.info != nil || session?.failure != nil
            }
            if started {
                break
            }
            Thread.sleep(forTimeInterval: 0.05)
        }
        return Control.reply(ok: true, structured: Control.onMain { list() })
    }

    private static func send(_ args: [String: Any]) -> String {
        guard let text = args["text"] as? String else {
            return Control.reply(ok: false, text: "\"text\" is required")
        }
        let pressEnter = args["pressEnter"] as? Bool ?? true
        let sent = Control.onMain { () -> Bool in
            guard let session = WindowContext.focused.terminal.session, !session.exited else {
                return false
            }
            if let key = args["terminalKey"] as? Int, key != session.key {
                return false
            }
            session.write(pressEnter ? text + "\r" : text)
            return true
        }
        guard sent else {
            return Control.reply(ok: false, text: "No terminal has that key; list_terminals lists them")
        }
        return Control.reply(ok: true, structured: ["sent": text.count, "pressedEnter": pressEnter])
    }

    @MainActor
    static func list() -> [String: Any] {
        let store = WindowContext.focused.terminal
        var terminals: [[String: Any]] = []
        if let session = store.session {
            terminals.append([
                "key": session.key,
                "name": session.name,
                "kind": "terminal",
                "location": "panel",
                "folder": Control.orNull(session.info?.cwd),
                "started": session.info != nil,
                "running": session.info != nil && !session.exited,
                "exitCode": Control.orNull(session.exitCode.map { Int($0) }),
                "failure": Control.orNull(session.failure),
            ])
        }
        return [
            "terminals": terminals,
            "panelTerminal": Control.orNull(store.session?.key),
            "bottomPanel": ["open": store.panelOpen, "tab": "terminal"],
        ]
    }

    @MainActor
    private static func screen() -> [String: Any] {
        guard let session = WindowContext.focused.terminal.session else {
            return ["lines": [String](), "receivedBytes": 0]
        }
        let term = session.term
        return [
            "lines": term.screenText(),
            "columns": term.columns,
            "rows": term.rows,
            "scrollbackLines": term.maxViewOffset,
            "receivedBytes": session.receivedBytes,
        ]
    }
}

/// Ctrl+` shows or hides the panel, inside a terminal too (a key monitor: a hidden shortcut button kept a window
/// snapshot in memory, see GM-44).
enum TerminalShortcut {
    @MainActor
    static func install() {
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            // keyCode 50 is the backquote key.
            if event.keyCode == 50 && flags == .control {
                guard let terminal = WindowContext.of(event.window)?.terminal else {
                    return event
                }
                terminal.toggle()
                return nil
            }
            return event
        }
    }
}
