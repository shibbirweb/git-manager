// gm-measure smoke: a click on the blame gutter (`app action=blame_click`, the gutter's own handler). Line 1 of
// readme.md is from the first commit: the Log opens on that commit and readme.md, its diff centered on line 1, and
// the line's tooltip names the commit. The Log is hidden again afterwards. Option-click is left out: it would copy
// over the clipboard of whoever runs the smoke test.

import Foundation
import MeasureKit

extension Smoke {
    static func checkBlameClick(_ client: McpClient, repoPath: String, check: (String, Bool, String) -> Void)
        async throws {
        let head = try AppLauncher.run("/usr/bin/git", ["rev-parse", "HEAD"], in: repoPath).output
            .trimmingCharacters(in: .whitespacesAndNewlines)
        _ = try await client.call("app", ["action": "open_file", "filePath": "readme.md"])
        let clicked = try await client.call("app", ["action": "blame_click", "line": 1])
        let result = clicked.structured ?? [:]
        let opened = result["logShown"] as? Bool == true && result["selectedId"] as? String == head
            && result["selectedPath"] as? String == "readme.md" && result["revealLine"] as? Int == 1
        check("a blame click opens the commit in the Log on its line", opened, clicked.text)
        let tooltip = result["tooltip"] as? String ?? ""
        check("the blame gutter's tooltip names the commit",
              tooltip.hasPrefix("first\n\nSmoke Test <smoke@example.com>") && tooltip.contains("commit \(head)"),
              tooltip)
        _ = try await client.call("app", ["action": "show_log", "visible": false])
    }
}
