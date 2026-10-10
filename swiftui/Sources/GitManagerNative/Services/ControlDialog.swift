// The control server's `dialog` action: the open prompt (DialogCenter) answered as typed, `value` then Go
// (`cancel` true to cancel instead), or just described when neither is given. It answers with the prompt's title,
// text and validation message, and the editor's state after.

import Foundation

extension Control {
    static func dialog(_ args: [String: Any]) -> String {
        for _ in 0..<20 where onMain({ WindowContext.focused.dialogs.prompt == nil }) {
            Thread.sleep(forTimeInterval: 0.05)
        }
        let before = onMain { dialogState() }
        guard onMain({ WindowContext.focused.dialogs.prompt != nil }) else {
            return reply(ok: false, text: "No dialog is open")
        }
        onMain {
            let dialogs = WindowContext.focused.dialogs
            if args["cancel"] as? Bool == true {
                dialogs.cancel()
            } else if let value = args["value"] as? String {
                dialogs.value = value
                dialogs.submit()
            }
        }
        // The answer's work (Go to Line moving the cursor) runs on the next turns of the main loop.
        Thread.sleep(forTimeInterval: 0.2)
        return reply(ok: true, structured: onMain { ["dialog": before, "editor": editorState()] })
    }

    @MainActor
    static func dialogState() -> Any {
        let dialogs = WindowContext.focused.dialogs
        guard let prompt = dialogs.prompt else {
            return NSNull()
        }
        return ["title": prompt.title, "label": orNull(prompt.label), "value": dialogs.value,
                "error": orNull(dialogs.validationError)]
    }
}
