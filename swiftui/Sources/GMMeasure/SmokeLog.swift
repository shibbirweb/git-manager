// gm-measure smoke: the Log through `app action=show_log`, after the smoke commit, so the history holds "first" and
// "Smoke commit": the newest commit selected with its files and first file's diff, another commit selected by its
// position, and the Log hidden again.

import Foundation
import MeasureKit

extension Smoke {
    static func checkLog(_ client: McpClient, check: (String, Bool, String) -> Void) async throws {
        let shown = try await client.call("app", ["action": "show_log"])
        let state = shown.structured ?? [:]
        let files = (state["logFiles"] as? [String] ?? []).sorted()
        let opened = !shown.isError && state["logShown"] as? Bool == true && state["logCommits"] as? Int == 2
        check("show_log", opened && files == ["long.txt", "notes.txt", "readme.md"] && state["logDiff"] as? String
            == "long.txt", shown.isError ? shown.text : "\(state["logCommits"] ?? "nil") commits, \(files)")

        let first = try await client.call("app", ["action": "show_log", "position": 1])
        let firstState = first.structured ?? [:]
        let firstFiles = (firstState["logFiles"] as? [String] ?? []).sorted()
        check("show_log selects a commit", !first.isError && firstFiles == ["long.txt", "readme.md"]
            && firstState["logSelected"] as? String != state["logSelected"] as? String, "\(firstFiles)")

        let hidden = try await client.call("app", ["action": "show_log", "visible": false])
        check("show_log hides the Log", hidden.structured?["logShown"] as? Bool == false, hidden.text)
    }
}
