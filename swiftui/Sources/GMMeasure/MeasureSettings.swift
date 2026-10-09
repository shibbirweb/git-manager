// gm-measure measure --screen settings and --theme: opens the Settings dialog in both apps through their own
// open_settings tools, and starts both apps with a color theme through their settings files (the current app's
// ~/.gitmanager/settings.json, the native app's ~/.gitmanager-native/settings.json, same keys).

import Foundation
import MeasureKit

extension Measure {
    /// Opens Settings on `section` and waits until the dialog is on screen.
    static func openSettings(_ app: RunningApp, section: String = "appearance") async throws {
        let opened = try await app.client.call("open_settings", ["section": section])
        if opened.isError {
            throw ToolError("\(app.kind.rawValue): could not open Settings: \(opened.text)")
        }
        guard app.kind == .current else {
            return
        }
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            let found = try await app.client.call("inspect_elements", ["selector": ".dialog .nav", "limit": 1])
            if ((found.structured ?? [:])["count"] as? Int ?? 0) > 0 {
                return
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        throw ToolError("current: the Settings dialog did not show within 5 s")
    }

    /// The settings.json values that pick `themeID` as the color theme of `mode`, the same keys in both apps.
    static func colorThemeSettings(mode: String, themeID: String?) -> [String: Any] {
        guard let themeID else {
            return [:]
        }
        return [mode == "dark" ? "darkColorTheme" : "lightColorTheme": themeID]
    }

    /// Writes the native app's ~/.gitmanager-native/settings.json in the run's throwaway HOME.
    static func writeNativeSettings(home: String, values: [String: Any]) throws {
        guard !values.isEmpty else {
            return
        }
        let folder = (home as NSString).appendingPathComponent(".gitmanager-native")
        try FileManager.default.createDirectory(atPath: folder, withIntermediateDirectories: true)
        let data = try JSONSerialization.data(withJSONObject: values, options: [.sortedKeys])
        try data.write(to: URL(fileURLWithPath: (folder as NSString).appendingPathComponent("settings.json")))
    }
}
