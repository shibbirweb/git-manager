// The file's editor (CodeMirror in FileView.svelte), measured in swiftui/Reference/file-<mode>/file-layout.json: the
// scroller with its gutters and code (FileCanvas), then the 12-point overview ruler at the right edge (.cm-scroll-
// markers, which the editor's scroller leaves room for). A transparent scroll view over the canvas takes the scroll
// gestures; its document view takes the clicks and drags, and the host takes the keyboard
// (FileEditorInput.swift). The canvas redraws the viewport at each new offset and after each change.

import AppKit
import NativeCore
import SwiftUI

struct FileEditorView: View {
    @Environment(\.theme) private var theme

    let session: EditorSession
    /// EditorModel's revision: every change of the session draws again.
    let revision: Int
    let blameLabel: String?

    var body: some View {
        HStack(spacing: 0) {
            FileScrollView(session: session, revision: revision, blameLabel: blameLabel, theme: theme)
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
    let session: EditorSession
    let revision: Int
    let blameLabel: String?
    let theme: Theme

    func makeNSView(context: Context) -> Host {
        Host()
    }

    func updateNSView(_ host: Host, context: Context) {
        let opened = host.session !== session
        host.session = session
        host.blameLabel = blameLabel
        host.theme = theme
        host.redraw()
        if opened {
            // A file that opens takes the keyboard, as CodeMirror focuses a new file view.
            DispatchQueue.main.async {
                host.window?.makeFirstResponder(host)
            }
        }
        host.needsLayout = true
    }

    final class Host: NSView {
        let canvas = FileCanvas()
        let scrollView = NSScrollView()
        let document = EditorDocumentView()
        var session: EditorSession?
        var blameLabel: String?
        var theme = Theme.standard(for: .light)
        /// Where a drag started (the selection's anchor) and how many clicks began it.
        var dragAnchor: (position: Int, clicks: Int)?

        override init(frame: NSRect) {
            super.init(frame: frame)
            clipsToBounds = true
            scrollView.drawsBackground = false
            scrollView.hasVerticalScroller = false
            scrollView.hasHorizontalScroller = false
            scrollView.documentView = document
            scrollView.contentView.postsBoundsChangedNotifications = true
            document.host = self
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

        override var acceptsFirstResponder: Bool {
            true
        }

        override func becomeFirstResponder() -> Bool {
            DispatchQueue.main.async { [weak self] in
                self?.redraw()
            }
            return true
        }

        override func resignFirstResponder() -> Bool {
            DispatchQueue.main.async { [weak self] in
                self?.redraw()
            }
            return true
        }

        var focused: Bool {
            window?.firstResponder === self && window?.isKeyWindow == true
        }

        /// The canvas's content from the session as it is now.
        func redraw() {
            guard let session else {
                return
            }
            // Settings > Editor > Cursor blinking is not in the native settings yet: the current app's default.
            canvas.content = FileCanvas.Content(session: session, blameLabel: blameLabel, theme: theme,
                                                focused: focused, blinking: "blink")
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
            session?.pageRows = max(1, Int(bounds.height / CGFloat(EditorGeometry.lineHeight)) - 1)
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

        /// Scrolls the main cursor into view (scrollIntoView), keeping a line of margin above and below.
        func scrollToCursor() {
            guard let session, let content = canvas.content else {
                return
            }
            needsLayout = true
            layoutSubtreeIfNeeded()
            let head = session.state.selection.main.head
            let row = canvas.row(of: head, content)
            let lineHeight = CGFloat(EditorGeometry.lineHeight)
            var origin = scrollView.contentView.bounds.origin
            let top = canvas.rowTop(row) + canvas.offset
            let height = bounds.height
            if top - lineHeight < origin.y {
                origin.y = max(0, top - lineHeight)
            } else if top + 2 * lineHeight > origin.y + height {
                origin.y = top + 2 * lineHeight - height
            }
            // x in the document: the gutters, the line's left padding, then the text.
            let textLeft = CGFloat(content.geometry.guttersWidth) + EditorGeometry.linePadding.left
            let x = textLeft + canvas.x(of: head, row: row, content)
            if x - origin.x < textLeft {
                origin.x = max(0, x - textLeft)
            } else if x - origin.x > canvas.visibleWidth - 8 {
                origin.x = x - canvas.visibleWidth + 8
            }
            scrollView.contentView.scroll(to: origin)
            scrollView.reflectScrolledClipView(scrollView.contentView)
        }
    }
}

/// The scrolled document: as tall and wide as the editor's content, flipped, passing clicks and drags to its host.
final class EditorDocumentView: NSView {
    weak var host: FileScrollView.Host?

    override var isFlipped: Bool {
        true
    }

    override func mouseDown(with event: NSEvent) {
        host?.pressed(event, at: convert(event.locationInWindow, from: nil))
    }

    override func mouseDragged(with event: NSEvent) {
        host?.dragged(to: convert(event.locationInWindow, from: nil))
    }

    override func mouseUp(with event: NSEvent) {
        host?.dragAnchor = nil
    }
}
