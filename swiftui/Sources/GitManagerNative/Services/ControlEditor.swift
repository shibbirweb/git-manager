// The control server's `open_file` action: opens a file of the open folder in a tab, as a double click in the Files
// panel does (kept open, not the preview tab), and answers once its text is on screen. `filePath` is relative to
// the folder or absolute; `preview` true opens it in the preview tab instead.

import Foundation

extension Control {
    static func openFile(_ args: [String: Any]) -> String {
        guard let filePath = args["filePath"] as? String, !filePath.isEmpty else {
            return reply(ok: false, text: "filePath is required")
        }
        let preview = args["preview"] as? Bool ?? false
        let absolute = onMain { () -> String? in
            guard let repoPath = AppModel.shared.repoPath else {
                return nil
            }
            return filePath.hasPrefix("/") ? filePath : (repoPath as NSString).appendingPathComponent(filePath)
        }
        guard let absolute else {
            return reply(ok: false, text: "No folder is open")
        }
        let semaphore = DispatchSemaphore(value: 0)
        Task { @MainActor in
            await EditorModel.shared.open(absolute, pin: !preview)
            semaphore.signal()
        }
        semaphore.wait()
        let (shown, message) = onMain { (EditorModel.shared.file?.path == absolute, EditorModel.shared.message) }
        guard shown else {
            return reply(ok: false, text: message ?? "Could not open \(filePath)", structured: onMain { state() })
        }
        return reply(ok: true, structured: onMain { state() })
    }

    /// The tabs, the active one, and the shown file's cursor and line count.
    @MainActor
    static func editorState() -> [String: Any] {
        let editor = EditorModel.shared
        var result: [String: Any] = [
            "tabs": editor.tabs.tabs.map { ["path": $0.path, "preview": $0.preview] },
            "activeTab": orNull(editor.tabs.active),
            "diffActive": editor.diffActive,
        ]
        if let file = editor.file {
            result["file"] = [
                "path": file.path,
                "relativePath": file.relativePath,
                "lineCount": file.lines.count,
                "cursor": ["line": editor.cursor.line + 1, "column": editor.cursor.column + 1],
                "language": file.language,
                "highlighted": file.spans != nil,
                "blame": orNull(editor.blameLabel),
            ]
        }
        return result
    }
}
