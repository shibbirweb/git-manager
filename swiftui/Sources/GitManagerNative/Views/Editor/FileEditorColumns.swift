// Column selection in the file editor (features.ts columnSelection: rectangularSelection with Option and without
// Shift, crosshairCursor on Option): Option+drag selects the rectangle between where it started and the pointer,
// one range per line (NativeCore ColumnSelection), replacing the selection (no key adds to it here: the page's
// clickAddsSelectionRange needs Shift, which this drag leaves out). The
// pointer is WebKit's over the editable text (an I-beam), an arrow over the gutters, and a crosshair over the text
// while Option is held and column selection is on (Settings editorColumnSelection).

import AppKit
import NativeCore

/// A column drag in progress: where it started, the selection it started from, and the text it was made on.
struct ColumnDrag {
    var start: ColumnSelection.Point
    var startSelection: EditorSelection
    var doc: TextDocument
}

extension FileScrollView.Host {
    var columnSelectionOn: Bool {
        SettingsStore.shared.preferences.editorColumnSelection
    }

    /// Starts a column drag for a press with Option (and not Shift); false when the press is not one.
    func startColumnDrag(flags: NSEvent.ModifierFlags, at canvasPoint: NSPoint) -> Bool {
        guard columnSelectionOn, flags.contains(.option), !flags.contains(.shift), let session,
              let point = columnPoint(canvasPoint) else {
            return false
        }
        let state = session.state
        columnDrag = ColumnDrag(start: point, startSelection: state.selection, doc: state.doc)
        dragAnchor = nil
        selectColumns(to: canvasPoint)
        return true
    }

    /// Follows the pointer during a column drag; false when no column drag is going on.
    func dragColumns(to canvasPoint: NSPoint) -> Bool {
        guard columnDrag != nil else {
            return false
        }
        selectColumns(to: canvasPoint)
        scrollToCursor()
        return true
    }

    private func selectColumns(to canvasPoint: NSPoint) {
        guard let session, let drag = columnDrag, let point = columnPoint(canvasPoint) else {
            return
        }
        let state = session.state
        // The text changed under the drag (a file read again): the drag ends there.
        guard drag.doc.sameText(state.doc) else {
            columnDrag = nil
            return
        }
        let selection = ColumnSelection.selection(
            state.doc, from: drag.start, to: point, tabSize: state.config.tabSize,
            adding: nil
        ) ?? drag.startSelection
        session.dispatch(TransactionSpec(selection: selection, userEvent: "select.pointer"))
        redraw()
    }

    /// The control server's column drag (`app action=column_drag`): pressed at one line and column, dragged to
    /// another, as the mouse would (columns at character edges, half a row down).
    func columnDrag(from start: (line: Int, column: Int), to end: (line: Int, column: Int)) -> Bool {
        guard let session, let content = canvas.content else {
            return false
        }
        let doc = session.state.doc
        let point = { (place: (line: Int, column: Int)) -> NSPoint in
            let line = doc.line(max(0, min(doc.lineCount - 1, place.line - 1)))
            let row = self.canvas.row(of: line.from, content)
            return NSPoint(x: self.canvas.textX(content) + CGFloat(place.column) * CodeLineText.advance,
                           y: self.canvas.rowTop(row) + CGFloat(EditorGeometry.lineHeight) / 2)
        }
        guard startColumnDrag(flags: [.option], at: point(start)) else {
            return false
        }
        _ = dragColumns(to: point(end))
        columnDrag = nil
        return true
    }

    /// getPos: the line and column under a canvas point; past a line's end, the column the x gives.
    private func columnPoint(_ canvasPoint: NSPoint) -> ColumnSelection.Point? {
        guard let session, let content = canvas.content, let hit = canvas.position(at: canvasPoint) else {
            return nil
        }
        let pointer = Int((abs(canvasPoint.x - canvas.textX(content)) / CodeLineText.advance).rounded())
        return ColumnSelection.point(session.state.doc, position: hit.position, pointerColumn: pointer,
                                     tabSize: session.state.config.tabSize)
    }

    /// The pointer over a canvas point: an arrow over the gutters, else an I-beam, or a crosshair with Option.
    func pointerShape(at canvasPoint: NSPoint, option: Bool) -> NSCursor {
        guard let content = canvas.content, canvasPoint.x >= CGFloat(content.geometry.guttersWidth) else {
            return .arrow
        }
        return option && columnSelectionOn ? .crosshair : .iBeam
    }

    /// Option went down or up: the pointer over the editor changes at once (the page's keydown and keyup).
    override func flagsChanged(with event: NSEvent) {
        super.flagsChanged(with: event)
        guard let window else {
            return
        }
        let point = convert(window.convertPoint(fromScreen: NSEvent.mouseLocation), from: nil)
        if bounds.contains(point) {
            pointerShape(at: point, option: event.modifierFlags.contains(.option)).set()
        }
    }
}
