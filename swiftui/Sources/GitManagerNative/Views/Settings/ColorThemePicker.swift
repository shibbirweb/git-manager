// Settings > Editor > Color theme: one list for light mode and one for dark (ColorThemePicker.svelte), each grouped
// into its regular and high contrast themes, every theme with a swatch of its editor colors. A click picks the theme
// for that mode and the window takes it at once when that mode is in use.

import NativeCore
import SwiftUI

struct ColorThemeRow: View {
    @ObservedObject var settings: SettingsStore

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    RowTitle(text: "Color theme")
                    WrappedText(runs: [
                        TextRun(text: "One for light and one for dark mode. Light, Dark or System is set in "),
                        TextRun(text: "Appearance", token: "--accent"),
                        TextRun(text: "."),
                    ], width: settingsRowWidth)
                }
                HStack(alignment: .top, spacing: 14) {
                    ColorThemePicker(settings: settings, mode: .light)
                    ColorThemePicker(settings: settings, mode: .dark)
                }
            }
            .padding(.vertical, 12)
            RowLine()
        }
        .frame(width: settingsRowWidth)
    }
}

/// The 1-point --border line under a row.
struct RowLine: View {
    @Environment(\.theme) private var theme

    var body: some View {
        theme.color("--border").frame(height: 1)
    }
}

struct ColorThemePicker: View {
    @Environment(\.theme) private var theme
    @ObservedObject var settings: SettingsStore
    let mode: ColorMode
    /// 250 in Settings; the welcome screen's Customize page stretches it across the page.
    var width: CGFloat = 250

    var body: some View {
        let selected = settings.preferences.colorTheme(for: mode)
        let entries = SettingsStore.themeEntries.filter { $0.mode == mode }
        let groups = [
            (mode == .dark ? "Dark" : "Light", entries.filter { !$0.highContrast }),
            ("High contrast", entries.filter(\.highContrast)),
        ]
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                ExactText(text: mode == .dark ? "Dark theme" : "Light theme", size: 13, weight: .medium)
                if settings.colorMode == mode {
                    ExactText(text: "In use", size: 11)
                        .foregroundStyle(theme.ink("--accent"))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(Capsule(style: .circular).fill(theme.over("--accent", 0.15, on: "--panel")))
                }
            }
            .frame(height: 18)
            PageScroll(resetKey: mode.rawValue) {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(groups, id: \.0) { label, themes in
                        if !themes.isEmpty {
                            // 11-point text in WebKit's 13-point normal line.
                            ExactText(text: label.uppercased(), size: 11, weight: .semibold, tracking: 11 * 0.04)
                                .foregroundStyle(theme.ink("--text-dim"))
                                .frame(height: 13)
                                .padding(EdgeInsets(top: 6, leading: 6, bottom: 3, trailing: 6))
                            ForEach(themes, id: \.id) { entry in
                                option(entry, selected: entry.id == selected)
                            }
                        }
                    }
                }
                .padding(4)
            }
            .frame(width: width - 2, height: 234)
            .background(theme.color("--panel"))
            .clipShape(RoundedRectangle(cornerRadius: 5, style: .circular))
            .padding(1)
            .borderRing(theme.color("--border-strong"), cornerRadius: 6)
        }
        .frame(width: width, alignment: .leading)
    }

    private func option(_ entry: ThemeEntry, selected: Bool) -> some View {
        HStack(spacing: 8) {
            ThemeSwatch(themeID: entry.id)
            Text(entry.name)
                .font(.system(size: 13))
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 6)
        .frame(height: 28)
        .background(RoundedRectangle(cornerRadius: 5, style: .circular)
            .fill(selected ? theme.color("--selected-inactive") : Color.clear))
        .contentShape(Rectangle())
        .onTapGesture {
            settings.setColorTheme(entry.id, for: mode)
        }
    }
}

/// A theme's editor colors in 64 x 22: "fn" in its keyword color, "Aa" on its selection, and keyword, string and
/// accent bars, on its editor background with its strong border.
struct ThemeSwatch: View {
    let themeID: String

    var body: some View {
        let swatch = Themes.all.first { $0.id == themeID }.map(Theme.init) ?? Theme.standard(for: .light)
        HStack(spacing: 4) {
            HStack(spacing: 0) {
                Text("fn").foregroundStyle(swatch.ink("--tok-keyword"))
                Text(" ")
                Text("Aa")
                    .padding(.horizontal, 1)
                    .background(swatch.color("--editor-selection"))
            }
            .font(.system(size: 10, design: .monospaced))
            .foregroundStyle(swatch.ink("--text"))
            // white-space: nowrap: the sample keeps its width (a wide row once squeezed "Aa" to an ellipsis).
            .fixedSize()
            Spacer(minLength: 0)
            HStack(spacing: 2) {
                ForEach(["--tok-keyword", "--tok-string", "--accent"], id: \.self) { token in
                    RoundedRectangle(cornerRadius: 2, style: .circular)
                        .fill(swatch.color(token))
                        .frame(width: 4, height: 12)
                }
            }
        }
        .padding(.horizontal, 4)
        .frame(width: 64, height: 22)
        .background(RoundedRectangle(cornerRadius: 4, style: .circular).fill(swatch.color("--editor-bg")))
        .borderRing(swatch.color("--border-strong"), cornerRadius: 4)
    }
}
