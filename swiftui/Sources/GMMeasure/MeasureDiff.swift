// gm-measure measure --screen diff: opens the diff of Reference.diffFile in both apps with the run's "Collapse
// unchanged" choice, and checks that each app really shows it before anything is compared.

import Foundation
import MeasureKit

extension Measure {
    /// Opens the diff: the current app by its own tool, the native app by its `app` tool.
    static func showDiff(_ app: RunningApp, collapse: Bool) async throws {
        let shown: ToolAnswer
        if app.kind == .current {
            // The current app knows the repository by its real path (/private/var/..., not /var/...).
            let state = try await app.client.call("get_app_state").structured ?? [:]
            let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
            shown = try await app.client.call(
                "show_changes_diff", ["repoPath": repoRoot, "filePath": Reference.diffFile]
            )
        } else {
            shown = try await app.client.call("app", ["action": "show_diff", "filePath": Reference.diffFile])
        }
        if shown.isError {
            throw ToolError("\(app.kind.rawValue): could not show the diff: \(shown.text)")
        }
        if app.kind == .current {
            try await requireCollapse(app, on: collapse)
        } else if (shown.structured?["collapseUnchanged"] as? Bool) != collapse {
            throw ToolError("native: \"Collapse unchanged\" did not follow ~/.gitmanager-native/diff.json")
        }
    }

    /// The native app reads "Collapse unchanged" from ~/.gitmanager-native/diff.json (DiffPrefs.swift), here in the
    /// run's throwaway HOME.
    static func writeNativeDiffPrefs(home: String, collapse: Bool) throws {
        let folder = (home as NSString).appendingPathComponent(".gitmanager-native")
        try FileManager.default.createDirectory(atPath: folder, withIntermediateDirectories: true)
        let path = (folder as NSString).appendingPathComponent("diff.json")
        try "{\"collapseUnchanged\":\(collapse)}".write(toFile: path, atomically: true, encoding: .utf8)
    }

    /// CurrentAppPrefs sets the run's choice in the current app's localStorage. If that did not take (the app moved
    /// its storage, or never stored anything and the run wants collapse off), the run stops instead of comparing
    /// different layouts.
    private static func requireCollapse(_ app: RunningApp, on: Bool) async throws {
        let state = on ? ".active" : ":not(.active)"
        let selector = "button.toggle\(state)[title=\"Collapse unchanged fragments\"]"
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            let found = try await app.client.call("inspect_elements", ["selector": selector, "limit": 1])
            if ((found.structured ?? [:])["count"] as? Int ?? 0) > 0 {
                return
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        throw ToolError(
            "current: \"Collapse unchanged\" is not \(on ? "on" : "off") although the run set it in the app's "
                + "localStorage (CurrentAppPrefs.swift): check where the app keeps it now."
        )
    }
}
