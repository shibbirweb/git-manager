// The terminal canvas's mouse: a click focuses it and starts a selection, a drag extends it (cell boundaries, in
// lines of the scrollback and screen), and the wheel scrolls through the scrollback by lines, as xterm.js does with
// smooth scrolling off.

import AppKit
import NativeCore

extension TerminalCanvasView {
    override func mouseDown(with event: NSEvent) {
        window?.makeFirstResponder(self)
        let position = cellPosition(event)
        selection = position.map { TermSelection(anchor: $0, head: $0) }
    }

    override func mouseDragged(with event: NSEvent) {
        guard let anchor = selection?.anchor, let head = cellPosition(event) else {
            return
        }
        selection = TermSelection(anchor: anchor, head: head)
    }

    /// The cell boundary under the mouse, as a line of the scrollback and screen: a drag selects from one boundary
    /// to another.
    func cellPosition(_ event: NSEvent) -> TermPosition? {
        guard let term = session?.term, let metrics = frameModel?.glyphs.metrics else {
            return nil
        }
        let point = convert(event.locationInWindow, from: nil)
        let cellWidth = CGFloat(metrics.cellWidth) / CGFloat(metrics.scale)
        let cellHeight = CGFloat(metrics.cellHeight) / CGFloat(metrics.scale)
        let column = Int(((point.x - Self.padding.left) / cellWidth).rounded())
        let row = Int(((point.y - Self.padding.top) / cellHeight).rounded(.down))
        return TermPosition(
            line: term.viewTop + min(max(row, 0), term.rows - 1), column: min(max(column, 0), term.columns)
        )
    }

    override func scrollWheel(with event: NSEvent) {
        guard let term = session?.term, term.alternate == nil, let metrics = frameModel?.glyphs.metrics else {
            return
        }
        let lineHeight = CGFloat(metrics.cellHeight) / CGFloat(metrics.scale)
        scrollRemainder += event.hasPreciseScrollingDeltas ? event.scrollingDeltaY / lineHeight : event.scrollingDeltaY
        let lines = Int(scrollRemainder.rounded(.towardZero))
        scrollRemainder -= CGFloat(lines)
        if lines != 0 && term.scrollView(by: -lines) {
            redraw()
        }
    }
}
