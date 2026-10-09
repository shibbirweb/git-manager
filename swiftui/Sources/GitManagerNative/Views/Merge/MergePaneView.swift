// A merge pane in the window: the canvas under a transparent scroll view that takes the gestures, and the overview
// ruler strip on its right edge. The three panes scroll together through MergeScrollSync, as MergeEditor.svelte's
// onScroll maps the center line of the pane scrolled to the others through the chunk anchors.

import AppKit
import NativeCore
import SwiftUI

enum MergePane: Int, CaseIterable {
    case ours
    case result
    case theirs
}

/// The panes' scroll offsets, shared with the connectors; a scroll of one pane moves the others to the same place.
@MainActor
final class MergeScrollSync: ObservableObject {
    @Published private(set) var offsets: [MergePane: CGFloat] = [:]
    private var hosts: [MergePane: MergePaneScroll.Host] = [:]
    private var lock: MergePane?
    var anchors: (_ pane: MergePane) -> [MergeNavigation.Anchor] = { _ in [] }
    private(set) var clientHeight: CGFloat = 0

    /// The panes on screen, for the control server's merge state.
    static weak var shown: MergeScrollSync?

    func register(_ host: MergePaneScroll.Host, pane: MergePane) {
        hosts[pane] = host
        Self.shown = self
    }

    /// Each pane's scroll offset, client height and scrollbars, for the control server.
    var panesState: [String: Any] {
        var state: [String: Any] = [:]
        for (pane, host) in hosts {
            let canvas = host.canvas
            state["\(pane)"] = [
                "offset": canvas.offset, "clientHeight": canvas.clientHeight,
                "vertical": canvas.scrollbars.vertical, "horizontal": canvas.scrollbars.horizontal,
            ]
        }
        return state
    }

    func offset(_ pane: MergePane) -> CGFloat {
        offsets[pane] ?? 0
    }

    /// A pane moved (the user, or a reveal): record it and bring the others to the same line.
    func scrolled(_ pane: MergePane, to offset: CGFloat, clientHeight height: CGFloat) {
        clientHeight = height
        if offsets[pane] != offset {
            offsets[pane] = offset
        }
        guard lock == nil || lock == pane else {
            return
        }
        lock = pane
        defer {
            lock = nil
        }
        let center = Double((offset + height / 2 - MergePaneCanvas.padding) / MergePaneCanvas.lineHeight)
        let resultLine = pane == .result
            ? center
            : MergeNavigation.mapLine(center, anchors(pane))
        for other in MergePane.allCases where other != pane {
            let line = other == .result ? resultLine : MergeNavigation.mapLine(resultLine, invertedAnchors(other))
            hosts[other]?.scroll(toLine: line)
        }
    }

    private func invertedAnchors(_ pane: MergePane) -> [MergeNavigation.Anchor] {
        MergeNavigation.invert(anchors(pane))
    }
}

struct MergePaneView: View {
    @Environment(\.theme) private var theme

    let pane: MergePane
    let content: MergePaneCanvas.Content
    let marks: [MergeLineMark]
    let sync: MergeScrollSync
    var reveal: (token: Int, line: Int)?

    var body: some View {
        MergePaneScroll(pane: pane, content: content, sync: sync, reveal: reveal)
            .overlay(alignment: .trailing) {
                strip
            }
    }

    /// .cm-scroll-markers: 12 points of --panel-alt with a --border-strong left border, a tick per chunk 2 points in
    /// from each side (1 for a conflict), at the chunk's share of the document's height.
    private var strip: some View {
        GeometryReader { proxy in
            let ticks = MergePaneLayout.ticks(
                marks: marks, lineCount: content.lines.count, lineHeight: MergePaneCanvas.lineHeight,
                padding: MergePaneCanvas.padding, trackHeight: proxy.size.height
            )
            ZStack(alignment: .topLeading) {
                theme.color("--panel-alt")
                theme.color("--border-strong").frame(width: 1)
                ForEach(Array(ticks.enumerated()), id: \.offset) { _, tick in
                    let inset: CGFloat = tick.type == .conflict ? 1 : 2
                    RoundedRectangle(cornerRadius: 1)
                        .fill(tickColor(tick.type))
                        .frame(width: 11 - inset * 2, height: tick.height)
                        .offset(x: 1 + inset, y: tick.top)
                }
            }
        }
        .frame(width: MergePaneCanvas.stripWidth)
    }

    private func tickColor(_ type: ChangeType) -> Color {
        switch type {
        case .added:
            return theme.color("--diff-added-edge")
        case .modified:
            return theme.color("--diff-modified-edge")
        case .deleted, .conflict:
            return theme.color("--danger")
        }
    }
}

struct MergePaneScroll: NSViewRepresentable {
    let pane: MergePane
    let content: MergePaneCanvas.Content
    let sync: MergeScrollSync
    let reveal: (token: Int, line: Int)?

    func makeNSView(context: Context) -> Host {
        let host = Host()
        host.pane = pane
        host.sync = sync
        sync.register(host, pane: pane)
        return host
    }

    func updateNSView(_ host: Host, context: Context) {
        host.canvas.content = content
        host.document.frame.size.height = host.canvas.documentHeight
        if let reveal, reveal.token != host.revealedToken {
            host.pendingReveal = reveal
        }
        host.needsLayout = true
    }

    final class Host: NSView {
        let canvas = MergePaneCanvas()
        let scrollView = NSScrollView()
        let document = FlippedDocument()
        var pane = MergePane.result
        weak var sync: MergeScrollSync?
        var pendingReveal: (token: Int, line: Int)?
        private(set) var revealedToken = 0
        /// The line last centered and the height it was centered in: SwiftUI can lay the pane out at a passing size
        /// first, so the line is centered again at each new height until the user scrolls.
        private var revealed: (line: Int, height: CGFloat)?
        private var revealing = false
        private var inLayout = false
        private var programmatic = false

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

        override func setFrameSize(_ newSize: NSSize) {
            super.setFrameSize(newSize)
            needsLayout = true
        }

        override func layout() {
            super.layout()
            // A size change moves nothing for the user: the other panes follow only real scrolls and reveals.
            inLayout = true
            defer {
                inLayout = false
            }
            canvas.frame = bounds
            canvas.shownScrollbars = canvas.scrollbars
            scrollView.frame = CGRect(x: 0, y: 0, width: canvas.clientWidth, height: canvas.clientHeight)
            document.frame.size.width = canvas.clientWidth
            if pendingReveal == nil, let revealed, revealed.height != canvas.clientHeight {
                pendingReveal = (revealedToken, revealed.line)
            }
            if let request = pendingReveal, bounds.height > 0 {
                pendingReveal = nil
                revealedToken = request.token
                revealed = (request.line, canvas.clientHeight)
                let rowTop = Double(MergePaneCanvas.padding) + Double(request.line) * Double(MergePaneCanvas.lineHeight)
                let offset = DiffNavigation.centeredOffset(
                    rowTop: rowTop, viewport: Double(canvas.clientHeight), contentHeight: Double(document.frame.height)
                )
                revealing = true
                move(to: CGFloat(offset))
                revealing = false
                // The other panes follow on the next turn, as the page maps them a frame later: by then each has
                // laid out and measured its lines where it stood (which keeps a long first line's scrollbar).
                let pane = self.pane
                let height = canvas.clientHeight
                DispatchQueue.main.async { [weak self] in
                    guard let self else {
                        return
                    }
                    self.sync?.scrolled(pane, to: self.canvas.offset, clientHeight: height)
                }
            }
            // The lines are measured where the pane now stands: a pane centered on a change never measures the
            // top of the file, as on the page, where the reveal comes before the first measure.
            canvas.measureWidth()
            canvas.shownScrollbars = canvas.scrollbars
            scrollView.frame = CGRect(x: 0, y: 0, width: canvas.clientWidth, height: canvas.clientHeight)
            document.frame.size.width = canvas.clientWidth
            scrolled()
        }

        /// Centers the fractional line `position` (CodeMirror's scrollToLine), within the document.
        func scroll(toLine position: Double) {
            programmatic = true
            defer {
                programmatic = false
            }
            // The lines now drawn can show or hide the horizontal scrollbar, which changes the height to center in:
            // once more at the new height, as the page measures the scroller after its lines.
            for _ in 0..<2 {
                let height = canvas.clientHeight
                let target = MergePaneCanvas.padding + CGFloat(position) * MergePaneCanvas.lineHeight - height / 2
                move(to: min(max(0, document.frame.height - height), max(0, target)))
                if canvas.clientHeight == height {
                    break
                }
            }
        }

        private func move(to offset: CGFloat) {
            scrollView.contentView.scroll(to: NSPoint(x: 0, y: offset))
            scrollView.reflectScrolledClipView(scrollView.contentView)
            canvas.offset = scrollView.contentView.bounds.origin.y
        }

        @objc private func scrolled() {
            let offset = scrollView.contentView.bounds.origin.y
            // A scroll the user made ends the centering on resize.
            if !programmatic && !revealing && !inLayout && offset != canvas.offset {
                revealed = nil
            }
            canvas.offset = offset
            let height = canvas.clientHeight
            let pane = self.pane
            let quiet = programmatic || inLayout
            MainActor.assumeIsolated {
                if quiet {
                    sync?.record(pane, offset: offset)
                } else {
                    sync?.scrolled(pane, to: offset, clientHeight: height)
                }
            }
        }
    }

    final class FlippedDocument: NSView {
        override var isFlipped: Bool {
            true
        }
    }
}

extension MergeScrollSync {
    /// A pane moved by the sync itself: only its offset changes, so the connectors follow.
    func record(_ pane: MergePane, offset: CGFloat) {
        if offsets[pane] != offset {
            offsets[pane] = offset
        }
    }
}
