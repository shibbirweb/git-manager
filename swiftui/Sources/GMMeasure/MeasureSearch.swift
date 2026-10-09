// gm-measure measure --screen quickopen|palette|search: opens Quick Open, the Command Palette or Find in Files in
// both apps with fixed contents. The current app cannot be typed into from outside (posting keys needs
// Accessibility access), so each popup starts from what its menu command gives it:
// - quickopen: Go to File after opening and closing `recentFiles`, so it lists them under "Recently opened".
// - palette: the Command Palette as Shift+Cmd+P opens it (">"), every command listed.
// - search: Find in Files with the editor's selection as the query: `searchQuery` at `searchAt` in
//   Reference.diffFile, selected by Select Next Occurrence; the tab is closed again so the Changes screen shows
//   behind the popup. The word is in one file only, as Find in Files lists files in the order its threads finish.

import Foundation
import MeasureKit

extension Measure {
    static let searchScreens = ["quickopen", "palette", "search"]
    /// Opened in this order, so Quick Open lists them the other way round (most recent first).
    static let recentFiles = ["src/pricing.ts", "README.md", "src/cart.ts"]
    static let searchQuery = "lines"
    /// 1-based line and column of `searchQuery` in Reference.diffFile ("private lines: CartLine[] = [];").
    static let searchAt = (line: 10, column: 11)

    /// Rows each popup shows once its results are in, so the capture waits for them.
    static func expectedRows(_ screen: String) -> Int? {
        switch screen {
        case "quickopen":
            return recentFiles.count
        case "search":
            return 9
        default:
            return nil
        }
    }

    static func showSearchScreen(_ app: RunningApp, screen: String) async throws {
        if app.kind == .native {
            var args: [String: Any] = [:]
            switch screen {
            case "quickopen":
                args = ["action": "quick_open", "prefix": "", "recentFiles": recentFiles]
            case "palette":
                args = ["action": "quick_open", "prefix": ">"]
            default:
                args = ["action": "search", "tab": "text", "query": searchQuery]
            }
            let shown = try await app.client.call("app", args)
            if shown.isError {
                throw ToolError("native: could not open \(screen): \(shown.text)")
            }
            return
        }
        let state = try await app.client.call("get_app_state").structured ?? [:]
        let root = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
        let popup: String
        switch screen {
        case "quickopen":
            for filePath in recentFiles {
                try await currentCall(app, "open_file", ["filePath": "\(root)/\(filePath)"])
            }
            for filePath in recentFiles {
                try await currentCall(app, "close_tab", ["tabPath": "\(root)/\(filePath)"])
            }
            try await currentCall(app, "run_menu_command", ["action": "edit.goToFile"])
            popup = "Quick Open"
        case "palette":
            try await currentCall(app, "run_menu_command", ["action": "view.commandPalette"])
            popup = "Quick Open"
        default:
            let filePath = "\(root)/\(Reference.diffFile)"
            try await currentCall(
                app, "open_file", ["filePath": filePath, "line": searchAt.line, "column": searchAt.column]
            )
            try await currentCall(app, "run_menu_command", ["action": "code.selectNextOccurrence"])
            try await currentCall(app, "run_menu_command", ["action": "edit.findInFiles"])
            try await currentCall(app, "close_tab", ["tabPath": filePath])
            popup = "Search Everywhere"
        }
        try await waitForRows(app, popup: popup, count: expectedRows(screen))
    }

    private static func currentCall(_ app: RunningApp, _ toolName: String, _ args: [String: Any]) async throws {
        let answer = try await app.client.call(toolName, args)
        if answer.isError {
            throw ToolError("current: \(toolName) \(args) failed: \(answer.text)")
        }
        // Each step lets the page settle (a tab opening, a popup mounting) before the next.
        try await Task.sleep(nanoseconds: 400_000_000)
    }

    /// Waits until the popup shows `count` result rows (any rows when nil).
    private static func waitForRows(_ app: RunningApp, popup: String, count: Int?) async throws {
        let selector = ".popup[aria-label=\"\(popup)\"] .canvas > div"
        let deadline = Date().addingTimeInterval(10)
        var seen = 0
        while Date() < deadline {
            let found = try await app.client.call("inspect_elements", ["selector": selector, "limit": 100])
            seen = (found.structured ?? [:])["count"] as? Int ?? 0
            if let count, seen == count + (popup == "Quick Open" ? 1 : 0) {
                return
            }
            if count == nil && seen > 0 {
                return
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        throw ToolError("current: \(popup) showed \(seen) rows, not \(count.map(String.init) ?? "some") within 10 s")
    }
}
