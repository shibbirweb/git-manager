// The GitHub account (src/lib/views/github/GitHubSignInForm.svelte): who is signed in, with Sign Out, or the ways to
// sign in: a personal access token (sent once to the bridge, which verifies it and keeps it in the keychain) or the
// GitHub CLI's own login. Used by Settings > GitHub.

import AppKit
import NativeCore
import SwiftUI

struct GitHubAccountForm: View {
    @Environment(\.theme) private var theme
    @Environment(\.windowContext) private var windowContext
    @Environment(\.settingsRowsWidth) private var rowsWidth
    @ObservedObject private var store = GitHubAccountStore.shared

    /// The form's width in a dialog; nil in Settings (the rows' width).
    var dialogWidth: CGFloat?
    /// Signed in from the sign-in dialog: the GitHub item it was asked for continues.
    var onSignedIn: (() -> Void)?

    private var width: CGFloat {
        dialogWidth ?? rowsWidth
    }

    /// Held only while typed: cleared as soon as it is sent.
    @State private var token = ""
    @State private var working: String?
    @State private var problem: String?
    @State private var focused = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let account = store.account {
                signedIn(account)
            } else {
                signedOut
            }
            if let problem {
                text(problem, token: "--danger")
            }
        }
        .frame(width: width, alignment: .leading)
        .task {
            // In a dialog the token field takes the keyboard (data-autofocus), so it shows the focus ring.
            if dialogWidth != nil {
                focused = true
            }
            await store.load()
            await store.loadCli()
        }
    }

    private func signedIn(_ account: GitHubAccount) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(theme.color("--accent"))
                    ExactText(text: GitHubModel.accountInitials(login: account.login, name: account.name), size: 12,
                              weight: .semibold)
                        .foregroundStyle(theme.ink("--accent-text"))
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 2) {
                    ExactText(text: account.login, size: 13, weight: .bold)
                        .foregroundStyle(theme.ink("--text"))
                    let source = account.source == "ghCli" ? "through the GitHub CLI" : "token in the keychain"
                    hintLine("\(account.name.map { "\($0), " } ?? "")\(account.host), \(source)")
                }
                Spacer(minLength: 0)
                DialogButton(title: working == "signOut" ? "Signing Out..." : "Sign Out", disabled: working != nil,
                             hug: true, small: true) {
                    signOut(account)
                }
            }
            if let hint = GitHubModel.missingScopesHint(account.missingScopes) {
                text(hint, token: "--warning")
            }
        }
    }

    private var signedOut: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 5) {
                ExactText(text: "Sign in with a token", size: 12)
                    .foregroundStyle(theme.ink("--text-dim"))
                HStack(spacing: 8) {
                    PageInput(text: $token, focused: focused, mono: true, ligatures: true,
                              placeholder: "ghp_... or github_pat_...", autofocus: dialogWidth != nil, secure: true,
                              onFocus: { focused = true },
                              onSubmit: signInWithToken)
                        .disabled(working != nil)
                    DialogButton(title: working == "token" ? "Signing In..." : "Sign In", primary: true,
                                 disabled: working != nil || token.trimmingCharacters(in: .whitespaces).isEmpty,
                                 hug: true, action: signInWithToken)
                }
            }
            RichParagraph(runs: [
                RichRun(text: "A classic token with the "), RichRun(text: "repo", face: .code),
                RichRun(text: " and "), RichRun(text: "gist", face: .code), RichRun(text: " scopes ("),
                RichRun(text: "create one on GitHub", token: "--accent", action: openTokenPage),
                RichRun(text: "). It is checked with GitHub, then kept only in the system keychain."),
            ], width: width)
            if let cli = store.cli, cli.installed {
                HStack(spacing: 8) {
                    DialogButton(title: working == "cli" ? "Signing In..." : "Use GitHub CLI",
                                 disabled: working != nil || !cli.signedIn, hug: true, action: signInWithCli)
                    hintLine(cli.signedIn ? "Uses the login of gh, asked each time; nothing is stored."
                             : "gh is installed but not signed in: run gh auth login first.")
                }
            }
        }
    }

    /// A .hint line: 12 points in --text-faint on its 17.4-point line box (17 points, as the hints' lines lay out).
    private func hintLine(_ text: String) -> some View {
        ExactText(text: text, size: 12)
            .foregroundStyle(theme.ink("--text-faint"))
            .frame(height: 17)
    }

    private func text(_ text: String, token: String) -> some View {
        Text(text)
            .font(PageFont.font(12))
            .foregroundStyle(theme.ink(token))
            .fixedSize(horizontal: false, vertical: true)
    }

    private func openTokenPage() {
        if let url = URL(string: GitHubModel.tokenURL) {
            NSWorkspace.shared.open(url)
        }
    }

    private func signInWithToken() {
        let typed = token
        token = ""
        guard !typed.trimmingCharacters(in: .whitespaces).isEmpty, working == nil else {
            return
        }
        run("token") {
            let account = try await store.signIn(token: typed)
            windowContext?.toasts.show(.success, "Signed in to GitHub as \(account.login)")
            onSignedIn?()
        }
    }

    private func signInWithCli() {
        run("cli") {
            let account = try await store.signInWithCli()
            windowContext?.toasts.show(.success, "Signed in to GitHub as \(account.login)",
                                       detail: "Using the GitHub CLI's login.")
            onSignedIn?()
        }
    }

    private func signOut(_ account: GitHubAccount) {
        let alert = NSAlert()
        alert.messageText = "Sign Out of GitHub"
        alert.informativeText = account.source == "ghCli"
            ? "Stop using the GitHub CLI's login (\(account.login))? gh itself stays signed in."
            : "Remove the token of \(account.login) from the keychain?"
        alert.addButton(withTitle: "Sign Out").hasDestructiveAction = true
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else {
            return
        }
        run("signOut") {
            try await store.signOut()
            windowContext?.toasts.show(.success, "Signed out of GitHub")
        }
    }

    private func run(_ what: String, _ work: @escaping () async throws -> Void) {
        working = what
        problem = nil
        Task {
            do {
                try await work()
            } catch let error as BackendError {
                problem = error.message
            } catch {
                problem = error.localizedDescription
            }
            working = nil
        }
    }
}
