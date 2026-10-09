// The app's settings, like src/lib/stores/settings.svelte.ts: ~/.gitmanager-native/settings.json (never the real
// ~/.gitmanager), the same keys and rules as the current app's settings.json (SettingsData in NativeCore), saved at
// once on every change. A file that cannot be read keeps the defaults in use and is never overwritten. The Theme and
// color theme settings restyle the window live: ContentView asks `theme(for:)` on every render.

import AppKit
import NativeCore
import SwiftUI

@MainActor
final class SettingsStore: ObservableObject {
    static let shared = SettingsStore()

    @Published private(set) var preferences: NativePreferences
    /// Why settings.json could not be read; nil when it was (or there is none yet).
    @Published private(set) var loadError: String?
    @Published var dialogOpen = false
    /// The window showing the dialog: the page opens it in its own window only.
    weak var dialogWindow: WindowContext?
    @Published var dialogSection = "appearance"
    private var extra: [String: Any]
    /// The open section's scroll offset, content height and visible height (for get_state).
    var scrollMetrics: [CGFloat] = []
    private var themeCache: [String: Theme] = [:]

    /// $HOME as the process sees it, so a run with a throwaway HOME (gm-measure) reads its own file.
    static var fileURL: URL {
        let home = ProcessInfo.processInfo.environment["HOME"].flatMap { $0.isEmpty ? nil : $0 } ?? NSHomeDirectory()
        return URL(fileURLWithPath: home).appendingPathComponent(".gitmanager-native/settings.json")
    }

    /// Every generated theme as the pickers list it.
    static let themeEntries: [ThemeEntry] = Themes.all.map { tokens in
        let dark = tokens.kind == .dark || tokens.kind == .highContrastDark
        let highContrast = tokens.kind == .highContrastDark || tokens.kind == .highContrastLight
        return ThemeEntry(id: tokens.id, name: tokens.name, mode: dark ? .dark : .light, highContrast: highContrast)
    }

    private init() {
        preferences = NativePreferences()
        extra = [:]
        read()
        // `-appearance light|dark` (gm-measure) sets the Theme setting for this run, as the current app's
        // settings.json does there.
        if let launchTheme = UserDefaults.standard.string(forKey: "appearance").flatMap(ThemeSetting.init) {
            preferences.theme = launchTheme
        }
    }

    /// Reads settings.json again (the dialog's Try Again).
    func reload() {
        read()
        applyAppearance()
    }

    private func read() {
        let data = try? Data(contentsOf: Self.fileURL)
        switch SettingsData.load(data, themes: Self.themeEntries) {
        case .success(let file):
            preferences = file.preferences
            extra = file.extra
            loadError = nil
        case .failure(.unreadable(let message)):
            preferences = NativePreferences()
            extra = [:]
            loadError = message
        }
    }

    /// Changes preferences, applies them and saves.
    func update(_ change: (inout NativePreferences) -> Void) {
        var next = preferences
        change(&next)
        guard next != preferences else {
            return
        }
        preferences = next
        applyAppearance()
        save()
    }

    func setColorTheme(_ themeID: String, for mode: ColorMode) {
        let picked = SettingsData.pickThemeID(themeID, mode: mode, themes: Self.themeEntries)
        update { preferences in
            if mode == .dark {
                preferences.darkColorTheme = picked
            } else {
                preferences.lightColorTheme = picked
            }
        }
    }

    /// The header's sun button: the other one of light and dark, from what shows now.
    func toggleLightDark() {
        update { preferences in
            preferences.theme = colorMode == .dark ? .light : .dark
        }
    }

    /// Whether the dialog shows in the window of `context`.
    func dialogShown(in context: WindowContext?) -> Bool {
        dialogOpen && dialogWindow === context
    }

    func openDialog(section: String = "appearance") {
        dialogWindow = WindowContext.focused
        dialogSection = section
        dialogOpen = true
    }

    /// The light or dark mode in use.
    var colorMode: ColorMode {
        let systemDark = NSApp.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
        return SettingsData.effectiveMode(preferences.theme, systemDark: systemDark)
    }

    /// Light, Dark or System for the whole app; SwiftUI's color scheme follows, and with it `theme(for:)`.
    func applyAppearance() {
        switch preferences.theme {
        case .light:
            NSApp.appearance = NSAppearance(named: .aqua)
        case .dark:
            NSApp.appearance = NSAppearance(named: .darkAqua)
        case .system:
            NSApp.appearance = nil
        }
    }

    /// The color theme for the window's color scheme.
    func theme(for colorScheme: ColorScheme) -> Theme {
        let themeID = preferences.colorTheme(for: colorScheme == .dark ? .dark : .light)
        if let cached = themeCache[themeID] {
            return cached
        }
        let theme = Themes.all.first { $0.id == themeID }.map(Theme.init) ?? Theme.standard(for: colorScheme)
        themeCache[themeID] = theme
        return theme
    }

    /// A stored boolean the native app does not use yet, as the current app would read it.
    func storedBool(_ key: String, default fallback: Bool) -> Bool {
        SettingsData.pickBool(extra[key], fallback: fallback)
    }

    /// A stored choice the native app does not use yet, as the current app would read it.
    func storedChoice(_ key: String, _ allowed: [String], default fallback: String) -> String {
        SettingsData.pickOneOf(extra[key], allowed, fallback: fallback)
    }

    private func save() {
        guard loadError == nil else {
            return
        }
        let url = Self.fileURL
        do {
            let data = try SettingsData.data(SettingsFile(preferences: preferences, extra: extra))
            try FileManager.default.createDirectory(
                at: url.deletingLastPathComponent(), withIntermediateDirectories: true
            )
            try data.write(to: url, options: .atomic)
        } catch {
            WindowContext.focused.toasts.show(.error, "Settings could not be saved", detail: error.localizedDescription)
        }
    }
}
