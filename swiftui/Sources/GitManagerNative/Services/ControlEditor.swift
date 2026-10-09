// The control server's `open_file` action: opens a file of the open folder in a tab, as a double click in the Files
// panel does (kept open, not the preview tab), and answers once its text is on screen. `filePath` is relative to
// the folder or absolute; `preview` true opens it in the preview tab instead; `line` and `column` place the cursor.

import Foundation

extension Control {
    static func openFile(_ args: [String: Any]) -> String {
        guard let filePath = args["filePath"] as? String, !filePath.isEmpty else {
            return reply(ok: false, text: "filePath is required")
        }
        let preview = args["preview"] as? Bool ?? false
        let absolute = onMain { () -> String? in
            guard let repoPath = WindowContext.focused.app.repoPath else {
                return nil
            }
            return filePath.hasPrefix("/") ? filePath : (repoPath as NSString).appendingPathComponent(filePath)
        }
        guard let absolute else {
            return reply(ok: false, text: "No folder is open")
        }
        let semaphore = DispatchSemaphore(value: 0)
        Task { @MainActor in
            await WindowContext.focused.editor.open(absolute, pin: !preview)
            semaphore.signal()
        }
        semaphore.wait()
        let (shown, message) = onMain {
            let editor = WindowContext.focused.editor
            return (editor.file?.path == absolute, editor.message)
        }
        guard shown else {
            return reply(ok: false, text: message ?? "Could not open \(filePath)", structured: onMain { state() })
        }
        if let line = args["line"] as? Int {
            onMain {
                placeCursor(line: line, column: args["column"] as? Int ?? 1)
            }
        }
        return reply(ok: true, structured: onMain { state() })
    }

    /// The tabs, the active one, and the shown file's cursor and line count.
    @MainActor
    static func editorState() -> [String: Any] {
        let editor = WindowContext.focused.editor
        var result: [String: Any] = [
            "tabs": editor.tabs.tabs.map { ["path": $0.path, "preview": $0.preview] },
            "activeTab": orNull(editor.tabs.active),
            "diffActive": editor.diffActive,
        ]
        if let file = editor.file, let session = editor.session {
            let head = session.state.selection.main.head
            let line = session.state.doc.lineAt(head)
            result["file"] = [
                "path": file.path,
                "relativePath": file.relativePath,
                "lineCount": session.state.doc.lineCount,
                "cursor": ["line": line.index + 1, "column": head - line.from + 1],
                "language": file.language,
                "highlighted": session.colors != nil,
                "blame": orNull(editor.blameLabel),
                "dirty": session.dirty,
            ]
        }
        return result
    }
}
