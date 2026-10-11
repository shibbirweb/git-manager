// The control server's code completion and column drag: `app action=complete` types `type` into the shown file
// as keys do (so completion follows), then presses `key` (Ctrl-Space, Escape, ArrowDown, ArrowUp, PageDown, PageUp,
// Enter, Tab or Shift-Tab) as the editor's keyboard does, waits `waitMs` for the sources, and answers the editor's
// state with the popup's (completionState). `app action=column_drag` runs an Option+drag between two places.

import Foundation
import NativeCore

extension Control {
    static func complete(_ args: [String: Any]) -> String {
        let shown = onMain { () -> Bool in
            guard let session = WindowContext.focused.editor.session else {
                return false
            }
            if let text = args["type"] as? String {
                for character in text {
                    session.dispatch(EditorInput.type(session.state, String(character), style: session.style))
                }
            }
            return true
        }
        guard shown else {
            return reply(ok: false, text: "No file is shown")
        }
        var handled: Bool?
        if let key = args["key"] as? String {
            // Keys wait out the popup's first 75 ms, as a person's would.
            Thread.sleep(forTimeInterval: 0.1)
            handled = onMain { () -> Bool in
                guard let completion = WindowContext.focused.editor.session?.completion else {
                    return false
                }
                let control = key.hasPrefix("Ctrl-"), shift = key.hasPrefix("Shift-")
                let name = key.replacingOccurrences(of: "Ctrl-", with: "").replacingOccurrences(of: "Shift-", with: "")
                return completion.handleKey(name == "Space" ? " " : name, command: false, option: false,
                                            control: control, shift: shift)
            }
        }
        let wait = args["waitMs"] as? Int ?? 300
        Thread.sleep(forTimeInterval: Double(wait) / 1000)
        var structured: [String: Any] = onMain { ["editor": editorState()] }
        if let handled {
            structured["handled"] = handled
        }
        return reply(ok: true, structured: structured)
    }

    /// `app action=column_drag`: an Option+drag in the shown file from `fromLine`:`fromColumn` to
    /// `toLine`:`toColumn` (1-based lines, 0-based visual columns), with Cmd when `adding`.
    static func columnDrag(_ args: [String: Any]) -> String {
        let number = { (key: String) in args[key] as? Int ?? 0 }
        let (done, ms) = onMain { () -> (Bool, Double) in
            let started = Date()
            let done = WindowContext.focused.editor.session?.columnDragHook(
                (number("fromLine"), number("fromColumn")), (number("toLine"), number("toColumn")),
                args["adding"] as? Bool ?? false
            ) ?? false
            return (done, Date().timeIntervalSince(started) * 1000)
        }
        guard done else {
            return reply(ok: false, text: "No file is shown, or column selection is off")
        }
        let ranges = onMain { () -> [[Int]] in
            WindowContext.focused.editor.session?.state.selection.ranges.map { [$0.anchor, $0.head] } ?? []
        }
        // The press and the drag's step, the selection made and painted: how long the main thread took.
        return reply(ok: true, structured: ["ranges": ranges, "ms": ms, "editor": onMain { editorState() }])
    }

    /// The popup's options (the first 30 labels and types), the selected one, and the snippet's fields.
    @MainActor
    static func completionState(_ completion: EditorCompletion) -> [String: Any] {
        let open = completion.state.open
        let options = open?.options.prefix(30) ?? []
        return [
            "open": open != nil,
            "options": options.map(\.completion.label),
            "types": options.map { orNull($0.completion.type) },
            "selected": open?.selected ?? -1,
            "snippetFields": orNull(completion.snippet.map { snippet in
                snippet.ranges.map { ["field": $0.field, "from": $0.from, "to": $0.to] }
            }),
        ]
    }
}
