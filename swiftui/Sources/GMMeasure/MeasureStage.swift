// gm-measure measure --screen staged (and parity's stageFiles): stages files in both apps before the capture, and
// puts the demo back afterwards, as both apps open the same copy one after the other.

import Foundation
import MeasureKit

extension Measure {
    /// Stages `filePaths` (Reference.diffFile by default): the current app with its git_stage tool, then waits until
    /// its file watcher has put them in the Staged group (the group's header row plus one row each, with nothing
    /// staged before); the native app with `app action=stage`, which answers once the window shows them.
    static func stageFiles(_ app: RunningApp, _ filePaths: [String] = [Reference.diffFile]) async throws {
        let names = filePaths.joined(separator: ", ")
        if app.kind == .native {
            let staged = try await app.client.call("app", ["action": "stage", "filePaths": filePaths])
            if staged.isError {
                throw ToolError("native: could not stage \(names): \(staged.text)")
            }
            return
        }
        let state = try await app.client.call("get_app_state").structured ?? [:]
        let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
        let staged = try await app.client.call("git_stage", ["repoPath": repoRoot, "filePaths": filePaths])
        if staged.isError {
            throw ToolError("current: could not stage \(names): \(staged.text)")
        }
        let selector = ".group[aria-label=\"Staged\"] .row"
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline {
            let found = try await app.client.call("inspect_elements", ["selector": selector, "limit": 50])
            if ((found.structured ?? [:])["count"] as? Int ?? 0) == filePaths.count + 1 {
                return
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        throw ToolError("current: \(names) did not show in the Staged group within 10 s")
    }

    /// Puts the demo back as it was, as both apps open the same copy one after the other.
    static func unstageFiles(_ app: RunningApp, _ filePaths: [String] = [Reference.diffFile]) async throws {
        let answer: ToolAnswer
        if app.kind == .native {
            answer = try await app.client.call("app", ["action": "unstage", "filePaths": filePaths])
        } else {
            let state = try await app.client.call("get_app_state").structured ?? [:]
            let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
            answer = try await app.client.call("git_unstage", ["repoPath": repoRoot, "filePaths": filePaths])
        }
        if answer.isError {
            let names = filePaths.joined(separator: ", ")
            throw ToolError("\(app.kind.rawValue): could not unstage \(names) again: \(answer.text)")
        }
    }
}
