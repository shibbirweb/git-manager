// The control server's editing actions, so gm-measure drives both editors the same way: `open_file` puts the
// cursor at `line` and `column` (1-based, as the current app's open_file does), and `editor_command` runs one of the
// current app's Code and Edit menu commands (`command`, such as code.moveLineDown) on the shown file.

import Foundation
import NativeCore

extension Control {
    /// The current app's menu ids for the editor's commands.
    static let editorCommands: [String: EditorAction] = [
        "code.moveLineUp": .moveLineUp, "code.moveLineDown": .moveLineDown, "code.duplicate": .duplicate,
        "code.deleteLine": .deleteLine, "code.joinLines": .joinLines, "code.sortLines": .sortLines,
        "code.toggleCase": .toggleCase, "code.indent": .indentMore, "code.unindent": .indentLess,
        "code.lineComment": .toggleComment, "code.blockComment": .toggleBlockComment,
        "code.selectNextOccurrence": .selectNextOccurrence, "edit.selectAllOccurrences": .selectAllOccurrences,
        "code.collapse": .foldCode, "code.expand": .unfoldCode, "code.collapseAll": .foldAll,
        "code.expandAll": .unfoldAll, "edit.selectAll": .selectAll, "edit.undo": .undo, "edit.redo": .redo,
    ]

    static func editorCommand(_ args: [String: Any]) -> String {
        guard let name = args["command"] as? String, let action = editorCommands[name] else {
            return reply(ok: false, text: "command is one of: \(editorCommands.keys.sorted().joined(separator: ", "))")
        }
        let ran = onMain { () -> Bool? in
            EditorModel.shared.session?.run(action)
        }
        guard let ran else {
            return reply(ok: false, text: "No file is shown")
        }
        return reply(ok: true, structured: onMain { ["ran": ran, "editor": editorState()] })
    }

    /// Puts the shown file's cursor at a 1-based line and column, as the current app's open_file does.
    @MainActor
    static func placeCursor(line: Int, column: Int) {
        guard let session = EditorModel.shared.session else {
            return
        }
        let doc = session.state.doc
        let target = doc.line(max(0, line - 1))
        let position = min(target.from + max(0, column - 1), target.to)
        session.dispatch(TransactionSpec(selection: .single(position), userEvent: "select", scrollIntoView: true))
    }
}
