// gm-measure --screen githubsignin|githubshare|githubgist: Git > GitHub's dialogs in both apps, run as the menu runs
// them (the current app's run_menu_command, the native app's app run_menu_command). githubsignin is signed out, so
// Share Project asks to sign in first; githubshare and githubgist are signed in from a seeded github.json
// (writeGitHubAccount). The demo's storefront has an origin that is not on GitHub, so Share Project opens, and
// githubgist opens src/catalog.ts first.

import Foundation
import MeasureKit

extension Measure {
    static let githubDialogScreens = ["githubsignin", "githubshare", "githubgist"]
    static let signedInDialogScreens = ["githubshare", "githubgist"]

    static func openGitHubDialog(_ app: RunningApp, screen: String) async throws {
        if screen == "githubgist" {
            try await openFile(app)
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
        let command = screen == "githubgist" ? "git.github.createGist" : "git.github.share"
        let ran = app.kind == .current
            ? try await app.client.call("run_menu_command", ["action": command])
            : try await app.client.call("app", ["action": "run_menu_command", "command": command])
        if ran.isError {
            throw ToolError("\(app.kind.rawValue): could not run \(command): \(ran.text)")
        }
        let deadline = Date().addingTimeInterval(8)
        while Date() < deadline {
            if try await dialogShows(app) {
                // The fields fill in (the remotes' names) a moment after the dialog shows.
                try await Task.sleep(nanoseconds: 1_000_000_000)
                return
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        throw ToolError("\(app.kind.rawValue): the \(screen) dialog did not show within 8 s")
    }

    private static func dialogShows(_ app: RunningApp) async throws -> Bool {
        if app.kind == .native {
            let state = try await app.client.call("app", ["action": "github_dialog"]).structured ?? [:]
            return (state["dialog"] as? String ?? "none") != "none"
        }
        let found = try await app.client.call("inspect_elements", ["selector": ".dialog", "limit": 1])
        return ((found.structured ?? [:])["count"] as? Int ?? 0) > 0
    }
}
