// gm-measure smoke, the file tabs: `app action=open_file` opens a kept tab with the file's lines, language, cursor
// and blame note; a preview open adds a second tab; a missing file is refused.

import Foundation
import MeasureKit

extension Smoke {
    static func checkFiles(_ client: McpClient, check: (String, Bool, String) -> Void) async throws {
        let opened = try await client.call("app", ["action": "open_file", "filePath": "long.txt"])
        let editor = opened.structured?["editor"] as? [String: Any] ?? [:]
        let file = editor["file"] as? [String: Any] ?? [:]
        let tabs = editor["tabs"] as? [[String: Any]] ?? []
        let cursor = file["cursor"] as? [String: Int] ?? [:]
        let blame = file["blame"] as? String ?? ""
        let shown = !opened.isError && file["lineCount"] as? Int == 61 && file["language"] as? String == "Plain Text"
            && cursor == ["line": 1, "column": 1] && editor["diffActive"] as? Bool == false
        check("open_file", shown && tabs.count == 1 && tabs.first?["preview"] as? Bool == false,
              opened.isError ? opened.text : "\(file["lineCount"] ?? "nil") lines, \(tabs.count) tabs")
        check("open_file blame note", blame.hasPrefix("Smoke Test, ") && blame.hasSuffix(" • first"), blame)

        let preview = try await client.call("app", ["action": "open_file", "filePath": "notes.txt", "preview": true])
        let previewEditor = preview.structured?["editor"] as? [String: Any] ?? [:]
        let previewTabs = previewEditor["tabs"] as? [[String: Any]] ?? []
        let untracked = (previewEditor["file"] as? [String: Any])?["blame"] as? String
        check("open_file preview tab", previewTabs.count == 2 && previewTabs.last?["preview"] as? Bool == true,
              preview.isError ? preview.text : "\(previewTabs.count) tabs")
        check("an untracked file reads as uncommitted", untracked == "You, Uncommitted changes", untracked ?? "nil")

        let missing = try await client.call("app", ["action": "open_file", "filePath": "nope.txt"])
        check("open_file of a missing file fails", missing.isError, missing.text)
    }
}
