// gm-measure smoke: Quick Open, the Command Palette and Find in Files through the `app` tool's quick_open, search
// and close_dialog actions, on the smoke repository (Smoke.makeRepository).

import Foundation
import MeasureKit

extension Smoke {
    static func checkSearch(_ app: RunningApp, repoPath: String, check: (String, Bool, String) -> Void) async throws {
        let state = { (answer: ToolAnswer) in answer.structured ?? [:] }
        let rows = { (value: [String: Any]) in value["rows"] as? [String] ?? [] }

        let files = try await app.client.call(
            "app", ["action": "quick_open", "prefix": "", "recentFiles": ["long.txt", "readme.md"]]
        )
        let fileRows = rows(state(files))
        let expected = ["h:recent", "r:\(repoPath)/readme.md", "r:\(repoPath)/long.txt"]
        check("quick_open lists recent files", fileRows == expected, fileRows.joined(separator: ", "))

        let palette = try await app.client.call("app", ["action": "quick_open", "prefix": ">"])
        let commandRows = rows(state(palette))
        let paletteOk = commandRows.first == "c:app.about" && commandRows.count > 100
            && state(palette)["status"] as? String == "Show and Run Commands"
        let first = commandRows.first ?? ""
        check("quick_open > lists the commands", paletteOk, "\(commandRows.count) rows, first \(first)")

        let found = try await app.client.call("app", ["action": "search", "query": "changed"])
        let status = state(found)["status"] as? String ?? found.text
        let textRows = rows(state(found))
        let lines = textRows.filter { $0.hasPrefix("tl:") }.count
        check("search finds text in files", status == "3 matches in 2 files" && lines == 3, status)

        let closed = try await app.client.call("app", ["action": "close_dialog"])
        check("close_dialog closes the popup", state(closed)["popup"] is NSNull, closed.text)
    }
}
