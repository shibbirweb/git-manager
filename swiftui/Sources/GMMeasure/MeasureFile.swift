// gm-measure measure --screen file (and parity's openFile): opens a file of the demo in an editor tab in both apps,
// the current app with its own open_file tool, the native app with `app action=open_file`, and checks that each one
// shows it before anything is compared.

import Foundation
import MeasureKit

extension Measure {
    /// A file of demo/acme/storefront for the file screen: unchanged since the last commit, so neither app marks
    /// changed lines in its gutter.
    static let shownFile = "src/catalog.ts"

    /// Opens `filePath` (relative to the repository) in an editor tab. The current app knows the repository by its
    /// real path (/private/var/..., not /var/...), so the absolute path comes from its own state.
    static func openFile(_ app: RunningApp, filePath: String = shownFile) async throws {
        if app.kind == .native {
            let opened = try await app.client.call("app", ["action": "open_file", "filePath": filePath])
            if opened.isError {
                throw ToolError("native: could not open \(filePath): \(opened.text)")
            }
            return
        }
        let state = try await app.client.call("get_app_state").structured ?? [:]
        let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
        let absolute = (repoRoot as NSString).appendingPathComponent(filePath)
        let opened = try await app.client.call("open_file", ["filePath": absolute])
        if opened.isError {
            throw ToolError("current: could not open \(filePath): \(opened.text)")
        }
        // The editor fills in after the tab shows: wait for its lines.
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline {
            let found = try await app.client.call("inspect_elements", ["selector": ".cm-editor .cm-line", "limit": 1])
            if ((found.structured ?? [:])["count"] as? Int ?? 0) > 0 {
                return
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        throw ToolError("current: \(filePath) did not show in an editor within 10 s")
    }
}
