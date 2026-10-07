// Small controls shared by the header, the activity bars and the status bar, sized like the current app's CSS
// (.icon-btn, .pill, .divider, the status bar's .item) as the layout snapshots in swiftui/Reference record them.

import SwiftUI

/// A borderless button with an icon: 28 x 28 with 6-point corners in the header (.icon-btn).
struct IconButton<Label: View>: View {
    var width: CGFloat = 28
    var height: CGFloat = 28
    var cornerRadius: CGFloat = 6
    var disabled = false
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: action) {
            label()
                .frame(width: width, height: height)
                .contentShape(RoundedRectangle(cornerRadius: cornerRadius))
        }
        .buttonStyle(.plain)
        // The current app's .icon-btn:disabled is 40% opacity. SwiftUI's .disabled() would dim the button once
        // more on top of that, so clicks are blocked without it.
        .allowsHitTesting(!disabled)
        .opacity(disabled ? 0.4 : 1)
    }
}

/// The header's folder and branch buttons (.pill): 28 points tall, 8 points of padding, 6 between the parts.
struct PillButton<Label: View>: View {
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                label()
            }
            .padding(.horizontal, 8)
            .frame(height: 28)
            .contentShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
    }
}

/// The header's 1 x 18 separator, with 4 points of space on each side (.divider).
struct HeaderDivider: View {
    @Environment(\.theme) private var theme

    var body: some View {
        theme.color("--border-strong")
            .frame(width: 1, height: 18)
            .padding(.horizontal, 4)
    }
}
