// The welcome screen's Learn page (Welcome.svelte section "learn"): the title as on Customize, then three items 4
// points apart, each at least 56 tall with 10 by 12 points of padding: an 18-point icon in --text-dim, 14 points
// before the name (13.5-point semibold) over a line in --text-dim; --hover under the mouse. The shortcuts list and
// What's New are not in the native app yet: they say so.

import AppKit
import NativeCore
import SwiftUI

struct WelcomeLearn: View {
    @Environment(\.windowContext) private var windowContext
    @Environment(\.theme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ExactText(text: "Learn", size: 18, weight: .semibold)
                .foregroundStyle(theme.ink("--text"))
                .padding(.top, 4)
                .padding(.bottom, 22)
            VStack(alignment: .leading, spacing: 4) {
                LearnItem(icon: "book", name: "Documentation",
                          detail: "A guide to every feature, on the GitHub wiki.") {
                    if let wiki = URL(string: GitHubLinks.repository + "/wiki") {
                        NSWorkspace.shared.open(wiki)
                    }
                }
                LearnItem(icon: "keyboard", name: "Keyboard Shortcuts",
                          detail: "Every key, grouped by menu, with a filter.") {
                    WelcomeActions.notBuilt("Keyboard Shortcuts", in: windowContext)
                }
                LearnItem(icon: "bell", name: "What's New", detail: "The changes in this version.") {
                    WelcomeActions.notBuilt("What's New", in: windowContext)
                }
            }
        }
        .frame(maxWidth: 594, alignment: .leading)
    }
}

private struct LearnItem: View {
    @Environment(\.theme) private var theme
    @State private var hovered = false

    let icon: String
    let name: String
    let detail: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Icon(name: icon, size: 18)
                    .foregroundStyle(theme.ink("--text-dim"))
                VStack(alignment: .leading, spacing: 3) {
                    ExactText(text: name, size: 13.5, weight: .semibold)
                        .foregroundStyle(theme.ink("--text"))
                    ExactText(text: detail, size: 13)
                        .foregroundStyle(theme.ink("--text-dim"))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(minHeight: 56)
            .background(RoundedRectangle(cornerRadius: 8, style: .circular)
                .fill(hovered ? theme.solid("--hover", on: "--panel") : .clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(name)
        .pageHover { hovered = $0 }
    }
}
