// The control server's windows (the current app's list_workspace windows and run_menu_command file.newWindow):
//   new_window      folderPaths?, workspaceFile?: New Window (none), or those in a new window; a window showing
//                   them already comes to the front instead
//   list_windows    every window: its number, folders, workspace file, content size and whether it is focused

import AppKit
import Foundation

extension Control {
    static func windowsAnswer(_ action: String, _ args: [String: Any]) -> String? {
        switch action {
        case "new_window":
            let folderPaths = args["folderPaths"] as? [String] ?? []
            let workspaceFile = args["workspaceFile"] as? String
            onMain {
                WindowOpener.openNew(folders: folderPaths, workspaceFile: workspaceFile, from: WindowContext.focused)
            }
            return reply(ok: true, structured: onMain { ["windows": windowList()] })
        case "list_windows":
            return reply(ok: true, structured: onMain { ["windows": windowList()] })
        default:
            return nil
        }
    }

    @MainActor
    private static func windowList() -> [[String: Any]] {
        let focused = WindowContext.focused
        return WindowContext.all.map { context in
            [
                "windowNumber": context.window?.windowNumber ?? 0,
                "folders": context.workspace.folders.map(\.root),
                "workspaceFile": orNull(context.workspace.file),
                "focused": context === focused,
                "contentWidth": context.window.map { $0.contentRect(forFrameRect: $0.frame).width } ?? 0,
                "contentHeight": context.window.map { $0.contentRect(forFrameRect: $0.frame).height } ?? 0,
            ]
        }
    }
}
