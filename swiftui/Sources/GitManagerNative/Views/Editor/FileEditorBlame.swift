// The blame gutter's clicks and tooltips (blame.ts blameGutter's click handler, BlameGutterMarker's title): a click
// on a block opens its commit in the Log (Option-click copies the hash); each block on screen has its own tooltip
// area, as each gutter cell has its own title on the page, rebuilt as the view scrolls.

import AppKit
import NativeCore

extension FileScrollView.Host: NSViewToolTipOwner {
    /// The 0-based line under canvas point `point` when it is on the blame gutter.
    func blameLine(at point: NSPoint) -> Int? {
        guard let content = canvas.content, content.blame != nil else {
            return nil
        }
        let left = CGFloat(content.geometry.numbersWidth), width = CGFloat(content.geometry.blameWidth)
        guard width > 0, point.x >= left, point.x < left + width else {
            return nil
        }
        return content.layout.lines(forRow: canvas.row(at: point.y, content)).lowerBound
    }

    /// The cursor line (0-based) when canvas point `point` is on its blame note: the page makes the note a link
    /// while Cmd is held.
    func noteLine(at point: NSPoint) -> Int? {
        guard let content = canvas.content, let label = content.blameLabel else {
            return nil
        }
        let head = content.state.selection.main.head
        let row = canvas.row(of: head, content)
        let left = CGFloat(content.geometry.guttersWidth) - canvas.offsetX
            + canvas.noteX(rowWidth: canvas.rowWidth(content, row: row))
        let right = left + ExactText.width(label, font: canvas.noteFont)
        let top = canvas.rowTop(row)
        guard point.x >= left, point.x < right, point.y >= top,
              point.y < top + CGFloat(EditorGeometry.lineHeight) else {
            return nil
        }
        return content.doc.lineAt(head).index
    }

    /// One tooltip area per gutter block on screen.
    func updateBlameTips() {
        removeAllToolTips()
        guard let content = canvas.content, let blame = content.blame, content.geometry.blameWidth > 0 else {
            return
        }
        let left = CGFloat(content.geometry.numbersWidth), width = CGFloat(content.geometry.blameWidth)
        let lineHeight = CGFloat(EditorGeometry.lineHeight)
        var start: (top: CGFloat, owner: Int)?
        var bottom: CGFloat = 0
        for row in canvas.rows(content, from: 0, to: bounds.height, spill: 0) {
            let line = content.layout.lines(forRow: row).lowerBound
            let owner = blame.lines.indices.contains(line) ? blame.lines[line] : BlameLines.localEdit
            let top = canvas.rowTop(row)
            if let open = start, open.owner != owner {
                addToolTip(NSRect(x: left, y: open.top, width: width, height: bottom - open.top), owner: self,
                           userData: nil)
                start = nil
            }
            if start == nil {
                start = (top, owner)
            }
            bottom = top + lineHeight
        }
        if let open = start {
            addToolTip(NSRect(x: left, y: open.top, width: width, height: bottom - open.top), owner: self,
                       userData: nil)
        }
    }

    func view(_ view: NSView, stringForToolTip tag: NSView.ToolTipTag, point: NSPoint,
              userData data: UnsafeMutableRawPointer?) -> String {
        blameLine(at: point).flatMap(blameTooltip) ?? ""
    }
}

extension FileScrollView.Host {
    /// Centers the main cursor's row (scrollIntoView with y: "center"), as a change reached from the file bar is.
    func centerCursor() {
        guard let session, let content = canvas.content else {
            return
        }
        needsLayout = true
        layoutSubtreeIfNeeded()
        let row = canvas.row(of: session.state.selection.main.head, content)
        let top = canvas.rowTop(row) + canvas.offset
        let lineHeight = CGFloat(EditorGeometry.lineHeight)
        let most = max(0, document.frame.height - bounds.height)
        var origin = scrollView.contentView.bounds.origin
        origin.y = min(most, max(0, top + lineHeight / 2 - bounds.height / 2))
        scrollView.contentView.scroll(to: origin)
        scrollView.reflectScrolledClipView(scrollView.contentView)
    }
}

extension FileScrollView.Host {
    /// Takes the keyboard unless one of the window's dialogs is open (it keeps it, as the page's dialog does).
    func takeKeyboard() {
        if WindowContext.of(window)?.dialogs.prompt == nil {
            window?.makeFirstResponder(self)
        }
    }
}
