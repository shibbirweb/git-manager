// gm-measure smoke: the window session. The app started on nothing, with a saved session of two windows (the
// welcome screen, then the test repository at 1100 x 700), opens both again, the second at its saved size.

import Foundation
import MeasureKit

extension Smoke {
    static func checkSession(appPath: String, workDir: String, repoPath: String,
                             check: (String, Bool, String) -> Void) async throws {
        let home = (workDir as NSString).appendingPathComponent("session-home")
        let windows: [[String: Any]] = [
            ["folders": [String](), "workspaceFile": NSNull(), "bounds": NSNull()],
            ["folders": [repoPath], "workspaceFile": NSNull(),
             "bounds": ["x": 120, "y": 80, "width": 1100, "height": 700]],
        ]
        let app = try await AppLauncher.launch(kind: .native, home: home, folderPath: "", appPath: appPath,
                                               state: ["windows": windows], readyOnAnswer: true)
        do {
            var listed: [[String: Any]] = []
            for _ in 0..<50 {
                listed = try await app.client.call("app", ["action": "list_windows"])
                    .structured?["windows"] as? [[String: Any]] ?? []
                if listed.count == 2, listed.contains(where: { !($0["folders"] as? [String] ?? []).isEmpty }) {
                    break
                }
                try await Task.sleep(nanoseconds: 200_000_000)
            }
            let folders = listed.compactMap { ($0["folders"] as? [String])?.first }.map(realPath)
            check("the last session's windows open at start", listed.count == 2 && folders == [realPath(repoPath)],
                  "\(listed.count) windows, folders \(folders)")
            let restored = listed.first { !($0["folders"] as? [String] ?? []).isEmpty }
            let size = [restored?["contentWidth"], restored?["contentHeight"]].map { ($0 as? Double) ?? 0 }
            check("a restored window takes its saved size", size == [1100, 700], "\(size)")
            // The session is written as windows open and change, not only at quit.
            try await Task.sleep(nanoseconds: 1_500_000_000)
            let statePath = (home as NSString).appendingPathComponent(".gitmanager-native/state.json")
            let stateURL = URL(fileURLWithPath: statePath)
            let saved = (try? JSONSerialization.jsonObject(with: Data(contentsOf: stateURL))) as? [String: Any]
            let savedWindows = saved?["windows"] as? [[String: Any]] ?? []
            check("the session is saved while the app runs", savedWindows.count == 2, "\(savedWindows.count) windows")
        } catch {
            await app.stop()
            throw error
        }
        await app.stop()
    }
}
