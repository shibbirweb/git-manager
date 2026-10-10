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
        // Go to Line opens its prompt (answered with `app action=dialog`).
        if args["command"] as? String == "code.goToLine" {
            onMain {
                let editor = WindowContext.focused.editor
                Task { await editor.goToLine() }
            }
            return reply(ok: true, structured: onMain { ["dialog": dialogState()] })
        }
        if let name = args["command"] as? String, findCommands.contains(name) {
            onMain {
                runFind(name, WindowContext.focused.editor)
            }
            return reply(ok: true, structured: onMain { ["editor": editorState()] })
        }
        guard let name = args["command"] as? String, let action = editorCommands[name] else {
            let names = (Array(editorCommands.keys) + Array(findCommands)).sorted()
            return reply(ok: false, text: "command is one of: \(names.joined(separator: ", "))")
        }
        let ran = onMain { () -> Bool? in
            WindowContext.focused.editor.session?.run(action)
        }
        guard let ran else {
            return reply(ok: false, text: "No file is shown")
        }
        return reply(ok: true, structured: onMain { ["ran": ran, "editor": editorState()] })
    }

    /// Puts the shown file's cursor at a 1-based line and column, as the current app's open_file does.
    @MainActor
    static func placeCursor(line: Int, column: Int) {
        guard let session = WindowContext.focused.editor.session else {
            return
        }
        let doc = session.state.doc
        let target = doc.line(max(0, line - 1))
        let position = min(target.from + max(0, column - 1), target.to)
        session.dispatch(TransactionSpec(selection: .single(position), userEvent: "select", scrollIntoView: true))
    }
}

// The find bar's commands and fields (the page's Find, Replace, Find Next and Find Previous, and Escape).
extension Control {
    static let findCommands: Set<String> = [
        "edit.find", "edit.replace", "edit.findNext", "edit.findPrevious", "edit.closeFind",
    ]

    @MainActor
    static func runFind(_ name: String, _ editor: EditorModel) {
        switch name {
        case "edit.find":
            editor.openFind(replace: false)
        case "edit.replace":
            editor.openFind(replace: true)
        case "edit.findNext":
            editor.findNext()
        case "edit.findPrevious":
            editor.findNext(forward: false)
        default:
            editor.closeFind()
        }
    }

    /// `app action=find`: types `search` and `replace` into the open find bar, then runs Replace (`replaceNext`) or
    /// Replace All (`replaceAll`) when asked.
    static func find(_ args: [String: Any]) -> String {
        let shown = onMain { () -> Bool in
            let editor = WindowContext.focused.editor
            guard editor.session?.find.open == true else {
                return false
            }
            if let search = args["search"] as? String {
                editor.setFindSearch(search)
            }
            if let replace = args["replace"] as? String {
                editor.setFindReplace(replace)
            }
            if args["replaceNext"] as? Bool == true {
                editor.replaceOne()
            }
            if args["replaceAll"] as? Bool == true {
                editor.replaceAll()
            }
            return true
        }
        guard shown else {
            return reply(ok: false, text: "The find bar is not open (editor_command edit.find)")
        }
        return reply(ok: true, structured: onMain { ["editor": editorState()] })
    }
}
