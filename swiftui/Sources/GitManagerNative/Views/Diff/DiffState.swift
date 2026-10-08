// What one open diff remembers between redraws (DiffView.svelte's state): its layout, built once per texts,
// collapse choice and folds instead of on every SwiftUI update; the change the counter shows; the folds opened step
// by step; and where to scroll. A new diff, or "Collapse unchanged" switched, centers the first change as the
// current app does after it builds its editors.

import AppKit
import NativeCore
import SwiftUI

@MainActor
final class DiffState: ObservableObject {
    /// Center the row at `rowTop` (right pane, content points); a new token asks again.
    struct ScrollRequest: Equatable {
        let token: Int
        let rowTop: Double
    }

    private struct Key: Equatable {
        let original: String
        let modified: String
        let hunks: [DiffHunk]
        let collapse: Bool
        let folds: [FoldRange]?
    }

    private struct Built {
        let key: Key
        let content: DiffCanvas.Content
    }

    /// The change the counter shows and the cursor sits on; -1 before one is picked.
    private(set) var current = -1
    private(set) var scroll: ScrollRequest?
    /// The original text's folds once a step opened some; nil while they are the defaults.
    private var folds: [FoldRange]?
    private var built: Built?
    /// The diff on screen, for the control server's `diff` action.
    static weak var shown: DiffState?

    /// The original text's folds now shown, as [first, last] line pairs.
    var shownFolds: [[Int]] {
        built?.content.layout.leftFolds.map { [$0.first, $0.last] } ?? []
    }

    var changeCount: Int {
        built?.content.layout.lineHunks.count ?? 0
    }

    /// The canvas content for `open`, rebuilt only when what shapes the rows changed. Called from the view's body,
    /// so it changes no published state: the body that asked reads the new values in the same pass.
    func content(open: OpenDiff, collapse: Bool, theme: Theme) -> DiffCanvas.Content {
        Self.shown = self
        let hunks = open.diff.hunks.compactMap(DiffHunk.init)
        if let built, built.key.collapse != collapse {
            folds = nil
        }
        let key = Key(
            original: open.diff.original, modified: open.diff.modified, hunks: hunks, collapse: collapse, folds: folds
        )
        let reveal = built == nil || built?.key.collapse != collapse
        var content: DiffCanvas.Content
        if let built, built.key == key {
            content = built.content
        } else {
            content = Self.build(open, hunks: hunks, collapse: collapse, folds: folds, theme: theme)
            built = Built(key: key, content: content)
        }
        if reveal {
            current = changeCount > 0 ? 0 : -1
            requestScroll(to: current, in: content)
        }
        content.theme = theme
        content.leftSpans = open.originalSpans
        content.rightSpans = open.modifiedSpans
        content.rightNoteEnd = Self.noteEnd(content, change: current)
        return content
    }

    /// The previous (-1) or next (1) change, centered (goToChunk).
    func go(_ direction: Int) {
        guard let content = built?.content else {
            return
        }
        current = DiffNavigation.step(current: current, count: changeCount, direction: direction)
        requestScroll(to: current, in: content)
        objectWillChange.send()
    }

    /// Opens a step of the fold at `foldIndex` of the original text's folds, or all of it.
    func stepFold(_ foldIndex: Int, edge: FoldEdge) {
        guard let layout = built?.content.layout else {
            return
        }
        folds = DiffFold.stepping(layout.leftFolds, at: foldIndex, edge: edge)
        objectWillChange.send()
    }

    private func requestScroll(to change: Int, in content: DiffCanvas.Content) {
        let hunks = content.layout.lineHunks
        guard hunks.indices.contains(change),
              let row = DiffNavigation.row(ofLine: hunks[change].newStart + 1, in: content.layout.right) else {
            return
        }
        scroll = ScrollRequest(token: (scroll?.token ?? 0) + 1, rowTop: content.right.tops[row])
    }

    private static func build(
        _ open: OpenDiff, hunks: [DiffHunk], collapse: Bool, folds: [FoldRange]?, theme: Theme
    ) -> DiffCanvas.Content {
        let layout = DiffLayout(
            original: open.diff.original, modified: open.diff.modified, hunks: hunks, collapse: collapse, folds: folds
        )
        return DiffCanvas.Content(
            layout: layout,
            left: RowIndex(rows: layout.left, metrics: DiffPanes.metrics),
            right: RowIndex(rows: layout.right, metrics: DiffPanes.metrics),
            staged: open.staged,
            theme: theme,
            leftGuides: DiffPanes.guides(layout.left, text: open.diff.original),
            rightGuides: DiffPanes.guides(layout.right, text: open.diff.modified),
            leftWidth: DiffPanes.contentWidth(layout.left),
            rightWidth: DiffPanes.contentWidth(layout.right)
        )
    }

    /// Where the cursor line's blame note ends, from the content's left edge (blame.ts placeNote): 36 points after
    /// the line, "You, Uncommitted changes" in 11.7-point italic. It lies in a layer of the scroller, so it widens
    /// what the horizontal scrollbar scrolls, though it starts out of sight. Only a changed line is known to be
    /// uncommitted without running git blame; other lines give 0.
    private static func noteEnd(_ content: DiffCanvas.Content, change: Int) -> CGFloat {
        let hunks = content.layout.lineHunks
        guard hunks.indices.contains(change),
              let row = DiffNavigation.row(ofLine: hunks[change].newStart + 1, in: content.layout.right),
              case .line(_, let text, let kind) = content.layout.right[row], kind != .unchanged else {
            return 0
        }
        let base = NSFont.systemFont(ofSize: 11.7)
        let italic = NSFont(descriptor: base.fontDescriptor.withSymbolicTraits(.italic), size: 11.7) ?? base
        let note = ("You, Uncommitted changes" as NSString).size(withAttributes: [.font: italic]).width
        return 6 + CGFloat(text.utf16.count) * CodeLineText.advance + 36 + note
    }
}
