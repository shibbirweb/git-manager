import Foundation
import NativeCore
import Testing

@Suite struct WindowOwnershipTests {
    private typealias Shown = WindowOwnership.Shown

    @Test func aFolderBelongsToTheWindowShowingIt() {
        let windows = [Shown(folders: ["/a"]), Shown(folders: ["/b", "/c"])]
        #expect(WindowOwnership.owner(of: Shown(folders: ["/c"]), in: windows) == 1)
        #expect(WindowOwnership.owner(of: Shown(folders: ["/d"]), in: windows) == nil)
    }

    @Test func severalFoldersNeedTheSameSet() {
        let windows = [Shown(folders: ["/a", "/b", "/c"]), Shown(folders: ["/c", "/b"])]
        #expect(WindowOwnership.owner(of: Shown(folders: ["/b", "/c"]), in: windows) == 1)
        #expect(WindowOwnership.owner(of: Shown(folders: ["/a", "/b"]), in: windows) == nil)
    }

    @Test func aWorkspaceFileBelongsToTheWindowShowingThatFile() {
        let windows = [Shown(folders: ["/a"]), Shown(folders: ["/a"], workspaceFile: "/w/team.gitmanager-workspace")]
        let wanted = Shown(folders: [], workspaceFile: "/w/team.gitmanager-workspace")
        #expect(WindowOwnership.owner(of: wanted, in: windows) == 1)
        #expect(WindowOwnership.owner(of: Shown(folders: []), in: windows) == nil)
    }

    @Test func foldersAreKeptOnce() {
        #expect(Shown(folders: ["/a", "/a", "/b"]).folders == ["/a", "/b"])
    }

    @Test func newWindowsCascade() {
        #expect(WindowOwnership.cascade(from: CGPoint(x: 100, y: 50)) == CGPoint(x: 128, y: 78))
    }
}
