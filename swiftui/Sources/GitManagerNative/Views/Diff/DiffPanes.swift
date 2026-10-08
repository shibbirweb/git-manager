// The two panes of a side-by-side diff (CodeMirror's merge view in the current app), measured in
// swiftui/Reference/diff-<mode>/diff-layout.json, diff-gutters.json, diff-lines.json and diff-changes.json: a gutter
// of line numbers, JetBrains Mono 13 lines on 16-point rows (CodeMirror's 16.25-point line height lays out on whole
// pixels), the changed lines tinted, the unchanged runs folded (DiffLayout in NativeCore), and the 24-point revert
// column between the panes. Scrolls as one, like the page. DiffCanvas draws only the rows on screen, so a long file
// costs no more memory than a short one, before or after scrolling.

import AppKit
import NativeCore
import SwiftUI

struct DiffPanes: View {
    @Environment(\.theme) private var theme

    static let gapWidth: CGFloat = 24
    static let lineHeight: CGFloat = 16
    static let foldHeight: CGFloat = 22
    static let gutterWidth: CGFloat = 40
    static let markerWidth: CGFloat = 3
    /// CodeMirror's content padding above and below the rows.
    static let topPadding: CGFloat = 4
    static let metrics = RowMetrics(line: lineHeight, fold: foldHeight, padding: topPadding)
    /// The custom ::-webkit-scrollbar height in app.css, below each editor's rows.
    static let scrollbarHeight: CGFloat = 10

    /// Between the panes: the revert column, or a 1-point --border-strong line in a read-only (commit) diff.
    static func gap(readonly: Bool) -> CGFloat {
        readonly ? 1 : gapWidth
    }

    /// An editor's height: the rows, CodeMirror's padding below them and the horizontal scrollbar.
    static func editorHeight(rowsBottom: Double) -> CGFloat {
        CGFloat(rowsBottom) + topPadding + scrollbarHeight
    }

    static func guides(_ rows: [DiffRow], text: String) -> [IndentGuides.Run] {
        IndentGuides.runs(rows: rows, levels: IndentGuides.levels(lines: DiffLayout.lines(text)), metrics: metrics)
    }

    /// CodeMirror's content width for a pane: its widest shown line and the line padding (6 left, 2 right).
    static func contentWidth(_ rows: [DiffRow]) -> CGFloat {
        let advance = CodeLineText.advance
        var widest = 0
        for row in rows {
            if case .line(_, let text, _) = row {
                widest = max(widest, text.utf16.count)
            }
        }
        return CGFloat(widest) * advance + 8
    }

    let content: DiffCanvas.Content
    var scroll: DiffState.ScrollRequest?
    /// A click on a fold: its index among the original text's folds and the part clicked.
    var onFold: (Int, FoldEdge) -> Void = { _, _ in }

    var body: some View {
        DiffScrollView(content: content, scroll: scroll, onFold: onFold)
            .overlay(alignment: .trailing) {
                ruler(content.layout.right, hunks: content.layout.lineHunks)
            }
    }

    /// .cm-scroll-markers: 12 points of --panel-alt over the right edge with a 1-point --border-strong left border,
    /// and a tick per change 2 points in from each side of the rest (DiffRuler in NativeCore).
    private func ruler(_ rows: [DiffRow], hunks: [DiffHunk]) -> some View {
        GeometryReader { proxy in
            let metrics = RowMetrics(line: Self.lineHeight, fold: Self.foldHeight, padding: Self.topPadding)
            let ticks = DiffRuler.ticks(rows: rows, hunks: hunks, metrics: metrics, trackHeight: proxy.size.height)
            ZStack(alignment: .topLeading) {
                theme.color("--panel-alt")
                theme.color("--border-strong").frame(width: 1)
                ForEach(Array(ticks.enumerated()), id: \.offset) { _, tick in
                    RoundedRectangle(cornerRadius: 1)
                        .fill(tickColor(tick.kind))
                        .frame(width: 7, height: tick.height)
                        .offset(x: 3, y: tick.top)
                }
            }
        }
        .frame(width: 12)
    }

    private func tickColor(_ kind: RulerTick.Kind) -> Color {
        switch kind {
        case .added:
            return theme.color("--diff-added-edge")
        case .modified:
            return theme.color("--diff-modified-edge")
        case .deleted:
            return theme.color("--danger")
        }
    }
}

/// A transparent scroll view over the canvas: it takes the scroll gestures and sets how tall the content is, and the
/// canvas below it redraws the viewport at each new offset.
struct DiffScrollView: NSViewRepresentable {
    let content: DiffCanvas.Content
    let scroll: DiffState.ScrollRequest?
    let onFold: (Int, FoldEdge) -> Void

    func makeNSView(context: Context) -> Host {
        Host()
    }

    func updateNSView(_ host: Host, context: Context) {
        host.canvas.content = content
        let rowsBottom = max(content.left.rowsBottom, content.right.rowsBottom)
        host.document.frame.size.height = DiffPanes.editorHeight(rowsBottom: rowsBottom)
        host.document.click = { [weak host] point in
            if let hit = host?.canvas.foldHit(at: point) {
                onFold(hit.foldIndex, hit.edge)
            }
        }
        if let scroll, scroll.token != host.scrolledToken {
            host.pendingScroll = scroll
        }
        host.needsLayout = true
    }

    final class Host: NSView {
        let canvas = DiffCanvas()
        let scrollView = NSScrollView()
        let document = FlippedView()

        override init(frame: NSRect) {
            super.init(frame: frame)
            clipsToBounds = true
            scrollView.drawsBackground = false
            scrollView.hasVerticalScroller = false
            scrollView.hasHorizontalScroller = false
            scrollView.documentView = document
            scrollView.contentView.postsBoundsChangedNotifications = true
            addSubview(canvas)
            addSubview(scrollView)
            NotificationCenter.default.addObserver(
                self, selector: #selector(scrolled), name: NSView.boundsDidChangeNotification,
                object: scrollView.contentView
            )
        }

        required init?(coder: NSCoder) {
            nil
        }

        override var isFlipped: Bool {
            true
        }

        /// A centering asked for and not yet done: it needs the viewport's height, known after layout.
        var pendingScroll: DiffState.ScrollRequest?
        private(set) var scrolledToken = 0

        override func layout() {
            super.layout()
            canvas.frame = bounds
            scrollView.frame = bounds
            document.frame.size.width = bounds.width
            if let request = pendingScroll, bounds.height > 0 {
                pendingScroll = nil
                scrolledToken = request.token
                let offset = DiffNavigation.centeredOffset(
                    rowTop: request.rowTop, viewport: bounds.height, contentHeight: document.frame.height
                )
                scrollView.contentView.scroll(to: NSPoint(x: 0, y: offset))
                scrollView.reflectScrolledClipView(scrollView.contentView)
            }
            scrolled()
        }

        @objc private func scrolled() {
            canvas.offset = scrollView.contentView.bounds.origin.y
        }
    }

    /// The scrolled document: its coordinates are the content's, so a click lands on the row under it.
    final class FlippedView: NSView {
        var click: ((NSPoint) -> Void)?

        override var isFlipped: Bool {
            true
        }

        override func mouseDown(with event: NSEvent) {
            click?(convert(event.locationInWindow, from: nil))
        }
    }
}
