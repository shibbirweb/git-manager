// The Settings sections as data (most of them shown, not changed yet): each row's title, hint and control as
// SettingsDialog.svelte has them, with the value from settings.json (validated like the current app) or its default.
// Hints that the page fills in at run time show their default text. The rows are SettingsCatalogData*.swift.

import NativeCore
import SwiftUI

enum CatalogItem {
    case group(String)
    /// A switch: settings.json key and default.
    case toggle(String, String, key: String, on: Bool, sub: Bool = false)
    /// A segmented choice: labels, the values they stand for, the key and the default value.
    case choice(String, String, labels: [String], values: [String], key: String, value: String, sub: Bool = false)
    /// A slider at a fraction of its range, with the value as the page prints it.
    case range(String, String, fraction: Double, value: String, valueWidth: CGFloat = 46)
    case field(String, String, StaticField.Kind, String, sub: Bool = false)
    /// A title and hint with a control the native app does not draw yet (a list, an editor, a preview).
    case text(String, String)
    /// Settings > GitHub's account row: the title and hint, then the sign-in form or the account (.row.stacked).
    case githubAccount(String, String)
    /// A row its section draws itself (Settings > Automation), found by its title.
    case custom(String, AnyView)
}

@MainActor
enum SettingsCatalog {
    static func items(_ section: String) -> [CatalogItem] {
        switch section {
        case "editor":
            return SettingsCatalogData.editor
        case "merge":
            return SettingsCatalogData.git
        case "layout":
            return SettingsCatalogData.layout
        case "terminal":
            return SettingsCatalogData.terminal
        case "github":
            return SettingsCatalogData.github
        case "automation":
            return AutomationRows.items()
        case "updates":
            return SettingsCatalogData.updates
        case "files":
            return SettingsCatalogData.files
        case "about":
            return SettingsCatalogData.about
        case "keyboard":
            return [.text("Keyboard Shortcuts", "Every command with its keys. Not in the native app yet.")]
        default:
            return []
        }
    }

    /// The items as blocks, values read from `settings`.
    /// Toggles the native app acts on: switching them saves settings.json.
    static let workingToggles: Set<String> = [WindowSession.reopenSetting, McpServerStore.mcpKey,
                                               McpServerStore.cliKey]

    static func blocks(_ items: [CatalogItem], section: String, settings: SettingsStore) -> [SettingsBlock] {
        var firstGroup = true
        return items.map { item in
            let keywords = { (label: String) in SettingsSearchIndex.keywords(section: section, label: label) }
            switch item {
            case .group(let title):
                defer { firstGroup = false }
                return .group(title, keywords(title), first: firstGroup && isFirst(item, in: items))
            case .toggle(let title, let hint, let key, let on, let sub):
                let isOn = settings.storedBool(key, default: on)
                // The rows the native app acts on can be switched; the others show what settings.json holds.
                let toggle = workingToggles.contains(key) ? { switchSetting(key, !isOn, settings: settings) } : nil
                let row = SettingsRow(title, hint: hint, control: .toggle(isOn, toggle: toggle), sub: sub)
                return sub ? .subRow(title, keywords(title)) { row } : .row(title, keywords(title)) { row }
            case .choice(let title, let hint, let labels, let values, let key, let value, let sub):
                let stored = settings.storedChoice(key, values, default: value)
                let row = SettingsRow(title, hint: hint, control: .segmented(
                    labels, selected: values.firstIndex(of: stored), choose: nil
                ), sub: sub)
                return sub ? .subRow(title, keywords(title)) { row } : .row(title, keywords(title)) { row }
            case .range(let title, let hint, let fraction, let value, let valueWidth):
                return .row(title, keywords(title)) {
                    SettingsRow(title, hint: hint, control: .range(fraction: fraction, value: value,
                                                                   valueWidth: valueWidth))
                }
            case .field(let title, let hint, let kind, let text, let sub):
                let row = SettingsRow(title, hint: hint, control: .field(kind, text), sub: sub)
                return sub ? .subRow(title, keywords(title)) { row } : .row(title, keywords(title)) { row }
            case .text(let title, let hint):
                return .row(title, keywords(title)) {
                    SettingsRow(title, hint: hint)
                }
            case .githubAccount(let title, let hint):
                return .row(title, keywords(title)) {
                    SettingsRow(title, hint: hint, below: AnyView(GitHubAccountForm()))
                }
            case .custom(let title, let view):
                return .row(title, keywords(title)) {
                    view
                }
            }
        }
    }

    /// The MCP server and command line tool switches also start or stop the server.
    private static func switchSetting(_ key: String, _ isOn: Bool, settings: SettingsStore) {
        if key == McpServerStore.mcpKey || key == McpServerStore.cliKey {
            McpServerStore.shared.setSwitch(key, isOn)
        } else {
            settings.setStoredBool(key, isOn)
        }
    }

    private static func isFirst(_ item: CatalogItem, in items: [CatalogItem]) -> Bool {
        if case .group(let title) = item, case .group(let firstTitle)? = items.first {
            return title == firstTitle
        }
        return false
    }
}
