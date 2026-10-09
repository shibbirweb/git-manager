// The window's side of open_settings and close_dialog (bridge/src/control/dialog_tools.rs), and the Settings part of
// get_state: whether the dialog is open, its section and the settings in use.

import Foundation

extension Control {
    static func settings(_ action: String, _ args: [String: Any]) -> String {
        if action == "open_settings" {
            let section = args["section"] as? String ?? "appearance"
            onMain { SettingsStore.shared.openDialog(section: section) }
            return reply(ok: true, structured: ["section": section])
        }
        onMain { SettingsStore.shared.dialogOpen = false }
        return reply(ok: true, structured: onMain { settingsState() })
    }

    @MainActor
    static func settingsState() -> [String: Any] {
        let settings = SettingsStore.shared
        let preferences = settings.preferences
        return [
            "dialog": settings.dialogOpen ? ["kind": "settings", "section": settings.dialogSection] : NSNull(),
            "theme": preferences.theme.rawValue,
            "colorMode": settings.colorMode.rawValue,
            "colorTheme": preferences.colorTheme(for: settings.colorMode),
            "settingsError": orNull(settings.loadError),
            "settingsScroll": settings.scrollMetrics,
        ]
    }
}
