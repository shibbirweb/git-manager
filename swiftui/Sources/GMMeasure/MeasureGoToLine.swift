// gm-measure --screen gotoline: Measure.shownFile open in both apps, then Cmd+L (posted to the app, as typed): the
// Go to Line prompt with the cursor's "1:1" selected. gotolineerror: "12:" typed over it, so the field shows the
// validation message and Go is off.

import Foundation
import MeasureKit

extension Measure {
    static let promptScreens = ["gotoline", "gotolineerror"]

    static func showGoToLine(_ app: RunningApp, screen: String) async throws {
        try await openFile(app)
        try await Task.sleep(nanoseconds: 1_000_000_000)
        WindowCapture.bringToFront(pid: app.pid)
        // L with Cmd.
        KeyPoster.press(pid: app.pid, keyCode: 37, flags: .maskCommand)
        try await Task.sleep(nanoseconds: 1_000_000_000)
        if app.kind == .native {
            let state = try await app.client.call("app", ["action": "get_state"]).structured ?? [:]
            let window = state["window"] as? [String: Any]
            print("native: the keyboard is in \(window?["firstResponder"] ?? "nothing")")
        }
        if screen == "gotolineerror" {
            KeyPoster.type(pid: app.pid, "12:")
            try await Task.sleep(nanoseconds: 500_000_000)
        }
    }
}

// gm-measure --screen findbar: Measure.shownFile open, Cmd+F, "product" typed: the find bar with its counter and
// the matches tinted. replacebar: the same with Cmd+R, so the Replace row shows too. Parity runs (findScreen) type
// their own query on the file they opened.
extension Measure {
    static let findScreens = ["findbar", "replacebar"]

    static func showFindBar(_ app: RunningApp, screen: String, query: String = "product", opens: Bool = true)
        async throws {
        if opens {
            try await openFile(app)
        }
        try await Task.sleep(nanoseconds: 1_000_000_000)
        WindowCapture.bringToFront(pid: app.pid)
        // F (find) or R (replace) with Cmd.
        KeyPoster.press(pid: app.pid, keyCode: screen == "replacebar" ? 15 : 3, flags: .maskCommand)
        try await Task.sleep(nanoseconds: 800_000_000)
        KeyPoster.type(pid: app.pid, query)
        try await Task.sleep(nanoseconds: 800_000_000)
    }
}
