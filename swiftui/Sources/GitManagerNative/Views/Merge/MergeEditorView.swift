// The merge tool's editor (src/lib/merge/MergeEditor.svelte): the toolbar, the three labels, the panes with the
// connectors between them, and the footer. Sizes from its CSS and app.css (.icon-btn, .btn): toolbar and footer
// 6 and 10 points of padding around 28-point buttons with a --border-strong line, labels 5 and 12 points around
// 12-point semibold text, 52-point connectors.

import NativeCore
import SwiftUI

struct MergeEditorView: View {
    @Environment(\.theme) private var theme
    @ObservedObject var session: MergeSession
    @StateObject private var sync = MergeScrollSync()
    @StateObject private var contents = MergePaneContents()
    let onApply: (_ skipChecks: Bool) -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            MergeToolbar(session: session)
            GeometryReader { proxy in
                // flex: 1 each beside the two 52-point connectors.
                let paneWidth = max(0, (proxy.size.width - MergeConnectors.width * 2) / 3)
                VStack(spacing: 0) {
                    labels(paneWidth)
                    panes(paneWidth)
                }
            }
            MergeFooter(session: session, onApply: onApply, onCancel: onCancel)
        }
        .background(theme.color("--panel"))
        .task {
            await session.highlight()
        }
    }

    /// .labels: --panel-alt with a --border-strong line below; Local, Result and the file name, Remote.
    private func labels(_ paneWidth: CGFloat) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                label(session.document.oursLabel, alignment: .leading)
                    .frame(width: paneWidth)
                Color.clear.frame(width: MergeConnectors.width)
                HStack(spacing: 0) {
                    ExactText(text: "Result ", weight: .semibold)
                    ExactText(text: session.fileName, weight: .semibold)
                        .foregroundStyle(theme.ink("--text-dim"))
                }
                .padding(.horizontal, 12)
                .frame(width: paneWidth)
                Color.clear.frame(width: MergeConnectors.width)
                label(session.document.theirsLabel, alignment: .trailing)
                    .frame(width: paneWidth)
            }
            .frame(height: 25)
            theme.color("--border-strong").frame(height: 1)
        }
        .background(theme.color("--panel-alt"))
    }

    private func label(_ text: String, alignment: Alignment) -> some View {
        ExactText(text: text, weight: .semibold)
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, alignment: alignment)
    }

    private func panes(_ paneWidth: CGFloat) -> some View {
        let resultLines = session.lines.count
        sync.anchors = { [session] pane in
            let side: MergeSide = pane == .ours ? .ours : .theirs
            return MergeNavigation.sideToResultAnchors(
                session.chunks, side: side, sideLines: session.sides.lines(side).count, resultLines: resultLines
            )
        }
        return HStack(spacing: 0) {
            pane(.ours).frame(width: paneWidth)
            MergeConnectors(session: session, sync: sync, side: .ours)
            pane(.result).frame(width: paneWidth)
            MergeConnectors(session: session, sync: sync, side: .theirs)
            pane(.theirs).frame(width: paneWidth)
        }
        .frame(maxHeight: .infinity)
    }

    private func pane(_ pane: MergePane) -> some View {
        let content = contents.content(pane, session: session, theme: theme)
        let marks: [MergeLineMark]
        switch pane {
        case .ours:
            marks = MergeNavigation.sideMarks(session.chunks, side: .ours)
        case .theirs:
            marks = MergeNavigation.sideMarks(session.chunks, side: .theirs)
        case .result:
            marks = MergeNavigation.resultMarks(session.chunks)
        }
        return MergePaneView(
            pane: pane, content: content, marks: marks, sync: sync, reveal: pane == .result ? session.reveal : nil
        )
    }
}

/// The merge window's title bar (MergeView.svelte in the window, MergeToolApp.svelte for git mergetool): the merge
/// icon, "Merge Revisions for" and the path in the code font; in the window 40 points with a close button, for git
/// mergetool 38 points without one.
struct MergeTitleBar: View {
    @Environment(\.theme) private var theme

    let path: String
    /// The close button of the window's overlay; nil for git mergetool.
    var close: (() -> Void)?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Icon(name: "merge", size: 15)
                    .foregroundStyle(theme.ink("--text-dim"))
                ExactText(text: "Merge Revisions for", size: 13, weight: .semibold)
                ExactText(text: path, face: CodeFonts.shared.regular)
                    .layoutPriority(-1)
                Spacer(minLength: 0)
                if let close {
                    IconButton(action: close) {
                        Icon(name: "x", size: 15)
                    }
                }
            }
            .padding(.leading, 14)
            .padding(.trailing, close == nil ? 14 : 8)
            .frame(maxHeight: .infinity)
            theme.color("--border-strong").frame(height: 1)
        }
        .frame(height: close == nil ? 38 : 40)
        .background(theme.color("--panel"))
    }
}
