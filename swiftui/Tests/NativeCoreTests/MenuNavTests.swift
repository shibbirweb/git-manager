// The context menu's keyboard steps and placement, checked against src/lib/ui/menuNav.ts and its tests.

import CoreGraphics
import NativeCore
import Testing

private func item(_ label: String, disabled: Bool = false) -> MenuItem {
    .command(label, disabled: disabled) {}
}

private let items = [item("Open"), .separator, item("Close", disabled: true), item("Copy"), item("cut")]

@Test func stepsSkipSeparatorsAndDisabledItemsAndWrap() {
    #expect(MenuNav.firstIndex(items) == 0)
    #expect(MenuNav.lastIndex(items) == 4)
    #expect(MenuNav.stepIndex(items, from: 0, direction: 1) == 3)
    #expect(MenuNav.stepIndex(items, from: 4, direction: 1) == 0)
    #expect(MenuNav.stepIndex(items, from: 0, direction: -1) == 4)
    #expect(MenuNav.stepIndex([.separator], from: -1, direction: 1) == -1)
}

@Test func typeAheadFindsTheNextMatchIgnoringCaseAndLeadingSpaces() {
    #expect(MenuNav.matchIndex(items, from: -1, key: "c") == 3)
    #expect(MenuNav.matchIndex(items, from: 3, key: "C") == 4)
    #expect(MenuNav.matchIndex([item("   main")], from: -1, key: "m") == 0)
    #expect(MenuNav.matchIndex(items, from: -1, key: "z") == -1)
}

@Test func rootMenuStaysInsideTheWindow() {
    let viewport = CGSize(width: 1400, height: 848)
    let menu = CGSize(width: 210, height: 214)
    #expect(MenuNav.rootPosition(x: 126, y: 20, menu: menu, viewport: viewport) == CGPoint(x: 126, y: 20))
    #expect(MenuNav.rootPosition(x: 1300, y: 800, menu: menu, viewport: viewport) == CGPoint(x: 1186, y: 630))
    #expect(MenuNav.rootPosition(x: 100, y: 0, menu: menu, viewport: viewport, alignEnd: true) == CGPoint(x: 4, y: 4))
}

@Test func submenuOpensRightOfItsRowElseLeftOfTheMenu() {
    let viewport = CGSize(width: 1000, height: 800)
    let menu = CGSize(width: 200, height: 100)
    let row = CGRect(x: 100, y: 50, width: 210, height: 26)
    #expect(MenuNav.submenuPosition(row: row, menu: menu, viewport: viewport) == CGPoint(x: 308, y: 45))
    let edge = CGRect(x: 700, y: 750, width: 210, height: 26)
    #expect(MenuNav.submenuPosition(row: edge, menu: menu, viewport: viewport) == CGPoint(x: 502, y: 696))
}

@Test func pressedElementIsClickedAtItsCenterCutToWholePoints() {
    // The header's folder and repository names, as measured against the current app's menus.
    #expect(MenuNav.simulatedClickPoint(CGRect(x: 109, y: 12.5, width: 34.25, height: 16)) == CGPoint(x: 126, y: 20))
    let repoName = CGRect(x: 209.140625, y: 12.5, width: 83.171875, height: 16)
    #expect(MenuNav.simulatedClickPoint(repoName) == CGPoint(x: 250, y: 20))
}

@Test func labelsCollapseSpacesAsHTMLDoes() {
    #expect(MenuNav.shownLabel("   storefront") == "storefront")
    #expect(MenuNav.shownLabel("\u{2713} a  b ") == "\u{2713} a b")
}

@Test func repositoryMenuRowsMarkTheActiveOneAndShowPathAndChanges() {
    let nested = WorkspaceRepo(root: "/w/acme/libs/ui", name: "ui", relativePath: "libs/ui")
    let plain = WorkspaceRepo(root: "/w/acme/storefront", name: "storefront", relativePath: "storefront")
    #expect(WorkspaceRules.repoMenuRow(nested, active: true, changes: 3) == ("\u{2713} ui", "libs/ui  3"))
    #expect(WorkspaceRules.repoMenuRow(plain, active: false, changes: 0) == ("   storefront", ""))
}
