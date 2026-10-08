// The Changes heading (src/lib/views/ChangesView.svelte .head with RepoActions.svelte), measured in
// swiftui/Reference/changes-<mode>/changes-head.json.

import SwiftUI

/// "CHANGES 4", the commit box layout button, the repository's actions (branch with its markers, sync, commit,
/// refresh, more) and close; 34 points tall with a bottom line.
struct ChangesHead: View {
    @Environment(\.theme) private var theme

    let count: Int
    let head: HeadInfo?
    let decorations: String
    /// A write is running: the branch, sync and commit buttons are off.
    var busy = false
    /// The commit button has nothing to do (no changes, or conflicts).
    var commitBlocked = false
    var commit: () -> Void = {}
    var refresh: () -> Void = {}

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Text("CHANGES")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.66)
                    .foregroundStyle(theme.color("--text-dim"))
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .layoutPriority(-1)
                if count > 0 {
                    Text("\(count)")
                        .font(.system(size: 11))
                        .padding(.horizontal, 5)
                        .frame(minWidth: 18, minHeight: 16)
                        .background(Capsule().fill(theme.color("--hover")))
                }
                // The current app leaves 12 points before the actions: the gap on each side of this spacer.
                Spacer(minLength: 0)
                // Settings > Git > Commit box: one box under the list (the default) or one per repository.
                IconButton(width: 24, height: 24, action: {}) {
                    CommitLayoutIcon(perRepo: false)
                }
                actions
                IconButton(width: 24, height: 24, action: {}) {
                    Icon(name: "x", size: 14)
                }
            }
            .padding(.leading, 12)
            .padding(.trailing, 6)
            .frame(maxHeight: .infinity)
            theme.color("--border-strong").frame(height: 1)
        }
        .frame(height: 34)
    }

    /// The repository's row actions in --text-dim: 20 points tall, 4-point corners, 1 apart.
    private var actions: some View {
        HStack(spacing: 1) {
            // .branch is a grid (icon, name, markers) with 2-point gaps; a narrow sidebar hides the name, but its
            // empty column keeps both gaps: 4 points from the icon to the markers.
            HeadAction(disabled: busy) {
                HStack(spacing: 4) {
                    Icon(name: "branch", size: 12)
                    Text(decorations)
                        .font(.system(size: 12, weight: .semibold))
                }
                .padding(.horizontal, 4)
                .frame(height: 20)
            }
            if let head, head.ahead > 0 || head.behind > 0 {
                HeadAction(disabled: busy) {
                    HStack(spacing: 2) {
                        Icon(name: "sync", size: 13)
                        // .sync-badge: tabular digits, wider than the default ones.
                        Text(head.ahead > 0 ? "\(head.ahead)↑" : "\(head.behind)↓")
                            .font(.system(size: 11).monospacedDigit())
                    }
                    .padding(.horizontal, 3)
                    .frame(height: 20)
                }
            }
            HeadAction(disabled: busy || commitBlocked, action: commit) {
                Icon(name: "check", size: 14).frame(width: 20, height: 20)
            }
            HeadAction(action: refresh) {
                Icon(name: "refresh", size: 13).frame(width: 20, height: 20)
            }
            HeadAction {
                Icon(name: "more", size: 14).frame(width: 20, height: 20)
            }
        }
    }
}

/// A .action button of the heading: --text-dim, --border-strong and --text under the mouse, and at 40% opacity
/// (one solid color, blended as WebKit does) while it is off.
private struct HeadAction<Label: View>: View {
    @Environment(\.theme) private var theme
    @State private var hovered = false

    var disabled = false
    var action: () -> Void = {}
    @ViewBuilder let label: () -> Label

    var body: some View {
        let active = hovered && !disabled
        Button(action: action) {
            label()
                .background(RoundedRectangle(cornerRadius: 4).fill(active ? theme.color("--border-strong") : .clear))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .allowsHitTesting(!disabled)
        .foregroundStyle(disabled
            ? theme.over("--text-dim", 0.4, on: "--panel")
            : theme.color(active ? "--text" : "--text-dim"))
        .onHover { hovered = $0 }
    }
}
