// A transparent scroll view over the Log's rows: it holds the list's full height, so the wheel and the trackpad
// scroll it as the page's .scroller does, and it hands the offset, the row under the mouse, clicks and the list's
// keys (arrows, Page Up and Down, Home, End) to LogListView, which draws the rows itself.

import AppKit
import NativeCore
import SwiftUI

struct LogScrollHost: NSViewRepresentable {
    /// Scroll to `offset`; a new token asks again.
    struct Request: Equatable {
        let token: Int
        let offset: CGFloat
    }

    let contentHeight: CGFloat
    let request: Request
    let onScroll: (CGFloat) -> Void
    let onHover: (Int?) -> Void
    let onClick: (Int) -> Void
    let onKey: (LogList.Key) -> Void

    func makeNSView(context: Context) -> Host {
        Host()
    }

    func updateNSView(_ host: Host, context: Context) {
        host.document.frame.size.height = max(contentHeight, host.bounds.height)
        host.document.rowCount = Int(contentHeight / LogList.rowHeight)
        host.onScroll = onScroll
        host.document.onHover = onHover
        host.document.onClick = onClick
        host.document.onKey = onKey
        if request.token != host.requestToken {
            host.requestToken = request.token
            host.scrollView.contentView.scroll(to: NSPoint(x: 0, y: request.offset))
            host.scrollView.reflectScrolledClipView(host.scrollView.contentView)
        }
    }

    final class Host: NSView {
        let scrollView = NSScrollView()
        let document = Document()
        var onScroll: (CGFloat) -> Void = { _ in }
        var requestToken = 0

        override init(frame: NSRect) {
            super.init(frame: frame)
            scrollView.drawsBackground = false
            scrollView.hasVerticalScroller = false
            scrollView.hasHorizontalScroller = false
            scrollView.documentView = document
            scrollView.contentView.postsBoundsChangedNotifications = true
            addSubview(scrollView)
            NotificationCenter.default.addObserver(
                self, selector: #selector(scrolled), name: NSView.boundsDidChangeNotification,
                object: scrollView.contentView
            )
        }

        required init?(coder: NSCoder) {
            nil
        }

        override func layout() {
            super.layout()
            scrollView.frame = bounds
            document.frame.size.width = bounds.width
            document.frame.size.height = max(document.frame.height, bounds.height)
        }

        @objc private func scrolled() {
            let offset = scrollView.contentView.bounds.origin.y
            onScroll(offset)
            document.refreshHover()
        }
    }

    /// The scrolled document, in the list's own coordinates: a point's row is its y over the row height.
    final class Document: NSView {
        var rowCount = 0
        var onHover: (Int?) -> Void = { _ in }
        var onClick: (Int) -> Void = { _ in }
        var onKey: (LogList.Key) -> Void = { _ in }
        private var lastMouse: NSPoint?

        override var isFlipped: Bool {
            true
        }

        override var acceptsFirstResponder: Bool {
            true
        }

        override func updateTrackingAreas() {
            super.updateTrackingAreas()
            for area in trackingAreas {
                removeTrackingArea(area)
            }
            let options: NSTrackingArea.Options = [
                .mouseMoved, .mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect,
            ]
            addTrackingArea(NSTrackingArea(rect: .zero, options: options, owner: self))
        }

        private func row(at point: NSPoint) -> Int? {
            let position = Int((point.y / LogList.rowHeight).rounded(.down))
            return position >= 0 && position < rowCount ? position : nil
        }

        override func mouseMoved(with event: NSEvent) {
            lastMouse = event.locationInWindow
            onHover(row(at: convert(event.locationInWindow, from: nil)))
        }

        override func mouseExited(with event: NSEvent) {
            lastMouse = nil
            onHover(nil)
        }

        /// The row under a resting mouse changes as the list scrolls under it.
        func refreshHover() {
            if let lastMouse {
                onHover(row(at: convert(lastMouse, from: nil)))
            }
        }

        override func mouseDown(with event: NSEvent) {
            window?.makeFirstResponder(self)
            if let position = row(at: convert(event.locationInWindow, from: nil)) {
                onClick(position)
            }
        }

        override func keyDown(with event: NSEvent) {
            let keys: [UInt16: LogList.Key] = [
                125: .down, 126: .up, 121: .pageDown, 116: .pageUp, 115: .home, 119: .end,
            ]
            if let key = keys[event.keyCode] {
                onKey(key)
            } else {
                super.keyDown(with: event)
            }
        }
    }
}
