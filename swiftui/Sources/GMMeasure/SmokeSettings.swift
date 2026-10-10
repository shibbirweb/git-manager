// gm-measure smoke: open_settings and close_dialog, as the current app's tools of those names behave, and the
// Settings rows' scroll (taller than the dialog on Appearance, so the scrollbar shows).

import Foundation
import MeasureKit

extension Smoke {
    static func checkSettings(_ client: McpClient, check: (String, Bool, String) -> Void) async throws {
        let opened = try await client.call("open_settings")
        try await Task.sleep(nanoseconds: 500_000_000)
        var state = try await client.call("app", ["action": "get_state"]).structured ?? [:]
        let scroll = state["settingsScroll"] as? [Double] ?? []
        let dialog = state["dialog"] as? [String: Any]
        check("open_settings", !opened.isError && dialog?["section"] as? String == "appearance",
              opened.isError ? opened.text : "\(dialog ?? [:])")
        check("Settings rows scroll", scroll.count == 3 && scroll[1] > scroll[2], "\(scroll)")
        let editor = try await client.call("open_settings", ["section": "editor"])
        state = try await client.call("app", ["action": "get_state"]).structured ?? [:]
        let section = (state["dialog"] as? [String: Any])?["section"] as? String
        check("open_settings on a section", !editor.isError && section == "editor", "\(section ?? "nil")")
        let wrong = try await client.call("open_settings", ["section": "colors"])
        check("open_settings with an unknown section is refused", wrong.isError, wrong.text)
        let closed = try await client.call("close_dialog")
        check("close_dialog", !closed.isError && closed.structured?["dialog"] is NSNull, closed.text)
    }
}
