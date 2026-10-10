// What a view of the terminal needs: resizing the grid (as xterm.js's Buffer.resize, without reflowing wrapped
// lines), the rows on screen with the scroll position, scrolling through the scrollback, and the text for find and
// the control tools.

extension TermEmulator {
    /// The line shown at screen row `row`, with the view's scroll position.
    public func visibleLine(_ row: Int) -> TermLine {
        let screen = self.screen
        return screen.line(screen.base - viewOffset + row)
    }

    /// The line index (in the scrollback and screen) shown at the view's top row.
    public var viewTop: Int {
        screen.base - viewOffset
    }

    /// The most the view can scroll up.
    public var maxViewOffset: Int {
        screen.base
    }

    /// Scrolls the view by `lines` (negative is up, into the scrollback); returns whether it moved.
    @discardableResult
    public func scrollView(by lines: Int) -> Bool {
        let next = min(max(viewOffset - lines, 0), maxViewOffset)
        guard next != viewOffset else {
            return false
        }
        viewOffset = next
        touch()
        return true
    }

    public func scrollViewToBottom() {
        if viewOffset != 0 {
            viewOffset = 0
            touch()
        }
    }

    /// Every line of the normal screen's scrollback and screen, trailing blanks trimmed.
    public func allText() -> [String] {
        normal.ring.lines().map { $0.text() }
    }

    /// The screen rows (not the scrollback), trailing blanks trimmed.
    public func screenText() -> [String] {
        (0..<rows).map { screen.row($0).text() }
    }

    public func resize(columns newColumns: Int, rows newRows: Int) {
        let newColumns = max(2, newColumns), newRows = max(1, newRows)
        guard newColumns != columns || newRows != rows else {
            return
        }
        for screen in [normal, alternate].compactMap({ $0 }) {
            resize(screen, columns: newColumns, rows: newRows)
        }
        columns = newColumns
        rows = newRows
        tabStops = tabStops.filter { $0 < newColumns }
        for stop in stride(from: 8, to: newColumns, by: 8) {
            tabStops.insert(stop)
        }
        viewOffset = min(viewOffset, maxViewOffset)
        touch()
    }

    private func resize(_ screen: TermScreen, columns newColumns: Int, rows newRows: Int) {
        if newColumns != screen.columns {
            for index in 0..<screen.ring.count {
                screen.line(index).resize(columns: newColumns, fill: .empty)
            }
            screen.columns = newColumns
            screen.cursorX = min(screen.cursorX, newColumns - 1)
        }
        let capacity = newRows + (screen.hasScrollback ? scrollback : 0)
        // A larger ring first, so the rows added below never push old lines out; a smaller one at the end.
        if capacity > screen.ring.capacity {
            screen.ring = screen.ring.resized(capacity: capacity)
        }
        if newRows > screen.rows {
            var added = newRows - screen.rows
            // Rows come back from the scrollback first, so the cursor keeps its line, then blank rows below.
            let restored = min(added, screen.hasScrollback ? screen.base : 0)
            screen.base -= restored
            screen.cursorY += restored
            added -= restored
            for _ in 0..<added {
                screen.ring.push(TermLine(columns: newColumns))
            }
        } else if newRows < screen.rows {
            var removed = screen.rows - newRows
            // Blank rows below the cursor go first, then rows at the top go into the scrollback.
            while removed > 0 && screen.ring.count - 1 > screen.base + screen.cursorY
                && screen.line(screen.ring.count - 1).text().isEmpty {
                screen.ring.removeLast()
                removed -= 1
            }
            screen.base += removed
            screen.cursorY = max(0, screen.cursorY - removed)
            if !screen.hasScrollback && screen.base > 0 {
                var ring = TermRing(capacity: newRows)
                for row in 0..<newRows {
                    ring.push(screen.line(screen.base + row))
                }
                screen.ring = ring
                screen.base = 0
            }
        }
        if capacity < screen.ring.capacity {
            let dropped = max(0, screen.ring.count - capacity)
            screen.ring = screen.ring.resized(capacity: capacity)
            screen.base = max(0, screen.base - dropped)
        }
        while screen.ring.count < screen.base + newRows {
            screen.ring.push(TermLine(columns: newColumns))
        }
        screen.rows = newRows
        screen.scrollTop = 0
        screen.scrollBottom = newRows - 1
        screen.cursorY = min(screen.cursorY, newRows - 1)
    }
}
