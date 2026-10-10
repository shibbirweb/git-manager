// Share Project on GitHub (ShareProjectDialog.svelte): creates the repository under the signed-in account (private
// unless unchecked), adds it as a remote and pushes the current branch with upstream. A repository without commits
// commits every file first. Errors stay in the dialog so the name can be fixed; the end is a result dialog.

import NativeCore
import SwiftUI

private struct ShareRequest: Encodable {
    let repositoryName: String
    let `private`: Bool
    let description: String
    let remoteName: String
    let initialCommitMessage: String?
}

private struct ShareArgs: Encodable {
    let repoPath: String
    let request: ShareRequest
}

private struct SharedRepository: Decodable {
    let fullName: String
    let htmlUrl: String
    let remoteName: String
    let branchName: String
}

private struct PushArgs: Encodable {
    let repoPath: String
    let remoteName: String
    let remoteBranch: String
}

struct ShareProjectDialog: View {
    @Environment(\.windowContext) private var windowContext
    @EnvironmentObject private var center: GitHubCenter
    @ObservedObject private var account = GitHubAccountStore.shared

    let repoRoot: String

    @State private var repositoryName = ""
    @State private var isPrivate = true
    @State private var description = ""
    @State private var remoteName = "origin"
    @State private var remoteEdited = false
    @State private var remoteNames: [String] = []
    @State private var commitMessage = "Initial commit"
    @State private var working = false
    @State private var step = ""
    @State private var progress = ""
    @State private var problem: String?
    @State private var focused = "name"

    private var status: RepoStatus? {
        windowContext?.app.snapshot?.status
    }

    private var unborn: Bool {
        status?.head.unborn ?? false
    }

    private var branchName: String? {
        status?.head.branch
    }

    private var fileCount: Int {
        status?.files.count ?? 0
    }

    private var nameError: String? {
        GitHubModel.validateRepositoryName(repositoryName)
    }

    private var remoteError: String? {
        GitHubModel.validateShareRemoteName(remoteName, remoteNames)
    }

    private var blocker: String? {
        if status != nil && branchName == nil {
            return "HEAD is detached: check out a branch to share first."
        }
        if unborn && fileCount == 0 {
            return "This repository has no commits and no files to commit yet."
        }
        return nil
    }

    private var commitError: String? {
        unborn && commitMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Enter a commit message" : nil
    }

    private var canShare: Bool {
        !working && nameError == nil && remoteError == nil && blocker == nil && commitError == nil
    }

    var body: some View {
        GitDialogFrame(title: "Share Project on GitHub", width: 540, closable: !working, onCancel: close,
                       onSubmit: submit) {
            if let login = account.account?.login {
                // The login in bold, as the <strong> in the hint.
                (Text("Creates the repository under ") + Text(login).bold() + Text(" on github.com."))
                    .font(PageFont.font(12))
                    .modifier(GitDialogInk(token: "--text-faint"))
            }
            GitDialogField(label: "Repository name") {
                input($repositoryName, name: "name")
            }
            if let nameError {
                GitDialogText(text: nameError, token: "--danger")
            }
            GitDialogCheck(label: "Private", checked: $isPrivate, disabled: working)
            HStack(alignment: .top, spacing: 8) {
                GitDialogField(label: "Remote") {
                    input(Binding(get: { remoteName }, set: { value in
                        remoteName = value
                        remoteEdited = true
                    }), name: "remote")
                }
                .frame(width: (gitDialogContentWidth(540) - 8) / 3)
                GitDialogField(label: "Description") {
                    input($description, name: "description", placeholder: "Optional")
                }
            }
            if let remoteError {
                GitDialogText(text: remoteError, token: "--danger")
            }
            if unborn && fileCount > 0 {
                GitDialogText(text: "This repository has no commits yet. Every file that is not ignored is "
                              + "committed first, then pushed.", token: "--text-faint")
                GitDialogField(label: "Initial commit message") {
                    input($commitMessage, name: "message")
                }
                if let commitError {
                    GitDialogText(text: commitError, token: "--danger")
                }
            } else if let branchName, blocker == nil {
                GitDialogText(text: "Pushes \(branchName) with upstream."
                              + (fileCount > 0 ? " Uncommitted changes stay local." : ""), token: "--text-faint")
            }
            if let blocker {
                GitDialogText(text: blocker, token: "--danger")
            }
            if working {
                GitDialogProgress(line: progress.isEmpty ? step : progress)
                    .lineLimit(1)
            }
            if let problem {
                GitDialogText(text: problem, token: "--danger", selectable: true)
            }
        } footer: {
            DialogButton(title: "Cancel", disabled: working, hug: true, action: close)
            DialogButton(title: working ? "Sharing..." : "Share", primary: true, disabled: !canShare, hug: true,
                         action: submit)
        }
        .onAppear(perform: start)
    }

    private func input(_ text: Binding<String>, name: String, placeholder: String = "") -> some View {
        PageInput(text: text, focused: focused == name, placeholder: placeholder, autofocus: name == "name",
                  onFocus: { focused = name })
            .disabled(working)
    }

    private func start() {
        let folderName = windowContext?.workspace.repos.first { $0.root == repoRoot }?.name
            ?? (repoRoot as NSString).lastPathComponent
        repositoryName = GitHubModel.suggestRepositoryName(folderName)
        let repoPath = repoRoot
        Task {
            let remotes = await Task.detached {
                (try? Backend.call("list_remotes", ["repoPath": repoPath]) as [RemoteDTO]) ?? []
            }.value
            remoteNames = remotes.map(\.name)
            if !remoteEdited {
                remoteName = GitHubModel.defaultShareRemoteName(remoteNames)
            }
        }
    }

    private func close() {
        if !working {
            center.close()
        }
    }

    private func submit() {
        guard canShare, let app = windowContext?.app else {
            return
        }
        let name = repositoryName.trimmingCharacters(in: .whitespaces)
        if !isPrivate, !GitDialogConfirm.danger(
            title: "Share as Public",
            message: "Anyone on the internet can see \(name) and its history. Share it as public?",
            button: "Share Public"
        ) {
            return
        }
        let request = ShareRequest(
            repositoryName: name, private: isPrivate,
            description: description.trimmingCharacters(in: .whitespaces),
            remoteName: remoteName.trimmingCharacters(in: .whitespaces),
            initialCommitMessage: unborn ? commitMessage.trimmingCharacters(in: .whitespacesAndNewlines) : nil
        )
        working = true
        problem = nil
        step = unborn ? "Committing the files and creating the repository..." : "Creating the repository on GitHub..."
        Task {
            // Errors stay in this dialog, so the user can fix the name and try again.
            let created = await app.run("Share on GitHub") { repoPath in
                Result { try Backend.call("github_share_project", ShareArgs(repoPath: repoPath, request: request))
                    as SharedRepository }
            }
            switch created {
            case .success(let shared):
                await push(shared, app: app)
            case .failure(let error):
                problem = AppModel.describe(error)
                fallthrough
            case nil:
                working = false
                step = ""
            }
        }
    }

    private func push(_ shared: SharedRepository, app: AppModel) async {
        step = "Pushing \(shared.branchName) to \(shared.remoteName)..."
        let poll = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 200_000_000)
                progress = (try? Backend.call("git_progress", [String: String]()) as String) ?? ""
            }
        }
        let pushed = await app.run("Push \(shared.branchName)") { repoPath in
            Result { try Backend.perform("push_with_options", PushArgs(
                repoPath: repoPath, remoteName: shared.remoteName, remoteBranch: shared.branchName)) }
        }
        poll.cancel()
        working = false
        var pushProblem: String?
        if case .failure(let error) = pushed {
            pushProblem = AppModel.describe(error)
        }
        center.open(.result(
            title: pushProblem == nil ? "Shared on GitHub" : "Created on GitHub, Not Pushed",
            message: pushProblem == nil
                ? "\(shared.fullName) was created and \(shared.branchName) was pushed to \(shared.remoteName), "
                    + "tracking it."
                : "\(shared.fullName) was created and added as \(shared.remoteName), but pushing "
                    + "\(shared.branchName) failed. Make sure git can sign in to github.com over HTTPS (for example "
                    + "run gh auth setup-git), then push again.",
            url: shared.htmlUrl, openLabel: "Open on GitHub", problem: pushProblem
        ))
    }
}

/// A theme token as the text color, for views built from Text concatenation.
struct GitDialogInk: ViewModifier {
    @Environment(\.theme) private var theme

    let token: String

    func body(content: Content) -> some View {
        content
            .foregroundStyle(theme.ink(token))
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
