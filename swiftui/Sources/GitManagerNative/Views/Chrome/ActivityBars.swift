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
    var action: () -> Void = {}
    /// The right bar's items mark the active one on their right (.item.active::after).
    var markTrailing = false

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topLeading) {
                // A <button> keeps WebKit's own padding here (2 points above, 3 below), so the icon is centered
                // half a point above the item's middle.
                Icon(name: icon, size: iconSize, strokeWidth: 1.8)
                    .frame(width: 36, height: 31)
                    .padding(.top, 2)
                    .padding(.bottom, 3)
                if let badge, badge > 0 {
                    // .badge: 16 points tall, 10-point semibold white text on the accent color, 19 x 17 in.
                    Text("\(badge)")
                        .font(PageFont.font(10, weight: .semibold))
                        .foregroundStyle(Color.white)
                        .padding(.horizontal, 4)
                        .frame(minWidth: 16, minHeight: 16)
                        .background(Capsule(style: .circular).fill(theme.color("--accent")))
                        .offset(x: 19, y: 17)
                }
            }
            .frame(width: 36, height: 36)
            .foregroundStyle(active ? theme.ink("--accent") : theme.ink("--text-dim"))
            .background(RoundedRectangle(cornerRadius: 8, style: .circular).fill(activeFill))
            .contentShape(RoundedRectangle(cornerRadius: 8, style: .circular))
        }
        .buttonStyle(.plain)
        .overlay(alignment: markTrailing ? .trailing : .leading) {
            // .item.active::before (::after on the right): a 2-point accent bar with round ends, 4 points outside
            // the item, 8 from its top and bottom, on the window's edge.
            if active {
                RoundedRectangle(cornerRadius: 1, style: .circular)
                    .fill(theme.color("--accent"))
                    .frame(width: 2, height: 20)
                    .offset(x: markTrailing ? 4 : -4)
            }
        }
    }

    /// The accent at 12% over the bar, as one solid color the way WebKit blends it.
    private var activeFill: Color {
        active ? theme.over("--accent", 0.12, on: "--panel-alt") : .clear
    }
}

/// Changes (with its count), Branches, a separator and History at the top; Run and Terminal at the bottom.
struct LeftActivityBar: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var terminal = TerminalStore.shared

    let changeCount: Int
    var logShown = false
    var toggleLog: () -> Void = {}

    var body: some View {
        VStack(spacing: 2) {
            ActivityItem(icon: "git-compare", active: true, badge: changeCount)
            ActivityItem(icon: "branch")
            theme.color("--border-strong")
                .frame(width: 22, height: 1)
                .padding(.vertical, 4)
            ActivityItem(icon: "history", active: logShown, action: toggleLog)
            Spacer(minLength: 0)
            // Anchored to the window's bottom: the page lays them out a quarter point higher (SVGBiasKey).
            Group {
                ActivityItem(icon: "play", iconSize: 18)
                // The terminal panel's toggle, active while the panel shows (ActivityBar.svelte).
                ActivityItem(icon: "terminal", active: terminal.panelOpen, action: terminal.toggle)
            }
            .svgBias(-0.25)
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
            ActivityItem(icon: "list-tree", active: true, markTrailing: true)
            Spacer(minLength: 0)
        }
        .padding(.top, 6)
        .frame(maxWidth: .infinity)
    }
}
