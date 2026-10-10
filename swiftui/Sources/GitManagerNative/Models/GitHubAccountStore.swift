// The signed-in GitHub account as the bridge reports it (src/lib/views/github/githubAccount.svelte.ts). The token is
// sent once to the bridge, which verifies it and keeps it in the native app's own keychain item; nothing here holds
// or reads it back.

import Foundation

struct GitHubAccount: Decodable, Equatable {
    let host: String
    let login: String
    let name: String?
    /// "token" or "ghCli".
    let source: String
    let missingScopes: [String]
}

struct GhCliStatus: Decodable, Equatable {
    let installed: Bool
    let signedIn: Bool
}

@MainActor
final class GitHubAccountStore: ObservableObject {
    static let shared = GitHubAccountStore()

    @Published private(set) var account: GitHubAccount?
    /// Whether gh is installed and signed in; nil until asked.
    @Published private(set) var cli: GhCliStatus?

    /// Re-reads github.json (cheap: no network, no keychain).
    func load() async {
        // Signed out, the bridge answers null, which reads as no account.
        account = await Task.detached {
            try? Backend.call("github_account", [String: String]()) as GitHubAccount
        }.value
    }

    func loadCli() async {
        cli = await Task.detached {
            (try? Backend.call("github_cli_status", [String: String]()) as GhCliStatus)
                ?? GhCliStatus(installed: false, signedIn: false)
        }.value
    }

    func signIn(token: String) async throws -> GitHubAccount {
        let signedIn = try await Task.detached {
            try Backend.call("github_sign_in_with_token", ["token": token]) as GitHubAccount
        }.value
        account = signedIn
        return signedIn
    }

    func signInWithCli() async throws -> GitHubAccount {
        let signedIn = try await Task.detached {
            try Backend.call("github_sign_in_with_cli", [String: String]()) as GitHubAccount
        }.value
        account = signedIn
        return signedIn
    }

    func signOut() async throws {
        try await Task.detached {
            try Backend.perform("github_sign_out", [String: String]())
        }.value
        account = nil
    }
}
