// The control server's `blame_click` action: what a click on the blame gutter does (EditorModel.blameClicked) on
// 1-based `line` of the open file, `copyHash` true for an Option-click. It waits for the blame first, then answers
// with what the Log shows: whether it is open, the selected commit and file, and the diff line it centered.

import Foundation

extension Control {
    static func blameClick(_ args: [String: Any]) -> String {
        guard let line = args["line"] as? Int, line >= 1 else {
            return reply(ok: false, text: "line (1-based) is required")
        }
        for _ in 0..<50 where onMain({ WindowContext.focused.editor.session?.blame == nil }) {
            Thread.sleep(forTimeInterval: 0.1)
        }
        guard onMain({ WindowContext.focused.editor.session?.blame != nil }) else {
            return reply(ok: false, text: "The open file has no blame")
        }
        let copyHash = args["copyHash"] as? Bool ?? false
        let semaphore = DispatchSemaphore(value: 0)
        Task { @MainActor in
            await WindowContext.focused.editor.blameClicked(line: line - 1, copyHash: copyHash)
            semaphore.signal()
        }
        semaphore.wait()
        let structured = onMain { () -> [String: Any] in
            let log = WindowContext.focused.log
            return [
                "logShown": log.shown,
                "selectedId": orNull(log.selectedId),
                "selectedPath": orNull(log.selectedPath),
                "revealLine": orNull(log.diff?.reveal.map { $0.line + 1 }),
                "tooltip": orNull(WindowContext.focused.editor.blameTooltip(line: line - 1)),
            ]
        }
        return reply(ok: true, structured: structured)
    }
}
