// The control server's `show_log` action, like the current app's `show_panel panel=log`: shows the Log (or hides it
// with visible false), optionally selects the commit at `position` in the list, and answers once the history, the
// selected commit's details and its first file's diff are on screen (or after 10 seconds).

import Foundation

extension Control {
    static func showLog(_ args: [String: Any]) -> String {
        let visible = args["visible"] as? Bool ?? true
        let repoPath = onMain { WindowContext.focused.app.repoPath }
        guard repoPath != nil else {
            return reply(ok: false, text: "No folder is open")
        }
        if !visible {
            onMain { WindowContext.focused.log.hide() }
            return reply(ok: true, structured: onMain { logState() })
        }
        onMain { WindowContext.focused.log.show(repoPath: repoPath) }
        guard waitFor({ $0.initialLoaded && !$0.loading }) else {
            return reply(ok: false, text: "The Log did not load within 10 s", structured: onMain { logState() })
        }
        var target: String?
        if let revision = args["commitId"] as? String, let repoPath {
            // Like the current app's show_commit: any revision, resolved by the shared git code.
            struct RevisionArgs: Encodable {
                let repoPath: String
                let revision: String
            }
            guard let commitId = try? Backend.call("resolve_revision", RevisionArgs(repoPath: repoPath,
                                                                                   revision: revision)) as String,
                  onMain({ WindowContext.focused.log.index(of: commitId) }) != nil else {
                return reply(ok: false, text: "\(revision) is not in the loaded history")
            }
            target = commitId
        } else if let position = args["position"] as? Int {
            target = onMain { WindowContext.focused.log.commit(at: position)?.id }
            guard target != nil else {
                return reply(ok: false, text: "No commit at position \(position)")
            }
        }
        if let commitId = target {
            let semaphore = DispatchSemaphore(value: 0)
            Task { @MainActor in
                await WindowContext.focused.log.select(commitId)
                semaphore.signal()
            }
            semaphore.wait()
        }
        // The details and the diff follow the selection; a commit without files shows no diff.
        _ = waitFor { log in
            guard let details = log.details, details.id == log.selectedId else {
                return log.selectedId == nil
            }
            return details.files.isEmpty || log.diffSettled
        }
        Thread.sleep(forTimeInterval: 0.3)
        return reply(ok: true, structured: onMain { logState() })
    }

    /// Polls the Log on the main thread until `done` holds, up to 10 seconds.
    private static func waitFor(_ done: @escaping @MainActor (LogModel) -> Bool) -> Bool {
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline {
            if onMain({ done(WindowContext.focused.log) }) {
                return true
            }
            Thread.sleep(forTimeInterval: 0.05)
        }
        return false
    }

    @MainActor
    static func logState() -> [String: Any] {
        let log = WindowContext.focused.log
        var state = self.state()
        state["logShown"] = log.shown
        state["logCommits"] = log.commits.count
        state["logHasMore"] = log.hasMore
        state["logSelected"] = orNull(log.selectedId)
        state["logFiles"] = log.details?.files.map(\.path) ?? []
        state["logDiff"] = orNull(log.diff?.filePath)
        state["logError"] = orNull(log.loadError)
        return state
    }
}
