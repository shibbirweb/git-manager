// gm-measure smoke: column selection on long.txt ("line 1" to "line 60", line 10 "line 10 changed"): an Option+drag
// from line 2 column 2 to line 5 column 4 selects those columns on each line; one from line 8 column 4 to past the
// end of line 11 takes each line to the pointer's column or its end; another drag replaces the selection; the
// canvas's partial repaints equal a whole one. Then text drags: "line" of line 2 dropped at the end of line 3 moves
// it there (selected), and with Option (copy) leaves it where it was too.

import Foundation
import MeasureKit

extension Smoke {
    static func checkColumnSelection(_ client: McpClient, check: (String, Bool, String) -> Void) async throws {
        _ = try await client.call("app", ["action": "open_file", "filePath": "long.txt"])
        let block = try await client.call("app", [
            "action": "column_drag", "fromLine": 2, "fromColumn": 2, "toLine": 5, "toColumn": 4,
        ])
        check("Option+drag selects a rectangle", ranges(block) == [[9, 11], [16, 18], [23, 25], [30, 32]],
              "\(ranges(block)) in \(block.structured?["ms"] ?? "?") ms")
        let ragged = try await client.call("app", [
            "action": "column_drag", "fromLine": 8, "fromColumn": 4, "toLine": 11, "toColumn": 12,
        ])
        check("Short lines end the rectangle at their end", ranges(ragged)
              == [[53, 55], [60, 62], [67, 75], [83, 86]], "\(ranges(ragged))")
        let again = try await client.call("app", [
            "action": "column_drag", "fromLine": 1, "fromColumn": 0, "toLine": 1, "toColumn": 4,
        ])
        check("Another drag replaces the selection", ranges(again) == [[0, 4]], "\(ranges(again))")
        let painted = try await client.call("app", ["action": "canvas_check"])
        check("Partial repaints match a whole one after a column selection",
              painted.structured?["paintsLikeWhole"] as? Bool == true, painted.text)
        try await checkTextDrag(client, check: check)
    }

    private static func checkTextDrag(_ client: McpClient, check: (String, Bool, String) -> Void) async throws {
        _ = try await client.call("app", ["action": "open_file", "filePath": "long.txt", "line": 2, "column": 1])
        _ = try await client.call("app", ["action": "editor_command", "command": "code.selectNextOccurrence"])
        let moved = try await client.call("app", ["action": "text_drag", "toLine": 3, "toColumn": 6])
        check("Dragging selected text moves it", head(moved) == ["line 1", " 2", "line 3line", "line 4"]
              && selection(moved) == "line", "\(head(moved))")
        _ = try await client.call("app", ["action": "editor_command", "command": "edit.undo"])
        _ = try await client.call("app", ["action": "open_file", "filePath": "long.txt", "line": 2, "column": 1])
        _ = try await client.call("app", ["action": "editor_command", "command": "code.selectNextOccurrence"])
        let copied = try await client.call("app", ["action": "text_drag", "toLine": 3, "toColumn": 6, "copy": true])
        check("Dragging with Option copies it", head(copied) == ["line 1", "line 2", "line 3line", "line 4"],
              "\(head(copied))")
        _ = try await client.call("app", ["action": "editor_command", "command": "edit.undo"])
    }

    private static func head(_ answer: ToolAnswer) -> [String] {
        let file = (answer.structured?["editor"] as? [String: Any])?["file"] as? [String: Any]
        return Array((file?["text"] as? String ?? "").components(separatedBy: "\n").prefix(4))
    }

    private static func selection(_ answer: ToolAnswer) -> String {
        let file = (answer.structured?["editor"] as? [String: Any])?["file"] as? [String: Any]
        return file?["selection"] as? String ?? ""
    }

    private static func ranges(_ answer: ToolAnswer) -> [[Int]] {
        answer.structured?["ranges"] as? [[Int]] ?? []
    }
}
