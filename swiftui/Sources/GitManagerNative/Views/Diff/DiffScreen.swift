// A file's diff in the main area under the tab strip (src/lib/diff/DiffView.svelte), measured in
// swiftui/Reference/diff-<mode>/diff-toolbar.json and diff-header.json: the toolbar, the two pane labels, then the
// panes (DiffPanes.swift).

import NativeCore
import SwiftUI

struct DiffScreen: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var prefs = DiffPrefs.shared
    /// One per open file: ContentView gives each file and area its own identity.
    @StateObject private var state = DiffState()

    let open: OpenDiff

    var body: some View {
        let parts = FileRow.split(open.filePath)
        let content = state.content(open: open, collapse: prefs.collapseUnchanged, theme: theme)
        VStack(spacing: 0) {
            DiffToolbar(
                name: parts.name, directory: parts.directory, changeCount: state.changeCount, current: state.current,
                staged: open.staged, collapse: prefs.collapseUnchanged, go: state.go,
                toggleCollapse: prefs.toggleCollapse
            )
            labels
            DiffPanes(content: content, scroll: state.scroll, onFold: state.stepFold)
        }
    }

    /// "Index" and "Working Tree" (HEAD and Index for a staged diff): 24 points on --panel-alt with a --border line
    /// below, 11.5-point dim text.
    private var labels: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                label(open.staged ? "HEAD" : "Index")
                // .gap: the revert column's width, with its --border-strong sides.
                theme.color("--border-strong").frame(width: 1)
                Color.clear.frame(width: DiffPanes.gapWidth - 2)
                theme.color("--border-strong").frame(width: 1)
                label(open.staged ? "Index" : "Working Tree")
            }
            theme.color("--border").frame(height: 1)
        }
        .frame(height: 24)
        .background(theme.color("--panel-alt"))
    }

    private func label(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11.5))
            .foregroundStyle(theme.ink("--text-dim"))
            .lineLimit(1)
            // The page puts the 13-point line box 5 points down the 23-point row, half a point below center.
            .offset(y: 0.5)
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The diff's toolbar: previous and next change, the counter, the layout and collapse toggles, Blame, Open File, the
/// line actions and the file's path; 34 points on --panel.
struct DiffToolbar: View {
    @Environment(\.theme) private var theme

    let name: String
    let directory: String
    let changeCount: Int
    let current: Int
    let staged: Bool
    let collapse: Bool
    /// The previous (-1) or next (1) change.
    let go: (Int) -> Void
    let toggleCollapse: () -> Void

    var body: some View {
        HStack(spacing: 2) {
            IconButton(width: 24, height: 24, disabled: changeCount == 0, action: { go(-1) }) {
                Icon(name: "arrow-up", size: 14)
            }
            IconButton(width: 24, height: 24, disabled: changeCount == 0, action: { go(1) }) {
                Icon(name: "arrow-down", size: 14)
            }
            ExactText(text: DiffNavigation.counterLabel(count: changeCount, current: current))
                .foregroundStyle(theme.ink("--text-dim"))
                .padding(.leading, 6)
            divider
            HStack(spacing: 1) {
                toggle(icon: "split-view", active: true, padding: 6)
                toggle(icon: "split-rows", padding: 6)
            }
            .padding(.trailing, 4)
            toggle(icon: "list-tree", title: "Collapse unchanged", active: collapse)
                .contentShape(Rectangle())
                .onTapGesture(perform: toggleCollapse)
            toggle(icon: "history", title: "Blame")
            toggle(icon: "external-link", title: "Open File")
            divider
            if staged {
                toggle(icon: "minus", title: "Unstage Lines")
            } else {
                toggle(icon: "plus", title: "Stage Lines")
                toggle(icon: "discard", title: "Discard Lines")
            }
            // .path's 12-point margin after the toolbar's 2-point gap.
            PathLabel(name: name, directory: directory)
                .padding(.leading, 12)
        }
        .padding(.horizontal, 8)
        // The controls center in the 33 points above the --border-strong bottom line.
        .frame(height: 33)
        .frame(maxHeight: .infinity, alignment: .top)
        .overlay(alignment: .bottom) {
            theme.color("--border-strong").frame(height: 1)
        }
        .frame(height: 34)
        .background(theme.color("--panel"))
    }

    private var divider: some View {
        theme.color("--border-strong")
            .frame(width: 1, height: 16)
            .padding(.horizontal, 8)
    }

    /// .toggle: 24 points tall, 6-point corners, the 13-point icon 5 points from 12-point
    /// text; --text on --selected-inactive while on, --text-dim otherwise. Never shrinks: the path gives way first.
    private func toggle(icon: String, title: String? = nil, active: Bool = false, padding: CGFloat = 8) -> some View {
        HStack(spacing: 5) {
            Icon(name: icon, size: 13)
            if let title {
                ExactText(text: title)
            }
        }
        .font(.system(size: 12))
        .foregroundStyle(active ? theme.ink("--text") : theme.ink("--text-dim"))
        .padding(.horizontal, padding)
        .frame(height: 24)
        .fixedSize()
        .background(
            RoundedRectangle(cornerRadius: 6, style: .circular)
                .fill(active ? theme.color("--selected-inactive") : .clear)
        )
    }
}
