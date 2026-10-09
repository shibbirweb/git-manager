// The welcome screen's Customize page (Welcome.svelte .page): at most 600 wide with 6 points on the right, the
// 18-point semibold title 4 points down and 22 above the fields; each field is its label left and its control
// right, at least 32 tall, 18 apart: Theme (a bordered segmented choice), the color theme picker of the mode in use
// across the page, the interface and editor font sizes (a 180-point range and the value), Rounded panels, then
// "All settings..." as a link.

import NativeCore
import SwiftUI

struct WelcomeCustomize: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var settings = SettingsStore.shared

    var body: some View {
        GeometryReader { proxy in
            let width = min(600, proxy.size.width) - 6
            VStack(alignment: .leading, spacing: 0) {
                ExactText(text: "Customize", size: 18, weight: .semibold)
                    .foregroundStyle(theme.ink("--text"))
                    .padding(.top, 4)
                    .padding(.bottom, 22)
                field("Theme") {
                    BorderedSegments(
                        labels: ["System", "Light", "Dark"],
                        selected: ["system", "light", "dark"].firstIndex(of: settings.preferences.theme.rawValue) ?? 0
                    ) { index in
                        settings.update { $0.theme = [ThemeSetting.system, .light, .dark][index] }
                    }
                }
                ColorThemePicker(settings: settings, mode: settings.colorMode, width: width)
                    .padding(.bottom, 18)
                field("Interface font size") {
                    let range = SettingsData.uiFontSizeRange
                    PageRange(value: settings.preferences.uiFontSize, range: range)
                }
                field("Editor font size") {
                    PageRange(value: settings.preferences.editorFontSize, range: SettingsData.editorFontSizeRange)
                }
                field("Rounded panels") {
                    SettingsSwitch(isOn: settings.preferences.roundedPanels) {
                        settings.update { $0.roundedPanels.toggle() }
                    }
                }
                Button {
                    settings.openDialog()
                } label: {
                    ExactText(text: "All settings...", size: 13)
                        .foregroundStyle(theme.ink("--accent"))
                }
                .buttonStyle(.plain)
                .padding(.top, 6)
            }
            .frame(width: width, alignment: .leading)
        }
    }

    private func field<Control: View>(_ label: String, @ViewBuilder control: () -> Control) -> some View {
        HStack(spacing: 20) {
            ExactText(text: label, size: 13)
                .foregroundStyle(theme.ink("--text"))
            Spacer(minLength: 0)
            control()
        }
        .frame(minHeight: 32)
        .padding(.bottom, 18)
    }
}

/// .segmented: a --border-strong ring with 6-point corners around 30-point buttons 16 points in, a line between
/// them; the chosen one on --accent in --accent-text.
private struct BorderedSegments: View {
    @Environment(\.theme) private var theme

    let labels: [String]
    let selected: Int
    let choose: (Int) -> Void

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(labels.enumerated()), id: \.offset) { index, label in
                if index > 0 {
                    theme.color("--border-strong").frame(width: 1, height: 30)
                }
                Button {
                    choose(index)
                } label: {
                    ExactText(text: label, size: 13)
                        .foregroundStyle(theme.ink(index == selected ? "--accent-text" : "--text"))
                        .padding(.horizontal, 16)
                        .frame(height: 30)
                        .background(index == selected ? theme.color("--accent") : Color.clear)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(label)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 5, style: .circular))
        .padding(1)
        .borderRing(theme.color("--border-strong"), cornerRadius: 6)
    }
}

/// .range: the range input 180 points wide (2 points of margin) and the value 10 points after it, 48 wide,
/// right-aligned in --text-dim with tabular digits. Dragging is not built yet.
private struct PageRange: View {
    @Environment(\.theme) private var theme

    let value: Double
    let range: ClosedRange<Double>

    var body: some View {
        let fraction = (value - range.lowerBound) / (range.upperBound - range.lowerBound)
        HStack(spacing: 10) {
            RangeTrack(fraction: fraction, width: 180)
            ExactText(text: "\(Self.format(value))px", size: 13, tabular: true)
                .foregroundStyle(theme.ink("--text-dim"))
                .frame(width: 48, alignment: .trailing)
        }
        .fixedSize()
    }

    /// As JavaScript prints a number: 13, 13.5.
    static func format(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }
}
