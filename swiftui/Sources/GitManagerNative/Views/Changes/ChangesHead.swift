// The Changes heading (src/lib/views/ChangesView.svelte .head with RepoActions.svelte), measured in
// swiftui/Reference/changes-<mode>/changes-head.json.

import SwiftUI

/// "CHANGES 4", the commit box layout button, the repository's actions (branch with its markers, sync, commit,
/// refresh, more) and close; 34 points tall with a bottom line.
struct ChangesHead: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var settings = SettingsStore.shared

    let count: Int
    let head: HeadInfo?
    let decorations: String
    /// A write is running: the branch, sync and commit buttons are off.
    var busy = false
    /// The commit button has nothing to do (no changes, or conflicts).
    var commitBlocked = false
    /// The sync button publishes the branch (cloud icon, no badge).
    var publish = false
    /// A merge or rebase is in progress: the sync button is off (RepoActions.svelte).
    var operation = false
    var commit: () -> Void = {}
    var refresh: () -> Void = {}

    private static let titleFont = PageFont.ui(11, weight: .semibold)
    private static let titleWidth = ExactText.width("CHANGES", font: titleFont, tracking: 0.66)

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                // The title gives way first. WebKit's ellipsis does not fit in what is left, so the page shows the
                // first letters clipped at the title's edge ("C"), not SwiftUI's "C…".
                Text("CHANGES")
                    .font(Font(Self.titleFont))
                    .tracking(0.66)
                    .foregroundStyle(theme.ink("--text-dim"))
                    .fixedSize()
                    // 11-point text with the normal line height: WebKit sets it half a point lower (measured).
                    .offset(y: 0.5)
                    .frame(minWidth: 0, maxWidth: Self.titleWidth, alignment: .leading)
                    .clipped()
                    .layoutPriority(-1)
                if count > 0 {
                    // .count: at least 18 wide with 5 points of padding, the digits centered.
                    ExactText(text: "\(count)", size: 11)
                        .padding(.horizontal, 5)
                        .frame(minWidth: 18, minHeight: 16)
                        .background(Capsule(style: .circular).fill(theme.color("--hover")))
                }
                // The current app leaves 12 points before the actions: the gap on each side of this spacer. It takes
                // what the title leaves, so the title is sized before it.
                Spacer(minLength: 0)
                    .layoutPriority(-2)
                // Settings > Git > Commit box: one box under the list (the default) or one per repository.
                IconButton(width: 24, height: 24, action: toggleCommitLayout) {
                    CommitLayoutIcon(perRepo: settings.preferences.commitBoxLayout == "perRepo")
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
    /// Settings > Git > Commit box, which this button switches (the per-repository boxes are not built yet).
    private func toggleCommitLayout() {
        settings.update { $0.commitBoxLayout = $0.commitBoxLayout == "perRepo" ? "single" : "perRepo" }
    }

    private var actions: some View {
        HStack(spacing: 1) {
            // .branch is a grid (icon, name, markers) with 2-point gaps; a narrow sidebar hides the name, but its
            // empty column keeps both gaps: 4 points from the icon to the markers.
            HeadAction(disabled: busy) {
                HStack(spacing: 4) {
                    Icon(name: "branch", size: 12)
                    ExactText(text: decorations, size: 12, weight: .semibold)
                }
                .padding(.horizontal, 4)
                .frame(height: 20)
            }
            if let head, publish || head.ahead > 0 || head.behind > 0 {
                HeadAction(disabled: busy || operation) {
                    HStack(spacing: 2) {
                        Icon(name: publish ? "cloud-upload" : "sync", size: 13)
                        if !publish {
                            // .sync-badge: tabular digits, wider than the default ones.
                            let badge = head.ahead > 0 ? "\(head.ahead)↑" : "\(head.behind)↓"
                            ExactText(text: badge, size: 11, tabular: true)
                                .offset(y: 0.5)
                        }
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
                .background(
                    RoundedRectangle(cornerRadius: 4, style: .circular)
                        .fill(active ? theme.color("--border-strong") : .clear)
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .allowsHitTesting(!disabled)
        .foregroundStyle(disabled
            ? theme.over("--text-dim", 0.4, on: "--panel")
            : theme.ink(active ? "--text" : "--text-dim"))
        .onHover { hovered = $0 }
    }
}
