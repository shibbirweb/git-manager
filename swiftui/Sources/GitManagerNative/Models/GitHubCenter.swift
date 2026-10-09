// What the Git > GitHub items that need an account do (src/lib/views/github/githubActions.ts and githubDialogs.ts):
// Share Project on GitHub, Sync Fork and Create Gist, each asking to sign in first when no account is set up, and the
// one GitHub dialog open in this window.

import AppKit
import NativeCore

enum GitHubDialog: Equatable {
    /// Asked before an item that needs an account; once signed in, that item runs again.
    case signIn(actionLabel: String)
    case share(repoRoot: String)
    case gist(fileName: String, content: String, fromSelection: Bool)
    /// The end of an action: what happened, and the page it made (Copy Link and Open).
    case result(title: String, message: String, url: String?, openLabel: String, problem: String?)
}

struct RemoteDTO: Decodable {
    let name: String
    let fetchUrl: String?
    let pushUrl: String?
    let defaultBranch: String?
}

struct GitHubRepositoryInfo: Decodable {
    struct Parent: Decodable {
        let fullName: String
        let owner: String
        let repo: String
        let defaultBranch: String?
    }

    let fullName: String
    let htmlUrl: String
    let defaultBranch: String?
    let fork: Bool
    let parent: Parent?
}

struct SyncForkOutcome: Decodable {
    let kind: String
    let message: String
}

@MainActor
final class GitHubCenter: ObservableObject {
    /// The window this belongs to (WindowContext).
    weak var context: WindowContext!

    @Published private(set) var dialog: GitHubDialog?
    private var retry: (() -> Void)?

    func open(_ next: GitHubDialog) {
        dialog = next
    }

    func close() {
        dialog = nil
        retry = nil
    }

    /// The sign-in dialog finished: the item it was asked for runs again.
    func signedIn() {
        let next = retry
        close()
        next?()
    }

    /// True when signed in; otherwise opens the sign-in dialog, which runs `retry` once signed in.
    private func requireAccount(_ actionLabel: String, retry: @escaping () -> Void) async -> Bool {
        await GitHubAccountStore.shared.load()
        if GitHubAccountStore.shared.account != nil {
            return true
        }
        self.retry = retry
        dialog = .signIn(actionLabel: actionLabel)
        return false
    }

    /// The repository's GitHub remote: the branch's upstream remote, else origin, else the first github.com one.
    private func gitHubRemote(_ repoPath: String) async -> GitHubRemotes.Remote? {
        let remotes = await Task.detached {
            (try? Backend.call("list_remotes", ["repoPath": repoPath]) as [RemoteDTO]) ?? []
        }.value
        let upstream = context.app.snapshot?.status?.head.upstream?.split(separator: "/").first.map(String.init)
        return GitHubRemotes.pick(remotes.map {
            GitHubRemotes.RemoteURLs(name: $0.name, fetchURL: $0.fetchUrl, pushURL: $0.pushUrl,
                                     defaultBranch: $0.defaultBranch)
        }, preferred: upstream)
    }

    func shareProject() async {
        guard let repoRoot = context.app.repoPath else {
            return
        }
        if let existing = await gitHubRemote(repoRoot) {
            context.toasts.show(.info, "Already on GitHub",
                                detail: "\(existing.remoteName) points to \(existing.owner)/\(existing.repo).")
            return
        }
        guard await requireAccount("Share Project on GitHub", retry: { [weak self] in
            Task { await self?.shareProject() }
        }) else {
            return
        }
        dialog = .share(repoRoot: repoRoot)
    }

    func syncFork() async {
        guard let repoRoot = context.app.repoPath, let remote = await gitHubRemote(repoRoot) else {
            return
        }
        guard await requireAccount("Sync Fork", retry: { [weak self] in Task { await self?.syncFork() } }) else {
            return
        }
        let looked = await Task.detached {
            Result { try Backend.call("github_repository", ["owner": remote.owner, "repo": remote.repo])
                as GitHubRepositoryInfo }
        }.value
        guard case .success(let info) = looked else {
            if case .failure(let error) = looked {
                context.toasts.show(.error, "Sync Fork failed", detail: AppModel.describe(error))
            }
            return
        }
        guard info.fork, let parent = info.parent else {
            context.toasts.show(.info, "Not a fork", detail: "\(info.fullName) was not forked from another repository.")
            return
        }
        let head = context.app.snapshot?.status?.head
        guard let branchName = GitHubModel.syncForkBranch(branch: head?.branch, upstream: head?.upstream,
                                                          remoteName: remote.remoteName,
                                                          defaultBranch: info.defaultBranch) else {
            context.toasts.show(.info, "Nothing to sync", detail: "Check out a branch first.")
            return
        }
        let alert = NSAlert()
        alert.messageText = "Sync Fork"
        alert.informativeText = "Update \(branchName) of \(info.fullName) on GitHub with the changes in "
            + "\(parent.fullName), then fetch?"
        alert.addButton(withTitle: "Sync Fork")
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else {
            return
        }
        let synced: SyncForkOutcome? = await context.app.run("Sync Fork") { _ in
            try Backend.call("github_sync_fork", ["owner": remote.owner, "repo": remote.repo,
                                                   "branchName": branchName]) as SyncForkOutcome
        }
        guard let outcome = synced else {
            return
        }
        if outcome.kind == "conflict" {
            let parentBranch = branchName == info.defaultBranch ? parent.defaultBranch : branchName
            dialog = .result(
                title: GitHubModel.syncForkTitle(outcome.kind),
                message: "GitHub cannot sync \(branchName) because it conflicts with \(parent.fullName). Open a pull "
                    + "request to merge the changes and resolve the conflicts there.",
                url: GitHubModel.forkCompareURL(fork: (remote.owner, remote.repo), parent: (parent.owner, parent.repo),
                                                branchName: branchName, parentBranch: parentBranch),
                openLabel: "Open Pull Request", problem: outcome.message
            )
            return
        }
        // Brings the synced branch into the remote-tracking refs; pulling stays the user's choice.
        let fetched: Void? = await context.app.run("Fetch") { repoPath in
            try Backend.perform("fetch_all", ["repoPath": repoPath])
        }
        let next = fetched != nil
            ? "Fetched \(remote.remoteName): pull to update your local \(branchName)."
            : "Fetch the remote to see the changes locally."
        let branchPath = branchName.split(separator: "/").map {
            String($0).addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? String($0)
        }.joined(separator: "/")
        dialog = .result(title: GitHubModel.syncForkTitle(outcome.kind), message: "\(outcome.message) \(next)",
                         url: "\(info.htmlUrl)/tree/\(branchPath)", openLabel: "Open on GitHub", problem: nil)
    }

    /// The file on screen, or its selection, as a gist.
    func createGist() async {
        let editor = context.editor
        guard !(editor.diffActive && context.diffs.openDiff != nil), let session = editor.session,
              let filePath = editor.file?.path else {
            context.toasts.show(.info, "Open a file first",
                                detail: "Create Gist shares the file on screen or its selection.")
            return
        }
        let state = session.state
        let selection = state.selection.main
        let fromSelection = !selection.isEmpty
        let text = state.doc.string
        let content = fromSelection ? state.doc.slice(selection.from, selection.to) : text
        guard await requireAccount("Create Gist", retry: { [weak self] in Task { await self?.createGist() } })
        else {
            return
        }
        dialog = .gist(fileName: GitHubModel.gistFileName(filePath), content: content, fromSelection: fromSelection)
    }
}
