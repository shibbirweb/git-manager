// Stage, unstage, commit and the commit toast's Undo, run like the current app's repoStore.run
// (src/lib/stores/repo.svelte.ts): the label shows as busy, a failure becomes the error toast "<label> failed" with
// git's message, and the status is read again afterwards either way. The writes go through the bridge's git CLI.

import AppKit
import NativeCore

extension AppModel {
    /// Runs `work` off the main thread with the open repository; nil when it failed or another write is running.
    @discardableResult
    func run<Value>(
        _ label: String, success: String? = nil, action: ((Value) -> ToastAction?)? = nil,
        _ work: @escaping (String) throws -> Value
    ) async -> Value? {
        guard let repoPath, busy == nil else {
            return nil
        }
        busy = label
        let result = await Task.detached { () -> Result<Value, Error> in
            Result { try work(repoPath) }
        }.value
        busy = nil
        // A failure tells before the refresh, a success after it, so its Undo sees the new HEAD.
        if case .failure(let error) = result {
            toasts.show(.error, "\(label) failed", detail: Self.describe(error))
        }
        await refreshStatus()
        guard case .success(let value) = result else {
            return nil
        }
        if let success {
            toasts.show(.success, success, action: action?(value))
        }
        return value
    }

    nonisolated static func describe(_ error: Error) -> String {
        (error as? BackendError)?.message ?? error.localizedDescription
    }

    /// The commit box and the heading's Commit button as they stand now.
    var commitState: CommitBoxState {
        let groups = FileGroups(snapshot?.status?.files ?? [])
        return CommitBoxState(
            stagedCount: groups.staged.count, unstagedCount: groups.unstaged.count,
            conflictCount: groups.conflicts.count, message: draft.message, amend: draft.amend, busy: busy != nil,
            loadingMessage: draft.loadingMessage, unborn: snapshot?.status?.head.unborn ?? false
        )
    }

    /// True when git staged them; a failure shows its toast.
    @discardableResult
    func stage(_ files: [FileStatus]) async -> Bool {
        let filePaths = files.map(\.path)
        guard !filePaths.isEmpty else {
            return false
        }
        let done: Void? = await run("Stage") { repoPath in
            try Backend.perform("stage_files", FilesArgs(repoPath: repoPath, filePaths: filePaths))
        }
        return done != nil
    }

    @discardableResult
    func unstage(_ files: [FileStatus]) async -> Bool {
        let filePaths = ChangeSelection.unstagePaths(files.map { (path: $0.path, origPath: $0.origPath) })
        guard !filePaths.isEmpty else {
            return false
        }
        let done: Void? = await run("Unstage") { repoPath in
            try Backend.perform("unstage_files", FilesArgs(repoPath: repoPath, filePaths: filePaths))
        }
        return done != nil
    }

    /// The row's Discard button: not built in the native app yet, so it says so instead of doing nothing.
    func discard(_ files: [FileStatus]) {
        toasts.show(.info, "Discard is not in the native app yet")
    }

    /// The Commit button: commits the staged changes (or amends) with the box's message, then empties the box.
    @discardableResult
    func commit(all: Bool = false) async -> Bool {
        let state = commitState
        guard all || CommitRules.canCommit(state) else {
            return false
        }
        let amend = draft.amend
        // An untouched box with Amend keeps the last commit's message (git commit --amend --no-edit).
        let message = amend && state.messageBlank ? "" : draft.message
        let args = { (repoPath: String) in CommitArgs(repoPath: repoPath, message: message, amend: amend) }
        let output: GitOutput? = await run(
            "Commit", success: amend ? "Commit amended" : "Committed",
            action: { [weak self] _ in self?.undoAction(amend ? "amend" : "commit") }
        ) { repoPath in
            try Backend.call(all ? "commit_all" : "commit", args(repoPath))
        }
        guard output != nil else {
            return false
        }
        draft.clear()
        return true
    }

    /// The heading's Commit (check) button: commits, asks to commit all tracked changes, or focuses the box.
    func commitFromHead() async {
        let files = snapshot?.status?.files ?? []
        let tracked = files.filter { !$0.conflicted && $0.unstaged != nil && $0.unstaged != "untracked" }.count
        switch CommitRules.plan(commitState, trackedCount: tracked) {
        case .blocked(let reason):
            toasts.show(.info, reason)
        case .focus:
            messageFocusRequests += 1
        case .commit:
            await commit()
        case .confirmAll:
            let question = "There are no staged changes. Stage all changes to tracked files and commit them?"
            if confirm(title: "Commit All", message: question, button: "Commit All", danger: false) {
                await commit(all: true)
            }
        }
    }

    /// Amend: fills a blank box with the last commit's message, and takes it out again when turned off untouched.
    func setAmend(_ checked: Bool) async {
        draft.amend = checked
        if !checked {
            if let prefilled = draft.prefilled, draft.message == prefilled {
                draft.message = ""
            }
            draft.prefilled = nil
            return
        }
        guard let repoPath, commitState.messageBlank else {
            return
        }
        draft.loadingMessage = true
        let result = await Task.detached { () -> Result<String, Error> in
            Result { try Backend.call("get_head_message", RepoArgs(repoPath: repoPath)) }
        }.value
        draft.loadingMessage = false
        switch result {
        case .success(let headMessage):
            if draft.amend, let text = CommitRules.amendPrefill(message: draft.message, headMessage: headMessage) {
                draft.message = text
                draft.prefilled = text
            }
        case .failure(let error):
            toasts.show(.error, "Could not read the last commit message", detail: Self.describe(error))
        }
    }

    private func undoAction(_ expected: String) -> ToastAction {
        ToastAction(label: "Undo") { [weak self] in
            Task {
                await self?.undoLast(expected)
            }
        }
    }

    /// The Undo button: moves the branch back while HEAD is still the commit it was made for; the changes stay
    /// staged and a soft undo of a commit offers its message again.
    func undoLast(_ expected: String) async {
        guard let repoPath else {
            return
        }
        let last = await Task.detached {
            try? Backend.call("last_action", RepoArgs(repoPath: repoPath)) as LastAction
        }.value
        let outcome = CommitUndo.plan(
            expected: expected, last: last?.entry, branch: last?.branch, pushed: last?.pushed ?? false
        )
        guard case .undo(let undo) = outcome else {
            if case .refuse(let title, let detail) = outcome {
                toasts.show(.info, title, detail: detail)
            }
            return
        }
        if undo.pushed, !confirm(title: undo.title, message: undo.question, button: "Undo", danger: true) {
            return
        }
        let headMessage = await Task.detached {
            (try? Backend.call("get_head_message", RepoArgs(repoPath: repoPath)) as String) ?? ""
        }.value
        let used: String? = await run(undo.title, success: undo.success) { repoPath in
            try Backend.call("move_head_back", MoveHeadBackArgs(
                repoPath: repoPath, headId: undo.headId, commitId: undo.commitId, mode: "soft"
            ))
        }
        if used == "soft", let text = CommitRules.amendPrefill(message: draft.message, headMessage: headMessage),
           !text.isEmpty {
            draft.message = text
        }
    }

    private func confirm(title: String, message: String, button: String, danger: Bool) -> Bool {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = danger ? .critical : .informational
        alert.addButton(withTitle: button)
        alert.addButton(withTitle: "Cancel")
        return alert.runModal() == .alertFirstButtonReturn
    }
}
