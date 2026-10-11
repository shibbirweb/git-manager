// Dragging text in the file editor, as WebKit drags a selection of the page's editor: a press on the main selection
// waits; 3 points of movement (WebKit's text drag threshold) start a system drag of its text (so it also goes to
// other apps), a release without that selects as a click there. A drop of text into the editor goes in at the
// drop position, selected: from this editor's own drag it moves the text, with Option held it copies it, from
// elsewhere it is inserted (NativeCore TextDrop). The page shows no drop cursor (its caret color is transparent),
// so neither does this. Dropped files are left to the window.

import AppKit
import NativeCore

extension FileScrollView.Host {
    /// Whether a canvas point is on the main selection's text (isInPrimarySelection): its rows, from its start on
    /// the first and to its end on the last, else to the line's end.
    func inMainSelection(_ canvasPoint: NSPoint) -> Bool {
        guard let session, let content = canvas.content else {
            return false
        }
        let main = session.state.selection.main
        guard !main.isEmpty else {
            return false
        }
        let row = canvas.row(at: canvasPoint.y, content)
        let first = canvas.row(of: main.from, content), last = canvas.row(of: main.to, content)
        guard row >= first && row <= last else {
            return false
        }
        let doc = session.state.doc
        let lineEnd = doc.line(min(content.layout.lines(forRow: row).upperBound, doc.lineCount - 1)).to
        let left = row == first ? canvas.x(of: main.from, row: row, content) : 0
        let right = canvas.x(of: row == last ? main.to : lineEnd, row: row, content)
        let x = canvasPoint.x - canvas.textX(content)
        return x >= left && x <= right
    }

    /// A drag event while a press waits on the selection: past the threshold the text's drag starts.
    func dragText(_ event: NSEvent) -> Bool {
        guard let start = pendingTextDrag else {
            return false
        }
        let moved = max(abs(event.locationInWindow.x - start.locationInWindow.x),
                        abs(event.locationInWindow.y - start.locationInWindow.y))
        if moved >= 3 {
            pendingTextDrag = nil
            beginTextDrag(event)
        }
        return true
    }

    /// The mouse went up: a press that waited on the selection selects as a click (or a column click) now.
    func released() {
        dragAnchor = nil
        columnDrag = nil
        guard let event = pendingTextDrag else {
            return
        }
        pendingTextDrag = nil
        let point = canvasPoint(document.convert(event.locationInWindow, from: nil))
        if startColumnDrag(flags: event.modifierFlags, at: point) {
            columnDrag = nil
        } else if let hit = canvas.position(at: point) {
            clickSelect(event, hit: hit)
        }
    }

    private func beginTextDrag(_ event: NSEvent) {
        guard let session, let content = canvas.content else {
            return
        }
        let main = session.state.selection.main
        let text = session.state.sliceDoc(main.from, main.to)
        draggedContent = main.from..<main.to
        let image = TextDragImage.image(text, theme: theme)
        let row = canvas.row(of: main.from, content)
        let origin = scrollView.contentView.bounds.origin
        let topLeft = NSPoint(x: canvas.textX(content) + canvas.x(of: main.from, row: row, content) + origin.x,
                              y: canvas.rowTop(row) - 1 + origin.y)
        let item = NSDraggingItem(pasteboardWriter: text as NSString)
        item.setDraggingFrame(NSRect(origin: topLeft, size: image.size), contents: image)
        document.beginDraggingSession(with: [item], event: event, source: document)
    }

    /// A drop of `text` at a point of the scrolled document; `local` when it is this editor's own drag.
    func dropText(_ text: String, at documentPoint: NSPoint, local: Bool, copies: Bool) -> Bool {
        guard let session, let hit = canvas.position(at: canvasPoint(documentPoint)) else {
            return false
        }
        let dragged = local ? draggedContent : nil
        draggedContent = nil
        guard let spec = TextDrop.spec(session.state, text: text, at: hit.position, dragged: dragged,
                                       moves: dragged != nil && !copies) else {
            return false
        }
        window?.makeFirstResponder(self)
        session.dispatch(spec)
        redraw()
        return true
    }

    /// The control server's text drag (`app action=text_drag`): the main selection dropped at a line and column, as
    /// the drop of this editor's own drag does.
    func textDrag(to target: (line: Int, column: Int), copies: Bool) -> Bool {
        guard let session, let content = canvas.content, !session.state.selection.main.isEmpty else {
            return false
        }
        let main = session.state.selection.main
        draggedContent = main.from..<main.to
        let doc = session.state.doc
        let line = doc.line(max(0, min(doc.lineCount - 1, target.line - 1)))
        let row = canvas.row(of: line.from, content)
        let origin = scrollView.contentView.bounds.origin
        let point = NSPoint(x: canvas.textX(content) + CGFloat(target.column) * CodeLineText.advance + origin.x,
                            y: canvas.rowTop(row) + CGFloat(EditorGeometry.lineHeight) / 2 + origin.y)
        return dropText(session.state.sliceDoc(main.from, main.to), at: point, local: true, copies: copies)
    }
}

// The document view is the drag's source and the drops' target.
extension EditorDocumentView: NSDraggingSource {
    func draggingSession(_ session: NSDraggingSession, sourceOperationMaskFor context: NSDraggingContext)
        -> NSDragOperation {
        context == .withinApplication ? [.copy, .move] : .copy
    }

    func draggingSession(_ session: NSDraggingSession, endedAt screenPoint: NSPoint, operation: NSDragOperation) {
        host?.draggedContent = nil
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        operation(sender)
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        if let event = NSApp.currentEvent {
            autoscroll(with: event)
        }
        return operation(sender)
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        guard let host, operation(sender) != [],
              let text = sender.draggingPasteboard.string(forType: .string) else {
            return false
        }
        let local = (sender.draggingSource as? EditorDocumentView) === self
        return host.dropText(text, at: convert(sender.draggingLocation, from: nil), local: local,
                             copies: NSEvent.modifierFlags.contains(.option))
    }

    /// Move for this editor's own text without Option, else copy; nothing for files or no text.
    private func operation(_ sender: NSDraggingInfo) -> NSDragOperation {
        let pasteboard = sender.draggingPasteboard
        let files = pasteboard.canReadObject(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true])
        guard !files, pasteboard.string(forType: .string) != nil else {
            return []
        }
        let local = (sender.draggingSource as? EditorDocumentView) === self
        return local && !NSEvent.modifierFlags.contains(.option) ? .move : .copy
    }
}

/// The picture under the pointer while text is dragged: the text in the code font and --text at 75% (WebKit's
/// drag image alpha), its first 20 lines.
enum TextDragImage {
    static func image(_ text: String, theme: Theme) -> NSImage {
        let lines = text.components(separatedBy: "\n").prefix(20).map { String($0.prefix(200)) }
        let attributes: [NSAttributedString.Key: Any] = [
            .font: CodeFont.font(13), .foregroundColor: theme.textColor("--text").withAlphaComponent(0.75),
        ]
        let width = lines.map { ($0 as NSString).size(withAttributes: attributes).width }.max() ?? 1
        let height = CGFloat(lines.count) * CGFloat(EditorGeometry.lineHeight)
        return NSImage(size: NSSize(width: max(1, ceil(width)), height: max(1, height)), flipped: true) { _ in
            for (index, line) in lines.enumerated() {
                (line as NSString).draw(at: NSPoint(x: 0, y: CGFloat(index) * CGFloat(EditorGeometry.lineHeight)),
                                        withAttributes: attributes)
            }
            return true
        }
    }
}
