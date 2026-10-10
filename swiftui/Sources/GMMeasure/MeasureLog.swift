// gm-measure measure --screen log (and parity's logCommit): shows the Log in both apps (the History activity), with
// the newest commit selected and its first file's diff open as the Log opens, or on a given revision, and checks
// that each app really shows it.

import Foundation
import MeasureKit

extension Measure {
    /// What the current app must show before the capture: the rows, the selected commit's details and its diff.
    static let logSelectors = [
        ".log-view .row.selected",
        ".log-view .details .file.selected",
        ".log-view .details .cm-mergeView .cm-line",
    ]

    /// Opens the Log: the current app with its own show_panel tool (show_commit for a revision), the native app
    /// with `app action=show_log`.
    static func showLog(_ app: RunningApp, revision: String? = nil) async throws {
        if app.kind == .native {
            var args: [String: Any] = ["action": "show_log"]
            if let revision {
                args["commitId"] = revision
            }
            let shown = try await app.client.call("app", args)
            if shown.isError {
                throw ToolError("native: could not show the Log: \(shown.text)")
            }
            let state = shown.structured ?? [:]
            if (state["logCommits"] as? Int ?? 0) == 0 || state["logSelected"] is NSNull {
                throw ToolError("native: the Log shows no commits: \(shown.text)")
            }
            return
        }
        let shown: ToolAnswer
        if let revision {
            // The current app knows the repository by its real path (/private/var/..., not /var/...).
            let state = try await app.client.call("get_app_state").structured ?? [:]
            let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
            shown = try await app.client.call("show_commit", ["repoPath": repoRoot, "commitId": revision])
        } else {
            shown = try await app.client.call("show_panel", ["panel": "log"])
        }
        if shown.isError {
            throw ToolError("current: could not show the Log: \(shown.text)")
        }
        try await waitFor(app, selectors: logSelectors, what: "the Log with its selected commit and diff")
    }

    /// Waits until every selector matches at least one element.
    static func waitFor(_ app: RunningApp, selectors: [String], what: String) async throws {
        let deadline = Date().addingTimeInterval(10)
        var pending = selectors
        while Date() < deadline {
            var missing: [String] = []
            for selector in pending {
                let found = try await app.client.call("inspect_elements", ["selector": selector, "limit": 1])
                if ((found.structured ?? [:])["count"] as? Int ?? 0) == 0 {
                    missing.append(selector)
                }
            }
            if missing.isEmpty {
                return
            }
            pending = missing
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        throw ToolError("current: \(what) did not show within 10 s (missing \(pending.joined(separator: ", ")))")
    }
}
