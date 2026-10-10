// gm-measure --screen newwindow: both apps open the docs demo's acme folder, then New Window (the current app's
// run_menu_command file.newWindow, the native app's `app new_window`): the new window, down and right of the first,
// shows the welcome screen. The capture follows that window (WindowCapture.pinned), not the first.

import Foundation
import MeasureKit

extension Measure {
    static let windowScreens = ["newwindow"]

    /// Opens a new window in `app` and pins the capture to it.
    static func openNewWindow(_ app: RunningApp) async throws {
        try await Task.sleep(nanoseconds: 1_000_000_000)
        let before = Set(WindowCapture.windowIDs(pid: app.pid))
        WindowCapture.bringToFront(pid: app.pid)
        let opened = app.kind == .current
            ? try await app.client.call("run_menu_command", ["action": "file.newWindow"])
            : try await app.client.call("app", ["action": "new_window"])
        if opened.isError {
            throw ToolError("\(app.kind.rawValue): no new window: \(opened.text)")
        }
        for _ in 0..<50 {
            if let added = WindowCapture.windowIDs(pid: app.pid).first(where: { !before.contains($0) }) {
                WindowCapture.pinned[app.pid] = added
                try await Task.sleep(nanoseconds: 1_500_000_000)
                return
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw ToolError("\(app.kind.rawValue): the new window did not appear")
    }
}
