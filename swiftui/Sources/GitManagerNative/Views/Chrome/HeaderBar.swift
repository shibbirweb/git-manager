// The header (src/lib/views/Header.svelte), measured in swiftui/Reference/<screen>-<mode>/header.json:
// back and forward, a divider, the folder and branch pills on the left; the two layout toggles, a divider, the theme
// and Settings buttons on the right. 8 points of padding at both ends, 4 between items.

import SwiftUI

struct HeaderBar: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var recent = RecentFiles.shared

    let folderName: String
    let head: HeadInfo?
    /// The active repository and how many the workspace holds, shown when the folder is not simply one repository.
    var repoPill: (name: String, count: Int)?
    let chooseFolder: () -> Void
    let toggleAppearance: () -> Void
    var openSettings: () -> Void = {}
    /// The write running now, shown before the layout buttons (.busy: at most 280 wide, 6 points before them).
    var busy: String?

    var body: some View {
        HStack(spacing: 4) {
            history
            HeaderDivider()
            PillButton(action: chooseFolder) {
                Icon(name: "folder", size: 14)
                ExactText(text: folderName, size: 13, weight: .semibold)
                Icon(name: "chevron-down", size: 12)
            }
            if let repoPill {
                ExactText(text: "/", size: 13)
                    .foregroundStyle(theme.ink("--text-faint"))
                PillButton(action: {}) {
                    Icon(name: "folder-git", size: 14)
                    ExactText(text: repoPill.name, size: 13)
                    // .repo-count: 11 points in --text-dim, half a point lower as WebKit sets small text.
                    ExactText(text: "\(repoPill.count)", size: 11)
                        .foregroundStyle(theme.ink("--text-dim"))
                        .offset(y: 0.5)
                    Icon(name: "chevron-down", size: 12)
                }
            }
            if let head {
                PillButton(action: {}) {
                    Icon(name: "branch", size: 14)
                    ExactText(text: head.branch ?? head.shortId ?? "", size: 13)
                    counts(head)
                    Icon(name: "chevron-down", size: 12)
                }
            }
            Spacer(minLength: 0)
            if let busy {
                BusyLabel(label: busy, spinnerSize: 12, gap: 6)
                    .frame(maxWidth: 280)
                    .fixedSize()
                    .padding(.trailing, 6)
            }
            IconButton(action: {}) {
                LayoutToggleIcon(side: .left, visible: true)
            }
            IconButton(action: {}) {
                LayoutToggleIcon(side: .right, visible: true)
            }
            HeaderDivider()
            IconButton(action: toggleAppearance) {
                Icon(name: "sun", size: 15)
            }
            IconButton(action: openSettings) {
                Icon(name: "settings", size: 15)
            }
        }
        .padding(.horizontal, 8)
        .font(.system(size: 13))
        .foregroundStyle(theme.ink("--text"))
    }

    /// Back and forward (.history: 27 x 26 buttons, 2 apart); Back is on once files were opened (RecentFiles), as
    /// in the current app; there is no history to walk yet.
    private var history: some View {
        HStack(spacing: 2) {
            IconButton(width: 27, height: 26, disabled: !recent.canGoBack, action: {}) {
                Icon(name: "arrow-left", size: 15)
            }
            IconButton(width: 27, height: 26, disabled: true, action: {}) {
                Icon(name: "arrow-right", size: 15)
            }
        }
    }

    /// Commits to push and pull, small and dim (.counts: 11.5 points, 4 apart). WebKit sets the digits half a point
    /// lower than SwiftUI (measured), as for other small text with the normal line height.
    @ViewBuilder
    private func counts(_ head: HeadInfo) -> some View {
        if head.ahead > 0 || head.behind > 0 {
            HStack(spacing: 4) {
                if head.ahead > 0 {
                    HStack(spacing: 0) {
                        ExactText(text: "\(head.ahead)", size: 11.5)
                            .offset(y: 0.5)
                        Icon(name: "arrow-up", size: 11)
                    }
                }
                if head.behind > 0 {
                    HStack(spacing: 0) {
                        ExactText(text: "\(head.behind)", size: 11.5)
                            .offset(y: 0.5)
                        Icon(name: "arrow-down", size: 11)
                    }
                }
            }
            .font(.system(size: 11.5))
            .foregroundStyle(theme.ink("--text-dim"))
        }
    }
}
