// A file's diff in the main area (src/lib/views/EditorTabs.svelte, src/lib/diff/DiffView.svelte), measured in
// swiftui/Reference/diff-<mode>/editor-tabs.json, diff-toolbar.json and diff-header.json: the tab strip, the
// toolbar, the two pane labels, then the panes (DiffPanes.swift).

import NativeCore
import SwiftUI

struct DiffScreen: View {
    @Environment(\.theme) private var theme

    let open: OpenDiff
    let close: () -> Void

    var body: some View {
        let parts = FileRow.split(open.filePath)
        let hunks = open.diff.hunks.compactMap(DiffHunk.init)
        VStack(spacing: 0) {
            tabStrip(name: parts.name)
            DiffToolbar(name: parts.name, directory: parts.directory, changeCount: hunks.count, staged: open.staged)
            labels
            DiffPanes(
                original: open.diff.original, modified: open.diff.modified, hunks: hunks, staged: open.staged,
                originalSpans: open.originalSpans, modifiedSpans: open.modifiedSpans
            )
        }
    }

    /// 34 points on --panel-alt with a bottom line; the active tab on --editor-bg with a 2-point accent line on top
    /// and a right border: icon, name, the dim "Diff", close.
    private func tabStrip(name: String) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                HStack(spacing: 6) {
                    Icon(name: "git-compare", size: 13)
                        .opacity(0.8)
                    Text(name)
                    Text("Diff")
                        .font(.system(size: 11.5))
                        .foregroundStyle(theme.color("--text-faint"))
                }
                .padding(.leading, 12)
                .padding(.trailing, 6)
                // .tab-close is --text-dim, unlike .icon-btn.
                Icon(name: "x", size: 12)
                    .foregroundStyle(theme.color("--text-dim"))
                    .frame(width: 20, height: 20)
                    .contentShape(Rectangle())
                    .onTapGesture(perform: close)
                    .padding(.trailing, 4)
                theme.color("--border-strong").frame(width: 1)
            }
            .frame(height: 33)
            .background(theme.color("--editor-bg"))
            .overlay(alignment: .top) {
                theme.color("--accent").frame(height: 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            theme.color("--border-strong").frame(height: 1)
        }
        .frame(height: 34)
        .background(theme.color("--panel-alt"))
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
            .foregroundStyle(theme.color("--text-dim"))
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
    let staged: Bool

    var body: some View {
        HStack(spacing: 2) {
            IconButton(width: 24, height: 24, action: {}) {
                Icon(name: "arrow-up", size: 14)
            }
            IconButton(width: 24, height: 24, action: {}) {
                Icon(name: "arrow-down", size: 14)
            }
            Text(changeCount == 0 ? "No changes" : "1 of \(changeCount)")
                .font(.system(size: 12))
                .foregroundStyle(theme.color("--text-dim"))
                .padding(.leading, 6)
            divider
            HStack(spacing: 1) {
                toggle(icon: "split-view", active: true, padding: 6)
                toggle(icon: "split-rows", padding: 6)
            }
            .padding(.trailing, 4)
            toggle(icon: "list-tree", title: "Collapse unchanged", active: true)
            toggle(icon: "history", title: "Blame")
            toggle(icon: "external-link", title: "Open File")
            divider
            if staged {
                toggle(icon: "minus", title: "Unstage Lines")
            } else {
                toggle(icon: "plus", title: "Stage Lines")
                toggle(icon: "discard", title: "Discard Lines")
            }
            path
                .padding(.leading, 10)
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

    /// .path: takes the rest of the row after a 12-point margin and ends in an ellipsis when it does not fit.
    private var path: some View {
        var text = Text(name).fontWeight(.semibold)
        if !directory.isEmpty {
            text = text + Text(" ") + Text(directory).foregroundColor(theme.color("--text-dim"))
        }
        return text
            .font(.system(size: 12))
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: .infinity, alignment: .leading)
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
                Text(title)
            }
        }
        .font(.system(size: 12))
        .foregroundStyle(active ? theme.color("--text") : theme.color("--text-dim"))
        .padding(.horizontal, padding)
        .frame(height: 24)
        .fixedSize()
        .background(RoundedRectangle(cornerRadius: 6).fill(active ? theme.color("--selected-inactive") : .clear))
    }
}
