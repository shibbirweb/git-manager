// Settings > Appearance, as SettingsDialog.svelte shows it. Theme works (light, dark or following macOS, live); the
// other rows show their saved values but the native app has none of those features yet, so they do not change.

import NativeCore
import SwiftUI

struct AppearanceSection: View {
    @ObservedObject var settings: SettingsStore
    let showSection: (String) -> Void

    static let themeChoices: [(setting: ThemeSetting, label: String)] = [
        (.system, "System"), (.light, "Light"), (.dark, "Dark"),
    ]
    static let fileToolbarChoices = [("top", "Top"), ("bottom", "Bottom"), ("none", "Hidden")]
    static let fileIconChoices = [("off", "No icons"), ("minimal", "Minimal"), ("material", "Material Icons")]
    /// FILE_TOOLBAR_SWITCHES in src/lib/stores/settingsData.ts.
    static let toolbarParts: [(key: String, label: String, hint: String)] = [
        ("fileToolbarBreadcrumbs", "Breadcrumbs",
         "The folders and file as a Navigation Bar. Off, Jump to Navigation Bar shows it over the editor."),
        ("fileToolbarBadges", "Badges", "Unsaved, Modified, New file and the number of conflicts."),
        ("fileToolbarChanges", "Change arrows",
         "Previous and next change with the counter. F7 and Shift+F7 work either way."),
        ("fileToolbarBlame", "Blame",
         "The button that shows who changed each line. Also Git > Current File > Annotate with Git Blame."),
        ("fileToolbarCopyPath", "Copy relative path", "Copies the file's path inside the workspace folder."),
        ("fileToolbarMarkdownView", "Markdown view switch",
         "Editor, Editor and Preview, Preview. Also in View > Markdown."),
        ("fileToolbarMarkdownFormat", "Markdown formatting row",
         "Bold, headings, lists and more above a Markdown file. It has its own row, so it shows even when the "
            + "toolbar is hidden."),
    ]

    var body: some View {
        let preferences = settings.preferences
        SettingsBlocks(blocks: [
            .row("Theme", "theme light dark system mode macos appearance") {
                SettingsRow("Theme", hintRuns: [
                    TextRun(text: "System follows the macOS appearance. Color themes are in "),
                    TextRun(text: "Editor", token: "--accent"),
                    TextRun(text: "."),
                ], control: .segmented(
                    Self.themeChoices.map(\.label),
                    selected: Self.themeChoices.firstIndex { $0.setting == preferences.theme },
                    choose: { index in settings.update { $0.theme = Self.themeChoices[index].setting } }
                ))
            },
            .row("Rounded panels", "islands corners gap radius layout") {
                SettingsRow("Rounded panels", hint: "Show the sidebars, editors and the bottom panel as rounded "
                    + "panels with space between them. Works with every color theme.",
                    control: .toggle(preferences.roundedPanels, toggle: nil))
            },
            .row("File toolbar", "path bar breadcrumbs navigation top bottom hidden") {
                SettingsRow("File toolbar", hint: "The bar with a file's path, badges and buttons: above the code, "
                    + "under it, or hidden. Pick its parts below. Without the path, Cmd+Up shows the Navigation Bar "
                    + "over the editor.", control: .segmented(
                        Self.fileToolbarChoices.map(\.1),
                        selected: Self.fileToolbarChoices.firstIndex { $0.0 == preferences.fileToolbar },
                        choose: nil
                    ))
            },
        ] + Self.toolbarParts.compactMap { part in
            guard preferences.fileToolbar != "none" || part.key == "fileToolbarMarkdownFormat" else {
                return nil
            }
            return .subRow(part.label, "file toolbar \(part.hint)") {
                SettingsRow(part.label, hint: part.hint,
                            control: .toggle(preferences.fileToolbarParts[part.key] ?? true, toggle: nil), sub: true)
            }
        } + [
            .row("Interface font size", "ui text zoom menus lists buttons") {
                SettingsRow("Interface font size", hint: "Menus, lists and buttons.", control: .range(
                    fraction: (preferences.uiFontSize - 11) / 5,
                    value: "\(Self.number(preferences.uiFontSize))px", valueWidth: 46
                ))
            },
            .row("File icons", "material minimal icon set type") {
                SettingsRow("File icons", hint: "Icons by file type in the Files panel, the Changes list and commit "
                    + "file lists. Also in View > File Icons. Minimal and Material Icons use more memory, Material "
                    + "Icons the most. An icon set loads only while it is chosen.", control: .segmented(
                        Self.fileIconChoices.map(\.1),
                        selected: Self.fileIconChoices.firstIndex { $0.0 == preferences.fileIcons },
                        choose: nil
                    ), flag: "up to +25 MB")
            },
        ])
    }

    /// 13 as "13", 13.5 as "13.5", as JavaScript prints a number.
    static func number(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }
}
