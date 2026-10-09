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
    /// One repository: its actions sit in the heading (ChangesView.svelte); several get Refresh All instead.
    var repoActions = true
    /// The commit box layout button, shown while the workspace holds a repository.
    var layoutButton = true

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
                if layoutButton {
                    IconButton(width: 24, height: 24, action: toggleCommitLayout) {
                        CommitLayoutIcon(perRepo: settings.preferences.commitBoxLayout == "perRepo")
                    }
                }
                if repoActions {
                    RepoActions(
                        head: head, decorations: decorations, busy: busy, commitBlocked: commitBlocked,
                        publish: publish, operation: operation, commit: commit, refresh: refresh
                    )
                } else {
                    // Several repositories: their actions are on their own headers; this one refreshes them all.
                    IconButton(width: 24, height: 24, action: refresh) {
                        Icon(name: "refresh", size: 13)
                    }
                }
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

    /// Settings > Git > Commit box, which this button switches (the per-repository boxes are not built yet).
    private func toggleCommitLayout() {
        settings.update { $0.commitBoxLayout = $0.commitBoxLayout == "perRepo" ? "single" : "perRepo" }
    }
}
