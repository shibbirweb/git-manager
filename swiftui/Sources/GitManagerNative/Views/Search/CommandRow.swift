// A Command Palette row (QuickOpen.svelte's command row): "Category:" in --text-dim and the title in --text as one
// line, the check of a check item in --accent, why a disabled command cannot run (italic, 12 points), and its keys
// in a <kbd>: 11.5 points on --panel-alt with a --border-strong ring, 6 points of padding, 20 tall. A disabled row
// shows its title and keys in --text-faint.

import NativeCore
import SwiftUI

struct CommandRow: View {
    @Environment(\.theme) private var theme

    let command: PaletteItem
    let selected: Bool

    var body: some View {
        PopupRowFrame(selected: selected) {
            HStack(spacing: 0) {
                PartsText(parts: command.categoryParts + [TextPart(text: ":", match: false)], color: "--text-dim")
                PartsText(parts: [TextPart(text: " ", match: false)] + command.titleParts,
                          color: command.enabled ? "--text" : "--text-faint")
            }
            Spacer(minLength: 0)
            if command.checked == true {
                Icon(name: "check", size: 13)
                    .foregroundStyle(theme.ink("--accent"))
            }
            if !command.enabled, let reason = command.reason {
                Text(reason)
                    .font(Font(NSFontManager.shared.convert(PageFont.ui(12), toHaveTrait: .italicFontMask)))
                    .foregroundStyle(theme.ink("--text-faint"))
                    .lineLimit(1)
            }
            if let shortcut = command.shortcut {
                KeyCaps(text: shortcut, color: command.enabled ? "--text-dim" : "--text-faint")
            }
        }
    }
}

/// A <kbd>: the keys in 11.5 points on --panel-alt, in a 20-point box with 4-point corners.
struct KeyCaps: View {
    @Environment(\.theme) private var theme

    let text: String
    var color = "--text-dim"
    var mono = false

    var body: some View {
        ExactText(text: text, size: 11.5)
            .foregroundStyle(theme.ink(color))
            .offset(y: 0.5)
            .padding(.horizontal, 7)
            .frame(height: 20)
            .background(RoundedRectangle(cornerRadius: 4, style: .circular).fill(theme.color("--panel-alt")))
            .borderRing(theme.color("--border-strong"), cornerRadius: 4)
    }
}
