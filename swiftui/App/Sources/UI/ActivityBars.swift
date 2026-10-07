// The activity bars (src/lib/views/ActivityBar.svelte, RightActivityBar.svelte), measured in
// swiftui/Reference/<screen>-<mode>/activity-bars.json: 36 x 36 items with 8-point corners, 2 apart, 4 from the
// edges and 6 from the top; the active one in the accent color on a 12% accent background; a 22-point separator.

import SwiftUI

struct ActivityItem: View {
    @Environment(\.theme) private var theme

    let icon: String
    var iconSize: CGFloat = 19
    var active = false
    var badge: Int?

    var body: some View {
        Button(action: {}) {
            ZStack(alignment: .topLeading) {
                Icon(name: icon, size: iconSize, strokeWidth: 1.8)
                    .frame(width: 36, height: 36)
                if let badge, badge > 0 {
                    // .badge: 16 points tall, 10-point semibold white text on the accent color, 19 x 17 in.
                    Text("\(badge)")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.white)
                        .padding(.horizontal, 4)
                        .frame(minWidth: 16, minHeight: 16)
                        .background(Capsule().fill(theme.color("--accent")))
                        .offset(x: 19, y: 17)
                }
            }
            .frame(width: 36, height: 36)
            .foregroundStyle(active ? theme.color("--accent") : theme.color("--text-dim"))
            .background(RoundedRectangle(cornerRadius: 8).fill(activeFill))
            .contentShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    /// The accent at 12% over the bar, as one solid color the way WebKit blends it.
    private var activeFill: Color {
        active ? theme.over("--accent", 0.12, on: "--panel-alt") : .clear
    }
}

/// Changes (with its count), Branches, a separator and History at the top; Run and Terminal at the bottom.
struct LeftActivityBar: View {
    @Environment(\.theme) private var theme

    let changeCount: Int

    var body: some View {
        VStack(spacing: 2) {
            ActivityItem(icon: "git-compare", active: true, badge: changeCount)
            ActivityItem(icon: "branch")
            theme.color("--border-strong")
                .frame(width: 22, height: 1)
                .padding(.vertical, 4)
            ActivityItem(icon: "history")
            Spacer(minLength: 0)
            ActivityItem(icon: "play", iconSize: 18)
            ActivityItem(icon: "terminal")
        }
        .padding(.top, 6)
        .padding(.bottom, 6)
        .frame(maxWidth: .infinity)
    }
}

/// The Files panel's button, active while the panel shows.
struct RightActivityBar: View {
    var body: some View {
        VStack(spacing: 2) {
            ActivityItem(icon: "list-tree", active: true)
            Spacer(minLength: 0)
        }
        .padding(.top, 6)
        .frame(maxWidth: .infinity)
    }
}
