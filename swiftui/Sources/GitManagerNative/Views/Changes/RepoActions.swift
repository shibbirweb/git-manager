// A repository's row actions (src/lib/views/changes/RepoActions.svelte): the branch with its markers, sync, commit,
// refresh and more, in the Changes heading for one repository, on each repository header for several and on the
// clean repositories' rows (no Commit there).

import SwiftUI

/// The buttons in --text-dim: 20 points tall, 4-point corners, 1 apart. The sidebar is narrower than 300 points,
/// so the branch name is hidden and only its markers show.
struct RepoActions: View {
    let head: HeadInfo?
    let decorations: String
    var busy = false
    var commitBlocked = false
    var publish = false
    var operation = false
    /// The Commit (check) button; clean repositories leave it out.
    var showCommit = true
    var commit: () -> Void = {}
    var refresh: () -> Void = {}

    var body: some View {
        HStack(spacing: 1) {
            // .branch is a grid (icon, name, markers) with 2-point gaps; a narrow sidebar hides the name, but its
            // empty column keeps both gaps: 4 points from the icon to the markers.
            HeadAction(disabled: busy) {
                HStack(spacing: 2) {
                    Icon(name: "branch", size: 12)
                    // The hidden name's empty track keeps a gap after the icon; without markers the page's button
                    // is 23 points wide (measured: the icon 1 point further left than 22 would put it).
                    Color.clear.frame(width: decorations.isEmpty ? 1 : 0, height: 0)
                    if !decorations.isEmpty {
                        ExactText(text: decorations, size: 12, weight: .semibold)
                    }
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
            if showCommit {
                HeadAction(disabled: busy || commitBlocked, action: commit) {
                    Icon(name: "check", size: 14).frame(width: 20, height: 20)
                }
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
struct HeadAction<Label: View>: View {
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
        .pageHover { hovered = $0 }
    }
}
