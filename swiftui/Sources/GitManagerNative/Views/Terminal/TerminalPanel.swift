// The bottom panel (src/lib/terminal/TerminalPanel.svelte), 260 points tall by default: a 1-point --border-strong
// top line, the 29-point header on --panel (TERMINAL and SHELF tabs, the terminal's name and folder, New Terminal
// and its shell menu, Split, Move into Editor Area, Kill, a divider and Hide) and the terminal below it. Sizes from
// the current app's CSS and checked with inspect_elements: tabs 14 apart from 10 points in, buttons 24 tall.

import SwiftUI

struct TerminalPanel: View {
    @Environment(\.theme) private var theme
    @ObservedObject var store: TerminalStore
    @EnvironmentObject private var model: AppModel

    var body: some View {
        VStack(spacing: 0) {
            // The resize handle above the panel is 5 points with -2 margins: one point of the main area's --panel.
            theme.color("--panel").frame(height: 1)
            VStack(spacing: 0) {
                theme.color("--border-strong").frame(height: 1)
                head
                theme.color("--border-strong").frame(height: 1)
                TerminalCanvas(store: store, theme: theme)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(viewport)
            }
            .frame(height: TerminalStore.panelHeight)
            .background(theme.color("--editor-bg"))
        }
    }

    /// xterm's viewport inside the host's padding (4 above, 2 below, 12 on the left).
    private var viewport: some View {
        theme.color("--term-background").padding(EdgeInsets(top: 4, leading: 12, bottom: 2, trailing: 0))
    }

    private var head: some View {
        HStack(spacing: 1) {
            HStack(spacing: 14) {
                PanelTab(title: "Terminal", selected: true)
                PanelTab(title: "Shelf", selected: false)
            }
            if let session = store.session {
                HStack(spacing: 6) {
                    ExactText(text: session.name, size: 12)
                        .foregroundStyle(theme.ink("--text"))
                    ExactText(text: folderLabel(session.info?.cwd ?? model.repoPath), size: 12)
                        .foregroundStyle(theme.ink("--text-dim"))
                }
                .padding(.leading, 14)
            }
            Spacer(minLength: 0)
            HStack(spacing: 0) {
                button("plus", size: 15) {
                    store.create()
                }
                button("chevron-down", size: 12, width: 16) {}
            }
            button("split-view", size: 14) {}
            button("app-window", size: 14) {}
            button("trash", size: 14) {
                store.kill()
            }
            theme.color("--border-strong")
                .frame(width: 1, height: 14)
                .padding(.horizontal, 4)
            button("x", size: 15) {
                store.hide()
            }
        }
        .padding(.leading, 10)
        .padding(.trailing, 6)
        .frame(height: 28)
        .background(theme.color("--panel"))
    }

    /// .icon-btn.small: 24 tall, at least 24 wide, 6 points of padding beside the icon, in --text-dim.
    private func button(
        _ icon: String, size: CGFloat, width: CGFloat? = nil, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Icon(name: icon, size: size)
                .frame(width: width ?? max(24, size + 12), height: 24)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(theme.ink("--text-dim"))
    }

    /// The folder's own name, as terminals.ts folderLabel shows it.
    private func folderLabel(_ folderPath: String?) -> String {
        guard let folderPath, !folderPath.isEmpty else {
            return ""
        }
        return (folderPath as NSString).lastPathComponent
    }
}

/// A panel tab: 11-point semibold capitals spaced 0.06em, --text when selected with a 2-point accent bar below.
private struct PanelTab: View {
    @Environment(\.theme) private var theme
    let title: String
    let selected: Bool

    var body: some View {
        let font = PageFont.ui(11, weight: .semibold)
        let label = title.uppercased()
        Text(label)
            .font(Font(font))
            .tracking(0.66)
            .lineLimit(1)
            // 11-point text with the normal line height: WebKit sets it half a point lower (measured).
            .offset(y: 0.5)
            .exactWidth(ExactText.width(label, font: font, tracking: 0.66))
            .frame(maxHeight: .infinity)
            .foregroundStyle(theme.ink(selected ? "--text" : "--text-dim"))
            .overlay(alignment: .bottom) {
                if selected {
                    RoundedRectangle(cornerRadius: 2, style: .circular)
                        .fill(theme.color("--accent"))
                        .frame(height: 2)
                }
            }
    }
}
