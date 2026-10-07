// The main area with no file open (src/lib/views/EmptyMain.svelte), measured in
// swiftui/Reference/changes-<mode>/main-area.json and nav-strip.json: the breadcrumb strip, then a centered column of
// the logo tile, the folder name and six actions with their shortcuts.

import SwiftUI

/// The Navigation Bar over the empty editor: the repository as one crumb, accent-colored while it has changes.
struct RepoCrumb: View {
    @Environment(\.theme) private var theme

    let name: String
    let hasChanges: Bool

    var body: some View {
        HStack(spacing: 4) {
            Icon(name: "folder-git", size: 12)
            Text(name)
                .lineLimit(1)
        }
        .font(.system(size: 12))
        .foregroundStyle(hasChanges ? theme.color("--accent") : theme.color("--text-dim"))
        .padding(.horizontal, 3)
        .frame(height: 22)
        .padding(.leading, 10)
    }
}

struct WelcomeView: View {
    @Environment(\.theme) private var theme

    let title: String

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
                .foregroundStyle(theme.color("--accent"))
                .frame(width: 56, height: 56)
                .background(RoundedRectangle(cornerRadius: 14).fill(theme.color("--accent").opacity(0.12)))
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(theme.color("--text"))
                .padding(.bottom, 6)
            VStack(spacing: 4) {
                ForEach(Self.actions, id: \.label) { action in
                    row(icon: action.icon, label: action.label, keys: action.keys)
                }
            }
            .frame(width: 300)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// .action: 32 points tall, 12 points in, the 15-point icon 10 points from the label, the shortcut on the right.
    private func row(icon: String, label: String, keys: String) -> some View {
        HStack(spacing: 10) {
            Icon(name: icon, size: 15)
            Text(label)
                .font(.system(size: 13))
                .lineLimit(1)
            Spacer(minLength: 0)
            if !keys.isEmpty {
                Text(keys)
                    .font(.system(size: 11))
                    .foregroundStyle(theme.color("--text-faint"))
            }
        }
        .foregroundStyle(theme.color("--text-dim"))
        .padding(.horizontal, 12)
        .frame(height: 32)
        .contentShape(RoundedRectangle(cornerRadius: 7))
    }
}
