// The tab rules of src/lib/stores/tabs.ts (tabs.test.ts covers the same cases in the current app).

import NativeCore
import Testing

@Test func aSingleClickReplacesThePreviewTab() {
    var tabs = EditorTabs()
    tabs.open("/r/a.ts", pin: false)
    tabs.open("/r/b.ts", pin: false)
    #expect(tabs.tabs == [FileTab(path: "/r/b.ts", preview: true)])
    #expect(tabs.active == "/r/b.ts")
}

@Test func anOpenThatKeepsAddsAfterTheActiveTab() {
    var tabs = EditorTabs()
    tabs.open("/r/a.ts", pin: true)
    tabs.open("/r/c.ts", pin: true)
    tabs.activate("/r/a.ts")
    tabs.open("/r/b.ts", pin: true)
    #expect(tabs.tabs.map(\.path) == ["/r/a.ts", "/r/b.ts", "/r/c.ts"])
    // Opening a preview tab again with pin keeps it.
    tabs.open("/r/d.ts", pin: false)
    tabs.open("/r/d.ts", pin: true)
    #expect(tabs.tabs.allSatisfy { !$0.preview })
}

@Test func aDoubleClickKeepsThePreviewTab() {
    var tabs = EditorTabs()
    tabs.open("/r/a.ts", pin: false)
    tabs.keep("/r/a.ts")
    tabs.open("/r/b.ts", pin: false)
    #expect(tabs.tabs.map(\.path) == ["/r/a.ts", "/r/b.ts"])
}

@Test func closingTheActiveTabMovesRightThenLeft() {
    var tabs = EditorTabs()
    for name in ["a", "b", "c"] {
        tabs.open("/r/\(name).ts", pin: true)
    }
    tabs.activate("/r/b.ts")
    tabs.close(["/r/b.ts"])
    #expect(tabs.active == "/r/c.ts")
    tabs.close(["/r/c.ts"])
    #expect(tabs.active == "/r/a.ts")
    tabs.close(["/r/a.ts"])
    #expect(tabs.active == nil)
    #expect(tabs.tabs.isEmpty)
}

@Test func closingAnotherTabKeepsTheActiveOne() {
    var tabs = EditorTabs()
    tabs.open("/r/a.ts", pin: true)
    tabs.open("/r/b.ts", pin: true)
    tabs.close(["/r/a.ts"])
    #expect(tabs.active == "/r/b.ts")
}

@Test func labelsAddTheFolderOnlyForSameNames() {
    let labels = EditorTabs.labels([
        FileTab(path: "/r/src/index.ts", preview: false),
        FileTab(path: "/r/lib/index.ts", preview: false),
        FileTab(path: "/r/src/cart.ts", preview: false),
    ])
    #expect(labels["/r/src/index.ts"]?.name == "index.ts")
    #expect(labels["/r/src/index.ts"]?.hint == "src")
    #expect(labels["/r/lib/index.ts"]?.hint == "lib")
    #expect(labels["/r/src/cart.ts"]?.hint == nil)
}
