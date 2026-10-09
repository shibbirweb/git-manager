// The GitHub submenu's dialogs (src/lib/views/github/GitHubDialogHost.svelte): the one open in this window
// (GitHubCenter), each in the Git dialogs' frame. Sign In to GitHub (GitHubSignInDialog.svelte) and the result of an
// action (GitHubResultDialog.svelte) are here; Share Project and Create Gist have files of their own.

import AppKit
import SwiftUI

struct GitHubDialogHost: View {
    @EnvironmentObject private var center: GitHubCenter

    var body: some View {
        switch center.dialog {
        case .signIn(let actionLabel):
            GitHubSignInDialog(actionLabel: actionLabel)
        case .share(let repoRoot):
            ShareProjectDialog(repoRoot: repoRoot)
        case .gist(let fileName, let content, let fromSelection):
            CreateGistDialog(fileName: fileName, content: content, fromSelection: fromSelection)
        case .result(let title, let message, let url, let openLabel, let problem):
            GitHubResultDialog(title: title, message: message, url: url, openLabel: openLabel, problem: problem)
        case nil:
            EmptyView()
        }
    }
}

/// The content width of a dialog `width` wide: less its border and 20 points of padding on each side.
func gitDialogContentWidth(_ width: CGFloat) -> CGFloat {
    width - 42
}

/// Asked before a GitHub item that needs an account; continues with that item once signed in.
struct GitHubSignInDialog: View {
    @Environment(\.theme) private var theme
    @EnvironmentObject private var center: GitHubCenter

    let actionLabel: String

    var body: some View {
        GitDialogFrame(title: "Sign In to GitHub", width: 520, onCancel: center.close) {
            GitDialogText(text: "\(actionLabel) needs a GitHub account.", token: "--text-faint")
            GitHubAccountForm(dialogWidth: gitDialogContentWidth(520), onSignedIn: center.signedIn)
        } footer: {
            DialogButton(title: "Cancel", hug: true, action: center.close)
        }
    }
}

/// The end of a GitHub action: what happened, and the page it made with Copy Link and Open.
struct GitHubResultDialog: View {
    @Environment(\.theme) private var theme
    @Environment(\.windowContext) private var windowContext
    @EnvironmentObject private var center: GitHubCenter

    let title: String
    let message: String
    let url: String?
    let openLabel: String
    let problem: String?

    var body: some View {
        GitDialogFrame(title: title, width: 520, onCancel: center.close, onSubmit: url == nil ? nil : open,
                       footerSpaced: true) {
            // .message: 13 points, line-height 1.5.
            Text(message)
                .font(PageFont.font(13))
                .lineSpacing(13 * 1.5 - 15.5)
                .foregroundStyle(theme.ink("--text"))
                .fixedSize(horizontal: false, vertical: true)
            if let problem {
                GitDialogText(text: problem, token: "--danger")
            }
            if let url {
                // .command: the link in the 11.5-point code font on --panel-alt, 5 by 8 points in.
                Text(url)
                    .font(Font(CodeFont.font(11.5)))
                    .foregroundStyle(theme.ink("--text-dim"))
                    .textSelection(.enabled)
                    .padding(.vertical, 6)
                    .padding(.horizontal, 9)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 6, style: .circular).fill(theme.color("--panel-alt")))
                    .borderRing(theme.color("--border"), cornerRadius: 6)
            }
        } footer: {
            if url != nil {
                DialogButton(title: "Copy Link", hug: true, action: copy)
            }
            Spacer(minLength: 0)
            DialogButton(title: "Close", primary: url == nil, hug: true, action: center.close)
            if url != nil {
                DialogButton(title: openLabel, primary: true, hug: true, action: open)
            }
        }
    }

    private func copy() {
        guard let url else {
            return
        }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(url, forType: .string)
        windowContext?.toasts.show(.success, "Copied link", detail: url)
    }

    private func open() {
        if let url, let link = URL(string: url) {
            NSWorkspace.shared.open(link)
        }
        center.close()
    }
}
