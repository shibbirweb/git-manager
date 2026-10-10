import Foundation
import NativeCore
import Testing

@Suite struct WindowSessionTests {
    private typealias Entry = WindowSession.Entry

    @Test func aSessionRoundTrips() {
        let entries = [
            Entry(folders: ["/a"], bounds: CGRect(x: 10, y: 20, width: 1400, height: 880)),
            Entry(folders: ["/b", "/c"], workspaceFile: "/w/team.gitmanager-workspace"),
            Entry(folders: []),
        ]
        #expect(WindowSession.parse(WindowSession.json(entries)) == entries)
    }

    @Test func malformedPartsAreDropped() {
        let value: [Any] = [
            "not a window",
            ["folders": ["/a", "", 3], "bounds": ["x": 0, "y": 0, "width": 10, "height": 10]],
            ["folders": ["/a"], "workspaceFile": " "],
            ["folders": ["/b"], "bounds": ["x": 0, "y": 0, "width": 800, "height": 600]],
        ]
        let entries = WindowSession.parse(value)
        // The second /a is the same workspace again; a window too small loses its bounds, not its folders.
        #expect(entries == [Entry(folders: ["/a"]), Entry(folders: ["/b"], bounds: CGRect(x: 0, y: 0, width: 800,
                                                                                            height: 600))])
        #expect(WindowSession.parse("windows").isEmpty)
        #expect(WindowSession.parse(nil).isEmpty)
    }

    @Test func atMostTwentyWindows() {
        let value = (0..<30).map { ["folders": ["/f\($0)"]] }
        #expect(WindowSession.parse(value).count == 20)
    }

    @Test func aFolderAtStartOrTheSettingOffNarrowsThePlan() {
        let value = WindowSession.json([
            Entry(folders: ["/a"], bounds: CGRect(x: 0, y: 0, width: 800, height: 600)),
            Entry(folders: ["/b"]),
        ])
        #expect(WindowSession.plan(value, reopenWindows: true, launchedOnFolder: true).isEmpty)
        #expect(WindowSession.plan(value, reopenWindows: true, launchedOnFolder: false).count == 2)
        #expect(WindowSession.plan(value, reopenWindows: false, launchedOnFolder: false) == [Entry(folders: ["/a"])])
    }

    @Test func aWindowMustBeGrabbableOnAScreen() {
        let screens = [CGRect(x: 0, y: 0, width: 1512, height: 982)]
        #expect(WindowSession.onScreen(CGRect(x: 100, y: 100, width: 800, height: 600), screens: screens))
        #expect(!WindowSession.onScreen(CGRect(x: 1450, y: 100, width: 800, height: 600), screens: screens))
        #expect(!WindowSession.onScreen(CGRect(x: 100, y: 970, width: 800, height: 600), screens: screens))
        #expect(!WindowSession.onScreen(CGRect(x: -3000, y: 100, width: 800, height: 600), screens: screens))
    }
}
