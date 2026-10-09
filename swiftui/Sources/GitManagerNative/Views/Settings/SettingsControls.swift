// The Settings dialog's controls, sized from SettingsDialog.svelte's CSS and the layout snapshots
// (swiftui/Reference/settings-*): the switch (.switch), the segmented choice (.segmented), the slider (.range) and the
// read-only stand-ins for the controls the native app does not have yet (a select, a text field, a small button).
// `enabled: false` keeps a control's look and ignores clicks.

import AppKit
import SwiftUI

/// 34 x 20, a 16-point white knob 2 points in; --accent when on, --border-strong when off.
struct SettingsSwitch: View {
    @Environment(\.theme) private var theme

    let isOn: Bool
    var enabled = true
    var toggle: () -> Void = {}

    var body: some View {
        ZStack(alignment: .leading) {
            Capsule(style: .circular)
                .fill(theme.color(isOn ? "--accent" : "--border-strong"))
            Circle()
                .fill(Color(nsColor: Theme.parse("#ffffff") ?? .white))
                .frame(width: 16, height: 16)
                .boxShadow(radius: 8, offsetY: 1, blur: 2, alpha: 0.25)
                .offset(x: isOn ? 16 : 2)
        }
        .frame(width: 34, height: 20)
        .contentShape(Rectangle())
        .onTapGesture {
            if enabled {
                toggle()
            }
        }
    }
}

/// A row of choices in a 7-point rounded box (--panel-alt, 2 points of padding); the chosen one is --panel with a
/// small shadow, the others --text-dim. Each choice is its text's exact width plus 12 points on each side.
struct SegmentedChoice: View {
    @Environment(\.theme) private var theme

    let labels: [String]
    let selected: Int?
    var enabled = true
    var choose: (Int) -> Void = { _ in }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(labels.enumerated()), id: \.offset) { index, label in
                let on = index == selected
                ExactText(text: label, size: 13)
                    .foregroundStyle(theme.ink(on ? "--text" : "--text-dim"))
                    .padding(.horizontal, 12)
                    .frame(height: 24)
                    .background {
                        if on {
                            Color.clear.snappedBox(theme.color("--panel"), cornerRadius: 5,
                                                   shadow: (offsetY: 1, blur: 2, alpha: 0.14))
                        }
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        if enabled {
                            choose(index)
                        }
                    }
            }
        }
        .padding(3)
        // The border and background go under the choices: the chosen one's shadow falls over the border.
        .snappedBox(theme.color("--panel-alt"), cornerRadius: 7, border: theme.color("--border-strong"))
        .fixedSize()
    }
}

/// WebKit's range input (160 x 16, 2 points of margin) and the value after it in 12-point mono, 46 wide.
struct RangeReadout: View {
    @Environment(\.theme) private var theme

    let fraction: Double
    let value: String
    var valueWidth: CGFloat = 46

    var body: some View {
        HStack(spacing: 10) {
            ZStack(alignment: .leading) {
                Capsule(style: .circular)
                    .fill(theme.color("--border-strong"))
                    .frame(height: 4)
                Capsule(style: .circular)
                    .fill(theme.color("--accent"))
                    .frame(width: max(4, 160 * fraction), height: 4)
                Circle()
                    .fill(Color.white)
                    .frame(width: 16, height: 16)
                    .boxShadow(radius: 8, offsetY: 1, blur: 2, alpha: 0.25)
                    .offset(x: (160 - 16) * fraction)
            }
            .frame(width: 160, height: 16)
            .padding(2)
            Text(value)
                .font(.system(size: 12, design: .monospaced))
                .frame(width: valueWidth, alignment: .trailing)
        }
        .fixedSize()
    }
}

/// A select, a text field or a small button as the page shows it, without the behavior yet.
struct StaticField: View {
    enum Kind {
        case select, input, button, dangerButton
    }

    @Environment(\.theme) private var theme

    let kind: Kind
    let text: String

    var body: some View {
        HStack(spacing: 6) {
            Text(text)
                .font(Font(PageFont.ui(12)))
                .foregroundStyle(theme.ink(kind == .dangerButton ? "--danger" : "--text"))
                .lineLimit(1)
            if kind == .select {
                Icon(name: "chevron-down", size: 12)
            }
        }
        .padding(.horizontal, 8)
        .frame(minWidth: kind == .input ? 120 : nil, minHeight: 26, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 6, style: .circular).fill(theme.color("--panel")))
        .borderRing(theme.color("--border-strong"), cornerRadius: 6)
        .fixedSize()
    }
}
