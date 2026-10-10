// gm-measure smoke: the find bar on long.txt (60 lines, "changed" on lines 10 and 50): Edit > Find opens it, typing
// jumps to the first match with the counter "1/2", Find Next goes to the second, Replace All changes both and says
// so, Undo puts the text back and Escape closes the bar; at three points the editor's pixels equal a
// whole repaint.

import Foundation
import MeasureKit

extension Smoke {
    static func checkFind(_ client: McpClient, check: (String, Bool, String) -> Void) async throws {
        _ = try await client.call("app", ["action": "open_file", "filePath": "long.txt"])
        let opened = try await client.call("app", ["action": "editor_command", "command": "edit.find"])
        check("Find opens the find bar", find(opened)["open"] as? Bool == true, "\(find(opened))")
        let typed = try await client.call("app", ["action": "find", "search": "changed"])
        check("Typing jumps to the first match", cursor(typed) == ["line": 10, "column": 16]
              && selection(typed) == "changed" && find(typed)["counter"] as? String == "1/2",
              "\(cursor(typed)) \(find(typed))")
        try await checkCanvas(client, "after typing a search", check: check)
        let next = try await client.call("app", ["action": "editor_command", "command": "edit.findNext"])
        check("Find Next goes to the next match", cursor(next) == ["line": 50, "column": 16]
              && find(next)["counter"] as? String == "2/2", "\(cursor(next)) \(find(next))")
        try await checkCanvas(client, "after Find Next", check: check)
        let replaced = try await client.call("app", ["action": "find", "replace": "fixed", "replaceAll": true])
        check("Replace All changes every match", find(replaced)["notice"] as? String == "2 replaced"
              && file(replaced)["dirty"] as? Bool == true, "\(find(replaced))")
        _ = try await client.call("app", ["action": "editor_command", "command": "edit.undo"])
        let closed = try await client.call("app", ["action": "editor_command", "command": "edit.closeFind"])
        check("Undo and Escape leave the file as it was", find(closed)["open"] as? Bool == false
              && file(closed)["dirty"] as? Bool == false, "\(file(closed))")
        try await checkCanvas(client, "after the bar closed", check: check)
    }

    /// The editor's pixels after partial repaints equal a whole repaint (FileCanvas.paintsLikeWhole).
    private static func checkCanvas(_ client: McpClient, _ moment: String, check: (String, Bool, String) -> Void)
        async throws {
        let answer = try await client.call("app", ["action": "canvas_check"])
        let same = answer.structured?["paintsLikeWhole"] as? Bool
        check("Partial repaints match a whole one \(moment)", same == true, "\(same.map { "\($0)" } ?? answer.text)")
    }

    private static func file(_ answer: ToolAnswer) -> [String: Any] {
        (answer.structured?["editor"] as? [String: Any])?["file"] as? [String: Any] ?? [:]
    }

    private static func find(_ answer: ToolAnswer) -> [String: Any] {
        file(answer)["find"] as? [String: Any] ?? [:]
    }

    private static func cursor(_ answer: ToolAnswer) -> [String: Int] {
        file(answer)["cursor"] as? [String: Int] ?? [:]
    }

    private static func selection(_ answer: ToolAnswer) -> String {
        file(answer)["selection"] as? String ?? ""
    }
}
