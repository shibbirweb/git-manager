// gm-measure measure --screen staged: stages Reference.diffFile in both apps before the capture, and puts the demo
// back afterwards, as both apps open the same copy one after the other.

import Foundation
import MeasureKit

extension Measure {
    /// Stages Reference.diffFile: the current app with its git_stage tool, then waits until its file watcher has put
    /// the file in the Staged group (two rows there); the native app with `app action=stage`, which answers once
    /// the window shows it.
    static func stageFile(_ app: RunningApp) async throws {
        if app.kind == .native {
            let staged = try await app.client.call("app", ["action": "stage", "filePaths": [Reference.diffFile]])
            if staged.isError {
                throw ToolError("native: could not stage \(Reference.diffFile): \(staged.text)")
            }
            return
        }
        let state = try await app.client.call("get_app_state").structured ?? [:]
        let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
        let staged = try await app.client.call("git_stage", ["repoPath": repoRoot, "filePaths": [Reference.diffFile]])
        if staged.isError {
            throw ToolError("current: could not stage \(Reference.diffFile): \(staged.text)")
        }
        let selector = ".group[aria-label=\"Staged\"] .row"
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline {
            let found = try await app.client.call("inspect_elements", ["selector": selector, "limit": 5])
            if ((found.structured ?? [:])["count"] as? Int ?? 0) == 2 {
                return
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        throw ToolError("current: \(Reference.diffFile) did not show in the Staged group within 10 s")
    }

    /// Puts the demo back as it was, as both apps open the same copy one after the other.
    static func unstageFile(_ app: RunningApp) async throws {
        let answer: ToolAnswer
        if app.kind == .native {
            answer = try await app.client.call("app", ["action": "unstage", "filePaths": [Reference.diffFile]])
        } else {
            let state = try await app.client.call("get_app_state").structured ?? [:]
            let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
            answer = try await app.client.call("git_unstage", ["repoPath": repoRoot, "filePaths": [Reference.diffFile]])
        }
        if answer.isError {
            throw ToolError("\(app.kind.rawValue): could not unstage \(Reference.diffFile) again: \(answer.text)")
        }
    }
}
