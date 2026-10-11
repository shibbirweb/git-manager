// gm-measure smoke: column selection on long.txt ("line 1" to "line 60", line 10 "line 10 changed"): an Option+drag
// from line 2 column 2 to line 5 column 4 selects those columns on each line; one from line 8 column 4 to past the
// end of line 11 takes each line to the pointer's column or its end; Cmd keeps the selection and adds the new one;
// the canvas's partial repaints equal a whole one.

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
        let added = try await client.call("app", [
            "action": "column_drag", "fromLine": 1, "fromColumn": 0, "toLine": 1, "toColumn": 4, "adding": true,
        ])
        check("Cmd keeps the selection and adds the rectangle", ranges(added).count == 5
              && ranges(added).first == [0, 4], "\(ranges(added))")
        let painted = try await client.call("app", ["action": "canvas_check"])
        check("Partial repaints match a whole one after a column selection",
              painted.structured?["paintsLikeWhole"] as? Bool == true, painted.text)
    }

    private static func ranges(_ answer: ToolAnswer) -> [[Int]] {
        answer.structured?["ranges"] as? [[Int]] ?? []
    }
}
