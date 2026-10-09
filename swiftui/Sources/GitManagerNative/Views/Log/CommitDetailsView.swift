// The selected commit under the list (src/lib/log/CommitDetails.svelte): its details on the left, 360 points wide,
// a line, and on the right the read-only diff of the selected file, "Parent" against the commit, built from the same
// toolbar, labels and diff canvas as the Changes diff (Views/Diff), with no revert column.

import NativeCore
import SwiftUI

struct CommitDetailsView: View {
    @Environment(\.theme) private var theme
    @EnvironmentObject private var model: LogModel

    static let leftWidth: CGFloat = 360

    var body: some View {
        HStack(spacing: 0) {
            Group {
                if let details = model.details {
                    CommitInfoView(details: details)
                } else {
                    Text("Loading commit...")
                        .foregroundStyle(theme.ink("--text-dim"))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        .padding(16)
                }
            }
            .frame(width: Self.leftWidth)
            .frame(maxHeight: .infinity, alignment: .top)
            SplitLine(vertical: true)
            Group {
                if let open = model.diff {
                    CommitDiffView(open: open)
                        // Each commit and file gets its own folds and scroll, as the page rebuilds per key.
                        .id("\(open.commitLabel ?? ""):\(open.filePath)")
                } else {
                    Text(model.selectedPath == nil ? "Select a file to see its changes" : "Loading diff...")
                        .foregroundStyle(theme.ink("--text-dim"))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

/// A commit file's diff: the toolbar (cut at the pane's edge, as the page's toolbar does), the labels and the panes.
struct CommitDiffView: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var prefs = DiffPrefs.shared
    @StateObject private var state = DiffState()

    let open: OpenDiff

    var body: some View {
        let content = state.content(open: open, collapse: prefs.collapseUnchanged, theme: theme)
        VStack(spacing: 0) {
            DiffToolbar(
                name: LogFormat.fileName(open.filePath), directory: LogFormat.fileDir(open.filePath),
                changeCount: state.changeCount, current: state.current, staged: false,
                collapse: prefs.collapseUnchanged, readonly: true, go: state.go, toggleCollapse: prefs.toggleCollapse
            )
            .fixedSize(horizontal: true, vertical: false)
            // minWidth 0: the frame takes the pane's width, not the toolbar's. The page paints the toolbar's box
            // here and lets the buttons that do not fit run on over the Files panel (overflow is not hidden).
            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
            .background(alignment: .bottom) {
                VStack(spacing: 0) {
                    theme.color("--panel")
                    theme.color("--border-strong").frame(height: 1)
                }
            }
            DiffLabels(left: "Parent", right: open.commitLabel ?? "", readonly: true)
            DiffPanes(content: content, scroll: state.scroll, onFold: state.stepFold)
                .background(theme.color("--editor-bg"))
        }
    }
}

/// The page's split handles (.split, .splitter): a 1-point --border-strong line in the middle of a 5-point handle
/// that overlaps its neighbors by 2 points on each side, so it takes 1 point of the layout. The page paints the line
/// as a linear-gradient, which Core Graphics dithers: each pixel lands on the token or one step off it at random
/// (measured), so the token itself is the closest match.
struct SplitLine: View {
    @Environment(\.theme) private var theme

    let vertical: Bool

    var body: some View {
        if vertical {
            theme.color("--border-strong").frame(width: 1)
        } else {
            theme.color("--border-strong").frame(height: 1)
        }
    }
}
