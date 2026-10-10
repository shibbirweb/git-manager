// The main area with no file open (src/lib/views/EmptyMain.svelte), measured in
// swiftui/Reference/changes-<mode>/main-area.json and nav-strip.json: the breadcrumb strip, then a centered column of
// the logo tile, the folder name and six actions with their shortcuts.

import SwiftUI

/// One crumb of the Navigation Bar: an icon (none for a plain folder inside a workspace folder) and a name, in
/// --accent for a repository with changes, else --text-dim.
struct NavCrumb: Hashable {
    let icon: String?
    let name: String
    var accent = false
}

/// The Navigation Bar over the empty editor (navBarModel.ts crumbsFor, to the active repository): with several
/// workspace folders a workspace crumb first, then the folder that holds the repository, then the folders to it.
struct RepoCrumb: View {
    @Environment(\.theme) private var theme

    let crumbs: [NavCrumb]

    var body: some View {
        // .nav-bar: 1 point between the crumbs and the chevrons.
        HStack(spacing: 1) {
            ForEach(Array(crumbs.enumerated()), id: \.offset) { index, crumb in
                if index > 0 {
                    Icon(name: "chevron-right", size: 11)
                        .foregroundStyle(theme.ink("--text-faint"))
                }
                HStack(spacing: 4) {
                    if let icon = crumb.icon {
                        Icon(name: icon, size: 12)
                    }
                    // At its exact width, so the chevron and the next crumb land where WebKit puts them.
                    ExactText(text: crumb.name, size: 12)
                }
                .foregroundStyle(theme.ink(crumb.accent ? "--accent" : "--text-dim"))
                .padding(.horizontal, 3)
                .frame(height: 22)
            }
        }
        .font(.system(size: 12))
        .padding(.leading, 10)
    }
}

struct WelcomeView: View {
    @Environment(\.theme) private var theme

    let title: String
    /// No active repository: Show the Log is off (half opacity), as in EmptyMain.svelte.
    var hasRepository = true

    /// The actions as the current app lists them, with the shortcuts it shows (macOS keys).
    private static let actions: [(icon: String, label: String, keys: String)] = [
        ("git-compare", "Review changes", "Shift+Cmd+G"),
        ("history", "Show the Log", "Shift+Cmd+L"),
        ("list-tree", "Open a file from the Files panel", ""),
        ("file", "Go to File", "Cmd+P"),
        ("search", "Search Everywhere", "Shift Shift"),
        ("chevrons-right", "Navigation Bar", "Cmd+Up"),
    ]

    var body: some View {
        VStack(spacing: 10) {
            // .logo: 56 points, 14-point corners, the accent at 12% behind a 28-point icon.
            Icon(name: "merge", size: 28)
                .foregroundStyle(theme.ink("--accent"))
                .frame(width: 56, height: 56)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .circular)
                        .fill(theme.over("--accent", 0.12, on: "--editor-bg"))
                        // The page's column sits a fraction above the whole point used here: its tile snaps to the
                        // half point below, its icon (an <svg>, on whole points) to the same point (measured).
                        .offset(y: 0.5)
                )
            Text(title)
                .font(PageFont.font(15, weight: .semibold))
                .foregroundStyle(theme.ink("--text"))
                // Measured against the current app (gm-measure, textpos): WebKit sets this title one pixel lower.
                .offset(y: 0.5)
                .padding(.bottom, 6)
            VStack(spacing: 4) {
                ForEach(Self.actions, id: \.label) { action in
                    row(icon: action.icon, label: action.label, keys: action.keys)
                        .opacity(action.label == "Show the Log" && !hasRepository ? 0.5 : 1)
                }
            }
            .frame(width: 300)
        }
        // Centered as WebKit centers the column (WholePointCenter): a half point off would move every label a pixel.
        // The page's 24-point padding is on both sides, so it does not move the center.
        .modifier(WholePointCenter())
        // The page centers the column a fraction above the whole point used here (SVGBiasKey).
        .svgBias(-0.25)
    }

    /// .action: 32 points tall, 12 points in, the 15-point icon 10 points from the label, the shortcut on the right.
    private func row(icon: String, label: String, keys: String) -> some View {
        HStack(spacing: 10) {
            Icon(name: icon, size: 15)
            Text(label)
                .font(.system(size: 13))
                .lineLimit(1)
                // Measured the same way: WebKit sets these labels one pixel higher.
                .offset(y: -0.5)
            Spacer(minLength: 0)
            if !keys.isEmpty {
                ExactText(text: keys, size: 11)
                    .foregroundStyle(theme.ink("--text-faint"))
            }
        }
        .foregroundStyle(theme.ink("--text-dim"))
        .padding(.horizontal, 12)
        .frame(height: 32)
        .contentShape(RoundedRectangle(cornerRadius: 7, style: .circular))
    }
}
