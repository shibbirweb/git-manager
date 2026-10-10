// gm-measure smoke: Code > Go to Line on readme.md (4 lines): the prompt asks "Line[:column] (1-4)" from the
// cursor's "1:1", keeps an invalid answer with its message, and "3:2" puts the cursor on line 3, column 2.

import Foundation
import MeasureKit

extension Smoke {
    static func checkGoToLine(_ client: McpClient, check: (String, Bool, String) -> Void) async throws {
        _ = try await client.call("app", ["action": "open_file", "filePath": "readme.md"])
        _ = try await client.call("app", ["action": "editor_command", "command": "code.goToLine"])
        let wrong = try await client.call("app", ["action": "dialog", "value": "3:"])
        let asked = wrong.structured?["dialog"] as? [String: Any] ?? [:]
        let kept = try await client.call("app", ["action": "dialog"])
        let error = (kept.structured?["dialog"] as? [String: Any])?["error"] as? String
        check("Go to Line asks from the cursor", asked["title"] as? String == "Go to Line"
              && asked["label"] as? String == "Line[:column] (1-4)" && asked["value"] as? String == "1:1",
              "\(asked)")
        check("Go to Line keeps an invalid answer", error == "Enter a line number, optionally with :column",
              error ?? "nil")
        let answered = try await client.call("app", ["action": "dialog", "value": "3:2"])
        let editor = answered.structured?["editor"] as? [String: Any]
        let cursor = (editor?["file"] as? [String: Any])?["cursor"] as? [String: Int]
        check("Go to Line moves the cursor", cursor == ["line": 3, "column": 2], "\(cursor ?? [:])")
    }
}
