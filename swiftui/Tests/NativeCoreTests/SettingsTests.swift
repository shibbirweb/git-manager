// The settings file's validation, the Settings search and the line breaking, checked against what
// src/lib/stores/settingsData.ts and src/lib/views/settings/settingsSearch.ts decide.

import Foundation
import NativeCore
import Testing

private let themes = [
    ThemeEntry(id: "gm-light", name: "Git Manager Light", mode: .light, highContrast: false),
    ThemeEntry(id: "github-light", name: "GitHub Light", mode: .light, highContrast: false),
    ThemeEntry(id: "gm-dark", name: "Git Manager Dark", mode: .dark, highContrast: false),
    ThemeEntry(id: "monokai-charcoal", name: "Monokai Charcoal", mode: .dark, highContrast: false),
    ThemeEntry(id: "high-contrast-dark", name: "High Contrast Dark", mode: .dark, highContrast: true),
]

private func load(_ json: String) -> Result<SettingsFile, SettingsData.LoadError> {
    SettingsData.load(Data(json.utf8), themes: themes)
}

@Test func missingFileGivesTheDefaults() throws {
    let file = try SettingsData.load(nil, themes: themes).get()
    #expect(file.preferences == NativePreferences())
    #expect(file.preferences.theme == .system)
    #expect(file.preferences.colorTheme(for: .dark) == "gm-dark")
}

@Test func validValuesAreKept() throws {
    let file = try load("""
        {"theme": "dark", "darkColorTheme": "monokai-charcoal", "lightColorTheme": "github-light",
         "uiFontSize": 14.5, "fileIcons": "material", "roundedPanels": true, "fileToolbar": "none",
         "fileToolbarBlame": false, "commitBoxLayout": "perRepo"}
        """).get()
    let preferences = file.preferences
    #expect(preferences.theme == .dark)
    #expect(preferences.darkColorTheme == "monokai-charcoal")
    #expect(preferences.lightColorTheme == "github-light")
    #expect(preferences.uiFontSize == 14.5)
    #expect(preferences.fileIcons == "material")
    #expect(preferences.roundedPanels)
    #expect(preferences.fileToolbar == "none")
    #expect(preferences.fileToolbarParts["fileToolbarBlame"] == false)
    #expect(preferences.fileToolbarParts["fileToolbarBadges"] == true)
    #expect(preferences.commitBoxLayout == "perRepo")
}

@Test func wrongValuesFallBackToDefaults() throws {
    let file = try load("""
        {"theme": "blue", "darkColorTheme": "github-light", "lightColorTheme": "nope", "uiFontSize": 99,
         "fileIcons": 3, "roundedPanels": 1, "fileToolbar": "left", "fileToolbarBadges": "yes",
         "commitBoxLayout": null}
        """).get()
    let preferences = file.preferences
    #expect(preferences.theme == .system)
    // A theme of the other mode is not taken.
    #expect(preferences.darkColorTheme == "gm-dark")
    #expect(preferences.lightColorTheme == "gm-light")
    #expect(preferences.uiFontSize == 16)
    #expect(preferences.fileIcons == "off")
    // 1 is a number, not a boolean.
    #expect(!preferences.roundedPanels)
    #expect(preferences.fileToolbar == "top")
    #expect(preferences.fileToolbarParts["fileToolbarBadges"] == true)
    #expect(preferences.commitBoxLayout == "single")
    #expect(try load("{\"uiFontSize\": 2}").get().preferences.uiFontSize == 11)
}

@Test func unreadableFilesAreErrors() {
    #expect(throws: SettingsData.LoadError.self) { try load("{\"theme\": ").get() }
    #expect(throws: SettingsData.LoadError.self) { try load("[1, 2]").get() }
    #expect(throws: SettingsData.LoadError.self) { try load("\"dark\"").get() }
}

@Test func otherKeysSurviveASave() throws {
    var file = try load("{\"editorFontSize\": 15, \"keybindings\": {\"a\": \"b\"}, \"theme\": \"light\"}").get()
    #expect(file.extra["theme"] == nil)
    file.preferences.darkColorTheme = "monokai-charcoal"
    let object = SettingsData.object(file)
    #expect(object["editorFontSize"] as? Int == 15)
    #expect((object["keybindings"] as? [String: String])?["a"] == "b")
    #expect(object["theme"] as? String == "light")
    #expect(object["darkColorTheme"] as? String == "monokai-charcoal")
    let again = try SettingsData.load(SettingsData.data(file), themes: themes).get()
    #expect(again.preferences == file.preferences)
}

@Test func modeFollowsTheThemeSetting() {
    #expect(SettingsData.effectiveMode(.system, systemDark: true) == .dark)
    #expect(SettingsData.effectiveMode(.system, systemDark: false) == .light)
    #expect(SettingsData.effectiveMode(.light, systemDark: true) == .light)
    #expect(SettingsData.effectiveMode(.dark, systemDark: false) == .dark)
    #expect(SettingsData.pickThemeID("high-contrast-dark", mode: .dark, themes: themes) == "high-contrast-dark")
}

@Test func searchMatchesWordStarts() {
    #expect(SettingsSearch.words("Cmd+E  cmd") == ["cmd", "e"])
    #expect(SettingsSearch.matches("Rounded panels", ["pan", "round"]))
    #expect(!SettingsSearch.matches("Rounded panels", ["anels"]))
    #expect(!SettingsSearch.matches("Rounded panels", []))
    let index = [
        SettingsSearchEntry(section: "appearance", label: "Theme", keywords: "light dark system"),
        SettingsSearchEntry(section: "editor", label: "Color theme", keywords: "colour scheme"),
        SettingsSearchEntry(section: "terminal", label: "Font size"),
    ]
    let labels = ["appearance": "Appearance", "editor": "Editor", "terminal": "Terminal"]
    let found = SettingsSearch.matchingEntries(["theme"], sectionLabels: labels, index: index)
    #expect(found.map(\.label) == ["Theme", "Color theme"])
    #expect(SettingsSearch.matchingEntries(["term", "font"], sectionLabels: labels, index: index).count == 1)
    #expect(SettingsSearch.highlightRanges("Color theme", ["th", "theme"]) == [6..<11])
}

@Test func searchKeepsGroupsWithVisibleRows() {
    let visible = SettingsSearch.visibleBlocks([
        (.group, false), (.hint, false), (.row, true), (.subRow, false),
        (.group, false), (.row, false), (.other, false),
        (.group, true), (.row, false),
    ])
    #expect(visible == [true, true, true, true, false, false, false, true, true])
}

@Test func linesBreakAtSpacesLikeWebKit() {
    // Every character 1 point wide.
    let measure = { (text: String) in Double(text.count) }
    #expect(TextWrap.lines("one two three", width: 7, measure: measure) == ["one two", "three"])
    #expect(TextWrap.lines("one two three", width: 6.9, measure: measure) == ["one", "two", "three"])
    #expect(TextWrap.lines("unbreakable word", width: 4, measure: measure) == ["unbreakable", "word"])
    #expect(TextWrap.lines("", width: 10, measure: measure).isEmpty)
}

@Test func shadowFadesOutsideTheBox() {
    let box = ShadowBox(x: 100, y: 100, width: 200, height: 120, radius: 24)
    let sigma = ShadowMask.sigma(blur: 28, scale: 2)
    #expect(abs(sigma - 27.8) < 0.01)
    #expect(ShadowMask.reach(sigma: sigma) == 80)
    let width = 400, height = 340
    let bytes = ShadowMask.alphaBytes(box: box, offsetY: 16, sigma: sigma, alpha: 0.16,
                                      regionX: 0, regionY: 0, width: width, height: height)
    let at = { (column: Int, row: Int) in Int(bytes[row * width + column]) }
    // Nothing under the box, the most just outside it, fading to nothing past the reach.
    #expect(at(200, 160) == 0)
    #expect(at(99, 160) > at(70, 160))
    #expect(at(99, 160) <= 21)
    #expect(at(15, 160) == 0)
    // Left and right are mirror images; below is darker than above (the offset).
    #expect(at(99, 160) == at(300, 160))
    #expect(at(200, 221) > at(200, 98))
}
