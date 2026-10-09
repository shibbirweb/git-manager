// gm-measure smoke: several windows. New Window opens a second, empty window; asking for the folder the first one
// shows brings that window to the front instead of opening a third (window_open's owner rule).

import Foundation
import MeasureKit

extension Smoke {
    static func checkWindows(_ client: McpClient, repoPath: String, check: (String, Bool, String) -> Void)
        async throws {
        let opened = try await client.call("app", ["action": "new_window"])
        try await Task.sleep(nanoseconds: 1_500_000_000)
        var windows = try await list(client)
        check("app new_window opens an empty window", !opened.isError && windows.count == 2
                && windows.contains { ($0["folders"] as? [String] ?? []).isEmpty },
              opened.isError ? opened.text : "\(windows)")
        // The folder the first window shows now (the merge checks before this one open their own repository).
        let shown = windows.compactMap { ($0["folders"] as? [String])?.first }.first ?? repoPath
        _ = try await client.call("app", ["action": "new_window", "folderPaths": [shown]])
        try await Task.sleep(nanoseconds: 1_000_000_000)
        windows = try await list(client)
        let focused = windows.first { $0["focused"] as? Bool == true }
        let focusedFolders = (focused?["folders"] as? [String] ?? []).map(realPath)
        check("a folder another window shows focuses that window", windows.count == 2
                && focusedFolders.contains(realPath(shown)), "\(windows.count) windows, focused \(focusedFolders)")
    }

    private static func list(_ client: McpClient) async throws -> [[String: Any]] {
        try await client.call("app", ["action": "list_windows"]).structured?["windows"] as? [[String: Any]] ?? []
    }
}
