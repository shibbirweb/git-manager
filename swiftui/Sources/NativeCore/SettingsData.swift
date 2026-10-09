// The settings file's rules, as src/lib/stores/settingsData.ts has them: every loaded value is validated (a wrong
// type or an unknown choice falls back to its default, numbers are clamped), keys this app does not know are kept
// as they were so a save never drops them, and a file that is not a JSON object is an error, never overwritten.

import Foundation

public enum ThemeSetting: String, CaseIterable, Sendable {
    case system, light, dark
}

public enum ColorMode: String, Sendable {
    case light, dark
}

/// A color theme as the pickers list it (src/lib/themes/themeIndex.ts).
public struct ThemeEntry: Equatable, Sendable {
    public let id: String
    public let name: String
    public let mode: ColorMode
    public let highContrast: Bool

    public init(id: String, name: String, mode: ColorMode, highContrast: Bool) {
        self.id = id
        self.name = name
        self.mode = mode
        self.highContrast = highContrast
    }
}

/// The preferences the native app reads and writes; the rest of settings.json stays in `SettingsFile.extra`.
public struct NativePreferences: Equatable, Sendable {
    public var theme = ThemeSetting.system
    public var lightColorTheme = SettingsData.defaultLightTheme
    public var darkColorTheme = SettingsData.defaultDarkTheme
    public var uiFontSize = 13.0
    public var editorFontSize = 13.0
    public var fileIcons = "off"
    public var roundedPanels = false
    public var fileToolbar = "top"
    /// The file toolbar's part switches (FILE_TOOLBAR_SWITCHES), each on by default.
    public var fileToolbarParts: [String: Bool] = Dictionary(
        uniqueKeysWithValues: SettingsData.fileToolbarSwitchKeys.map { ($0, true) }
    )
    public var commitBoxLayout = "single"
    /// The blame gutter beside the code (the file bar's Blame button switches it).
    public var blameGutter = false

    public init() {}

    public func colorTheme(for mode: ColorMode) -> String {
        mode == .dark ? darkColorTheme : lightColorTheme
    }
}

/// settings.json as loaded: the validated preferences and every other key as it was.
public struct SettingsFile {
    public var preferences: NativePreferences
    public var extra: [String: Any]

    public init(preferences: NativePreferences = NativePreferences(), extra: [String: Any] = [:]) {
        self.preferences = preferences
        self.extra = extra
    }
}

public enum SettingsData {
    public static let defaultLightTheme = "gm-light"
    public static let defaultDarkTheme = "gm-dark"
    public static let uiFontSizeRange = 11.0...16.0
    public static let editorFontSizeRange = 10.0...20.0
    public static let fileIconModes = ["off", "minimal", "material"]
    public static let fileToolbarPlacements = ["top", "bottom", "none"]
    public static let commitBoxLayouts = ["single", "perRepo"]
    public static let fileToolbarSwitchKeys = [
        "fileToolbarBreadcrumbs", "fileToolbarBadges", "fileToolbarChanges", "fileToolbarBlame",
        "fileToolbarCopyPath", "fileToolbarMarkdownView", "fileToolbarMarkdownFormat",
    ]
    /// The keys `NativePreferences` owns.
    public static let knownKeys: Set<String> = Set([
        "theme", "lightColorTheme", "darkColorTheme", "uiFontSize", "editorFontSize", "fileIcons", "roundedPanels",
        "fileToolbar", "commitBoxLayout", "blameGutter",
    ] + fileToolbarSwitchKeys)

    public enum LoadError: Error, Equatable {
        /// The text is not JSON, or not a JSON object: the message says why.
        case unreadable(String)
    }

    /// Reads a settings.json text. Nil data (no file yet) gives the defaults.
    public static func load(_ data: Data?, themes: [ThemeEntry]) -> Result<SettingsFile, LoadError> {
        guard let data else {
            return .success(SettingsFile())
        }
        let value: Any
        do {
            value = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        } catch {
            return .failure(.unreadable("settings.json is not valid JSON: \(error.localizedDescription)"))
        }
        guard let object = value as? [String: Any] else {
            return .failure(.unreadable("settings.json does not hold a JSON object"))
        }
        return .success(parse(object, themes: themes))
    }

    /// Validates an object read from settings.json, as parsePreferences does.
    public static func parse(_ object: [String: Any], themes: [ThemeEntry]) -> SettingsFile {
        var preferences = NativePreferences()
        let defaults = preferences
        preferences.theme = (object["theme"] as? String).flatMap(ThemeSetting.init(rawValue:)) ?? defaults.theme
        preferences.lightColorTheme = pickThemeID(object["lightColorTheme"], mode: .light, themes: themes)
        preferences.darkColorTheme = pickThemeID(object["darkColorTheme"], mode: .dark, themes: themes)
        preferences.uiFontSize = pickNumber(object["uiFontSize"], fallback: defaults.uiFontSize, in: uiFontSizeRange)
        preferences.editorFontSize = pickNumber(
            object["editorFontSize"], fallback: defaults.editorFontSize, in: editorFontSizeRange
        )
        preferences.fileIcons = pickOneOf(object["fileIcons"], fileIconModes, fallback: defaults.fileIcons)
        preferences.roundedPanels = pickBool(object["roundedPanels"], fallback: defaults.roundedPanels)
        preferences.fileToolbar = pickOneOf(
            object["fileToolbar"], fileToolbarPlacements, fallback: defaults.fileToolbar
        )
        for key in fileToolbarSwitchKeys {
            preferences.fileToolbarParts[key] = pickBool(object[key], fallback: true)
        }
        preferences.commitBoxLayout = pickOneOf(
            object["commitBoxLayout"], commitBoxLayouts, fallback: defaults.commitBoxLayout
        )
        preferences.blameGutter = pickBool(object["blameGutter"], fallback: defaults.blameGutter)
        let extra = object.filter { !knownKeys.contains($0.key) }
        return SettingsFile(preferences: preferences, extra: extra)
    }

    /// The object to write: the other keys as they were, then the native preferences.
    public static func object(_ file: SettingsFile) -> [String: Any] {
        var object = file.extra
        let preferences = file.preferences
        object["theme"] = preferences.theme.rawValue
        object["lightColorTheme"] = preferences.lightColorTheme
        object["darkColorTheme"] = preferences.darkColorTheme
        object["uiFontSize"] = preferences.uiFontSize
        object["editorFontSize"] = preferences.editorFontSize
        object["fileIcons"] = preferences.fileIcons
        object["roundedPanels"] = preferences.roundedPanels
        object["fileToolbar"] = preferences.fileToolbar
        for key in fileToolbarSwitchKeys {
            object[key] = preferences.fileToolbarParts[key] ?? true
        }
        object["commitBoxLayout"] = preferences.commitBoxLayout
        object["blameGutter"] = preferences.blameGutter
        return object
    }

    /// Pretty JSON with sorted keys, so hand edits and diffs stay readable.
    public static func data(_ file: SettingsFile) throws -> Data {
        try JSONSerialization.data(withJSONObject: object(file), options: [.prettyPrinted, .sortedKeys])
    }

    /// A saved theme id for `mode`'s picker: unknown ids and themes of the other mode fall back to the default.
    public static func pickThemeID(_ value: Any?, mode: ColorMode, themes: [ThemeEntry]) -> String {
        if let themeID = value as? String, let theme = themes.first(where: { $0.id == themeID }), theme.mode == mode {
            return theme.id
        }
        return mode == .dark ? defaultDarkTheme : defaultLightTheme
    }

    /// The light or dark mode in use: the Theme setting, or macOS's appearance with System.
    public static func effectiveMode(_ setting: ThemeSetting, systemDark: Bool) -> ColorMode {
        switch setting {
        case .system:
            return systemDark ? .dark : .light
        case .light:
            return .light
        case .dark:
            return .dark
        }
    }

    public static func pickBool(_ value: Any?, fallback: Bool) -> Bool {
        // JSONSerialization gives NSNumber for both booleans and numbers; only a real boolean counts.
        guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else {
            return fallback
        }
        return number.boolValue
    }

    public static func pickNumber(_ value: Any?, fallback: Double, in range: ClosedRange<Double>) -> Double {
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
              number.doubleValue.isFinite else {
            return fallback
        }
        return min(range.upperBound, max(range.lowerBound, number.doubleValue))
    }

    public static func pickOneOf(_ value: Any?, _ allowed: [String], fallback: String) -> String {
        guard let text = value as? String, allowed.contains(text) else {
            return fallback
        }
        return text
    }
}
