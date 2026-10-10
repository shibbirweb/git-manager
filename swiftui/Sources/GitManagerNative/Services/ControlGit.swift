// The control server's stage, unstage and commit actions (`app action=stage filePaths=[...]`), run through the
// window exactly as a click runs them, so the busy state, the toasts and the refresh after them happen too. The
// answer is the window's state once the refresh is done.

import Foundation
import NativeCore

extension Control {
    static func git(_ action: String, _ args: [String: Any]) -> String {
        let filePaths = args["filePaths"] as? [String]
        let outcome: (ok: Bool, text: String) = waitOnMain { model in
            switch action {
            case "commit":
                return await commit(model, message: args["message"] as? String, amend: args["amend"] as? Bool)
            default:
                return await stage(model, staging: action == "stage", filePaths: filePaths)
            }
        }
        return reply(ok: outcome.ok, text: outcome.text, structured: onMain { state() })
    }

    /// Stages (or unstages) `filePaths`, or the whole group without them, like the group's Stage all.
    @MainActor
    private static func stage(_ model: AppModel, staging: Bool, filePaths: [String]?) async -> (Bool, String) {
        let groups = FileGroups(model.snapshot?.status?.files ?? [])
        let pool = staging ? groups.unstaged : groups.staged
        let files = filePaths.map { paths in pool.filter { paths.contains($0.path) } } ?? pool
        let found = Set(files.map(\.path))
        if let missing = filePaths?.first(where: { !found.contains($0) }) {
            return (false, "\(missing) has no \(staging ? "unstaged" : "staged") changes")
        }
        if files.isEmpty {
            return (false, staging ? "Nothing to stage" : "Nothing to unstage")
        }
        let done = staging ? await model.stage(files) : await model.unstage(files)
        return (done, done ? "" : lastError(model))
    }

    /// Types `message` into the box (when given), sets Amend, then clicks Commit.
    @MainActor
    private static func commit(_ model: AppModel, message: String?, amend: Bool?) async -> (Bool, String) {
        if let message {
            model.draft.message = message
        }
        if let amend, amend != model.draft.amend {
            await model.setAmend(amend)
        }
        let state = model.commitState
        if let reason = CommitRules.disabledReason(state) {
            return (false, reason)
        }
        if !CommitRules.canCommit(state) {
            return (false, "Another git command is running")
        }
        let done = await model.commit()
        return (done, done ? "" : lastError(model))
    }

    @MainActor
    private static func lastError(_ model: AppModel) -> String {
        let toast = model.toasts.items.last { $0.kind == .error }
        return [toast?.title, toast?.detail].compactMap { $0 }.joined(separator: ": ")
    }

    /// The Changes list and commit box, for get_state.
    @MainActor
    static func changesState() -> [String: Any] {
        let model = WindowContext.focused.app
        let groups = FileGroups(model.snapshot?.status?.files ?? [])
        let toasts = model.toasts.items.map { toast -> [String: Any] in
            ["kind": toast.kind.rawValue, "title": toast.title, "detail": orNull(toast.detail),
             "action": orNull(toast.action?.label)]
        }
        return [
            "staged": groups.staged.map(\.path),
            "unstaged": groups.unstaged.map(\.path),
            "busy": orNull(model.busy),
            "commitMessage": model.draft.message,
            "amend": model.draft.amend,
            "canCommit": CommitRules.canCommit(model.commitState),
            "toasts": toasts,
            "unreadAlerts": model.toasts.unread,
            "openDiff": orNull(model.openDiff.map { ["filePath": $0.filePath, "staged": $0.staged] as [String: Any] }),
        ]
    }

    /// toggle_repo folds or unfolds a repository's section in Changes; set_active_repo makes it the active one.
    static func workspaceAction(_ action: String, _ args: [String: Any]) -> String {
        guard let repoRoot = args["repoRoot"] as? String,
              onMain({ WindowContext.focused.workspace.repo(at: repoRoot) }) != nil else {
            return reply(ok: false, text: "repoRoot must be a repository of the workspace")
        }
        if action == "toggle_repo" {
            onMain { WindowContext.focused.workspace.toggleCollapsed(repoRoot) }
        } else {
            waitOnMain { model in
                await model.setActive(repoRoot)
            }
        }
        return reply(ok: true, structured: onMain { state() })
    }

    /// The open workspace: its folders, each repository with its change count, and the active one.
    @MainActor
    static func workspaceState() -> [String: Any] {
        let workspace = WindowContext.focused.workspace
        return [
            "name": orNull(workspace.name),
            "folders": workspace.folders.map(\.root),
            "repos": workspace.repos.map { repo -> [String: Any] in
                ["root": repo.root, "name": repo.name, "relativePath": repo.relativePath,
                 "changes": workspace.changeCount(repo.root), "collapsed": workspace.collapsed.contains(repo.root)]
            },
            "activeRepo": orNull(WindowContext.focused.app.repoPath),
            "totalChanges": workspace.totalChanges,
        ]
    }

    /// Runs `work` on the main actor and waits for it here, on the server's thread (never the main one).
    private static func waitOnMain<Value>(_ work: @escaping @MainActor (AppModel) async -> Value) -> Value {
        let semaphore = DispatchSemaphore(value: 0)
        var result: Value?
        Task { @MainActor in
            result = await work(WindowContext.focused.app)
            semaphore.signal()
        }
        semaphore.wait()
        guard let result else {
            fatalError("waitOnMain finished without a result")
        }
        return result
    }
}
