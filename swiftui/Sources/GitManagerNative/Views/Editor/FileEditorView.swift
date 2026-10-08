// The file's editor (CodeMirror in FileView.svelte), measured in swiftui/Reference/file-<mode>/file-layout.json: the
// scroller with its gutters and code (FileCanvas), then the 12-point overview ruler at the right edge (.cm-scroll-
// markers, which the editor's scroller leaves room for). A transparent scroll view over the canvas takes the scroll
// gestures and clicks; the canvas redraws the viewport at each new offset.

import AppKit
import NativeCore
import SwiftUI

struct FileEditorView: View {
    @Environment(\.theme) private var theme

    let file: OpenFile
    let cursor: (line: Int, column: Int)
    let blameLabel: String?
    var moveCursor: (Int, Int) -> Void = { _, _ in }

    var body: some View {
        HStack(spacing: 0) {
            FileScrollView(
                content: FileCanvas.Content(file: file, theme: theme, cursor: cursor, blameLabel: blameLabel),
                moveCursor: moveCursor
            )
            // .cm-scroll-markers: 12 points of --panel-alt with a 1-point --border-strong left border; an unchanged
            // file has no ticks.
            HStack(spacing: 0) {
                theme.color("--border-strong").frame(width: 1)
                theme.color("--panel-alt")
            }
            .frame(width: EditorGeometry.rulerWidth)
        }
        .background(theme.color("--editor-bg"))
    }
}

struct FileScrollView: NSViewRepresentable {
    let content: FileCanvas.Content
    let moveCursor: (Int, Int) -> Void

    func makeNSView(context: Context) -> Host {
        Host()
    }

    func updateNSView(_ host: Host, context: Context) {
        host.canvas.content = content
        host.document.click = { [weak host] point in
            guard let host, let position = host.canvas.position(at: host.canvasPoint(point)) else {
                return
            }
            moveCursor(position.line, position.column)
        }
        host.needsLayout = true
    }

    final class Host: NSView {
        let canvas = FileCanvas()
        let scrollView = NSScrollView()
        let document = DiffScrollView.FlippedView()

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

        override func layout() {
            super.layout()
            canvas.frame = bounds
            scrollView.frame = bounds
            if let content = canvas.content {
                let geometry = content.geometry
                let scrollWidth = CGFloat(geometry.guttersWidth)
                    + max(CGFloat(geometry.contentWidth), canvas.noteEnd(content))
                let wide = scrollWidth > canvas.visibleWidth + 0.5
                document.frame.size = CGSize(
                    width: wide ? scrollWidth + (bounds.width - canvas.visibleWidth) : bounds.width,
                    height: max(bounds.height, CGFloat(geometry.documentHeight(viewport: Double(bounds.height))))
                )
            }
            scrolled()
        }

        /// A point in the scrolled document as a point on the canvas.
        func canvasPoint(_ point: NSPoint) -> NSPoint {
            let origin = scrollView.contentView.bounds.origin
            return NSPoint(x: point.x - origin.x, y: point.y - origin.y)
        }

        @objc private func scrolled() {
            let origin = scrollView.contentView.bounds.origin
            canvas.offset = origin.y
            canvas.offsetX = origin.x
        }
    }
}
