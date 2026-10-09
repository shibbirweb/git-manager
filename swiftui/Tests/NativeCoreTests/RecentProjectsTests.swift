// Recent projects and the welcome list, checked against values from recentEntries.ts and welcomeModel.ts (run with
// Bun) and settingsData.ts's parseState.

import NativeCore
import Testing

@Test func entriesListFilesThenWorkspacesThenFoldersLeavingOutWhatIsOpen() {
    let lists = RecentLists(workspaceFiles: ["/w/team.gitmanager-workspace"],
                            workspaces: [["/w/a", "/w/b", "/w/c", "/w/d"]], folders: ["/Users/me/x", "/w/open"])
    let entries = RecentProjects.entries(lists, openRoots: ["/w/open"])
    #expect(entries.map(\.label) == ["team", "a, b, c +1", "x"])
    #expect(entries.map(\.hint) == ["workspace file", "4 folders", "~/x"])
    #expect(entries[1].subtitle == "/w/a, /w/b, /w/c, /w/d")
    #expect(entries[1].key == "/w/a\n/w/b\n/w/c\n/w/d")
}

@Test func stateListsAreReadCappedAndUpdatedLikeTheCurrentApp() {
    var lists = RecentLists(state: [
        "recentRepos": ["/old", 3], "recentWorkspaces": [["/a"], ["/a", "/b"]], "recentWorkspaceFiles": "nope",
    ])
    #expect(lists == RecentLists(workspaceFiles: [], workspaces: [["/a", "/b"]], folders: ["/old"]))
    lists.addFolder("/new")
    lists.addFolder("/old")
    #expect(lists.folders == ["/old", "/new"])
    lists.addWorkspace(["/c"])
    lists.addWorkspace(["/c", "/d"])
    #expect(lists.workspaces == [["/c", "/d"], ["/a", "/b"]])
    for index in 0..<20 {
        lists.addFolder("/f\(index)")
    }
    #expect(lists.folders.count == RecentLists.limit)
    #expect(RecentLists(state: ["recentFolders": ["/new"], "recentRepos": ["/old"]]).folders == ["/new"])
}

@Test func initialsAndBadgeColorsMatchWelcomeModel() {
    let initials = ["storefront": "ST", "payments-api": "PA", "design-system": "DS", "myApp": "MA", "a.b": "AB",
                    "--": "?", "Über café": "ÜC", "x": "X"]
    for (name, expected) in initials {
        #expect(WelcomeList.initials(name) == expected, "\(name)")
    }
    #expect(WelcomeList.badgeColor("/w/acme/storefront") == "blue")
    #expect(WelcomeList.badgeColor("/Users/me/design-system") == "red")
    #expect(WelcomeList.badgeColor("/a\n/b") == "red")
    #expect(WelcomeList.badgeColor("é") == "cyan")
}

@Test func searchNeedsEveryWordAndKeysMoveWithinTheList() {
    let entries = RecentProjects.entries(RecentLists(folders: ["/w/acme/storefront", "/w/design-system"]))
    #expect(WelcomeList.filter(entries, query: "  ").count == 2)
    #expect(WelcomeList.filter(entries, query: "ACME store").map(\.label) == ["storefront"])
    #expect(WelcomeList.filter(entries, query: "acme design").isEmpty)
    #expect(WelcomeList.moveSelection(0, key: "ArrowUp", count: 3) == 0)
    #expect(WelcomeList.moveSelection(2, key: "ArrowDown", count: 3) == 2)
    #expect(WelcomeList.moveSelection(1, key: "End", count: 3) == 2)
    #expect(WelcomeList.moveSelection(1, key: "a", count: 3) == nil)
    #expect(WelcomeList.moveSelection(0, key: "Home", count: 0) == nil)
}
