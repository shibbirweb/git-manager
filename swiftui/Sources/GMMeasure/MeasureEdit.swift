// gm-measure measure --screen edit|fold: Measure.shownFile after the same editor commands in both apps, the current
// app's Code and Edit menu commands (run_menu_command) and the native app's `app action=editor_command` with the
// same ids. It cannot be typed into from outside, so the commands change the text and the selections:
// - edit: the cursor on "id" (line 2), the line moved down, duplicated and commented, then the next two
//   occurrences of the word selected (three cursors).
// - fold: the products array (line 10) folded.

import Foundation
import MeasureKit

extension Measure {
    static let editScreens = ["edit", "fold"]

    static func editSteps(_ screen: String) -> (line: Int, column: Int, commands: [String]) {
        if screen == "fold" {
            return (10, 1, ["code.collapse"])
        }
        return (2, 3, [
            "code.moveLineDown", "code.duplicate", "code.lineComment", "code.selectNextOccurrence",
            "code.selectNextOccurrence",
        ])
    }

    static func showEditScreen(_ app: RunningApp, screen: String) async throws {
        let steps = editSteps(screen)
        if app.kind == .native {
            let opened = try await app.client.call(
                "app", ["action": "open_file", "filePath": shownFile, "line": steps.line, "column": steps.column]
            )
            if opened.isError {
                throw ToolError("native: could not open \(shownFile): \(opened.text)")
            }
            for command in steps.commands {
                let ran = try await app.client.call("app", ["action": "editor_command", "command": command])
                if ran.isError {
                    throw ToolError("native: \(command): \(ran.text)")
                }
            }
            return
        }
        try await openFile(app)
        let state = try await app.client.call("get_app_state").structured ?? [:]
        let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
        let placed = try await app.client.call("open_file", [
            "filePath": (repoRoot as NSString).appendingPathComponent(shownFile), "line": steps.line,
            "column": steps.column,
        ])
        if placed.isError {
            throw ToolError("current: could not place the cursor: \(placed.text)")
        }
        for command in steps.commands {
            let ran = try await app.client.call("run_menu_command", ["action": command])
            if ran.isError {
                throw ToolError("current: \(command): \(ran.text)")
            }
        }
    }
}
