// The remembered active repository per workspace, checked against repo.svelte.ts (describeWorkspace, saveWorkspaceAs)
// and settingsData.ts's parseState.

import Foundation
import NativeCore
import Testing

@Test func workspaceIdIsTheFileElseTheFolderRootsOnePerLine() {
    #expect(ActiveRepos.workspaceId(folderRoots: ["/w/acme", "/w/design"], file: nil) == "/w/acme\n/w/design")
    #expect(ActiveRepos.workspaceId(folderRoots: ["/w/acme"], file: "/w/team.gitmanager-workspace")
        == "/w/team.gitmanager-workspace")
}

@Test func stateKeepsOnlyStringValues() {
    let parsed = ActiveRepos.parse(["/w/acme": "/w/acme/storefront", "/w/bad": 3, "/w/null": NSNull()])
    #expect(parsed == ["/w/acme": "/w/acme/storefront"])
    #expect(ActiveRepos.parse("nope").isEmpty)
    #expect(ActiveRepos.parse(nil).isEmpty)
}

@Test func savingAsMovesTheRememberedRepositoryElseTheActiveOne() {
    let repos = ["/w/acme": "/w/acme/payments-api"]
    let moved = ActiveRepos.moved(repos, from: "/w/acme", to: "/w/team.gitmanager-workspace", activeRoot: "/w/x")
    #expect(moved["/w/team.gitmanager-workspace"] == "/w/acme/payments-api")
    #expect(moved["/w/acme"] == "/w/acme/payments-api")
    let fromActive = ActiveRepos.moved([:], from: "/w/acme", to: "/w/t.gitmanager-workspace", activeRoot: "/w/x")
    #expect(fromActive == ["/w/t.gitmanager-workspace": "/w/x"])
    #expect(ActiveRepos.moved([:], from: "/w/acme", to: "/w/t", activeRoot: nil).isEmpty)
}
