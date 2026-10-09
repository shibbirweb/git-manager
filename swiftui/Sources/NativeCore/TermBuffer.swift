// The terminal's lines: the screen rows below the scrollback, kept in a ring (xterm.js's CircularList) so a full
// scrollback drops its oldest line without moving the others.

public final class TermLine {
    public internal(set) var cells: [TermCell]
    /// The line continues the one above it (it was wrapped there, not ended by a line feed).
    public internal(set) var isWrapped = false
    /// Characters with combining marks, by column: the cell keeps the base scalar.
    public internal(set) var combined: [Int: String] = [:]

    init(columns: Int, fill: TermCell = .empty) {
        cells = [TermCell](repeating: fill, count: columns)
    }

    /// The text of the line, empty cells as spaces and right halves of wide characters skipped.
    public func text(trimRight: Bool = true) -> String {
        var text = ""
        for (column, cell) in cells.enumerated() where cell.width > 0 {
            if let joined = combined[column] {
                text += joined
            } else {
                text.append(cell.character ?? " ")
            }
        }
        if trimRight {
            while text.last == " " {
                text.removeLast()
            }
        }
        return text
    }

    func resize(columns: Int, fill: TermCell) {
        if columns < cells.count {
            cells.removeLast(cells.count - columns)
            combined = combined.filter { $0.key < columns }
        } else if columns > cells.count {
            cells += [TermCell](repeating: fill, count: columns - cells.count)
        }
    }

    func fill(_ cell: TermCell, from start: Int, to end: Int) {
        let low = max(0, start), high = min(cells.count, end)
        guard low < high else {
            return
        }
        for column in low..<high {
            cells[column] = cell
            combined[column] = nil
        }
    }
}

/// A ring of lines with a fixed capacity: pushing past it drops the oldest.
struct TermRing {
    private var storage: [TermLine?]
    private var start = 0
    private(set) var count = 0

    init(capacity: Int) {
        storage = [TermLine?](repeating: nil, count: max(1, capacity))
    }

    var capacity: Int { storage.count }
    var isFull: Bool { count == storage.count }

    subscript(index: Int) -> TermLine {
        get { storage[(start + index) % storage.count]! }
        set { storage[(start + index) % storage.count] = newValue }
    }

    /// Adds a line at the end; when full, the first line is dropped and true is returned.
    @discardableResult
    mutating func push(_ line: TermLine) -> Bool {
        if count < storage.count {
            storage[(start + count) % storage.count] = line
            count += 1
            return false
        }
        storage[start] = line
        start = (start + 1) % storage.count
        return true
    }

    mutating func removeLast() {
        guard count > 0 else {
            return
        }
        storage[(start + count - 1) % storage.count] = nil
        count -= 1
    }

    /// Moves lines first...last up or down by one inside that range (a scroll region), the freed slot getting `line`.
    mutating func rotate(first: Int, last: Int, up: Bool, insert line: TermLine) {
        guard first <= last else {
            return
        }
        if up {
            for index in first..<last {
                self[index] = self[index + 1]
            }
            self[last] = line
        } else {
            var index = last
            while index > first {
                self[index] = self[index - 1]
                index -= 1
            }
            self[first] = line
        }
    }

    /// A new ring with another capacity, keeping the newest lines.
    func resized(capacity: Int) -> TermRing {
        var ring = TermRing(capacity: capacity)
        let keep = min(count, ring.capacity)
        for index in (count - keep)..<count {
            ring.push(self[index])
        }
        return ring
    }

    func lines() -> [TermLine] {
        (0..<count).map { self[$0] }
    }
}

/// One screen (normal or alternate): its lines, cursor and scroll region.
public final class TermScreen {
    var ring: TermRing
    public internal(set) var columns: Int
    public internal(set) var rows: Int
    /// Index of the screen's top row in `ring` (the scrollback length).
    public internal(set) var base = 0
    /// Cursor, 0-based within the screen.
    public internal(set) var cursorX = 0
    public internal(set) var cursorY = 0
    var scrollTop = 0
    var scrollBottom: Int
    var saved = SavedCursor()
    let hasScrollback: Bool

    struct SavedCursor {
        var x = 0
        var y = 0
        var style = TermStyle.plain
        var originMode = false
        var charsetG0Line = false
    }

    init(columns: Int, rows: Int, scrollback: Int) {
        self.columns = columns
        self.rows = rows
        hasScrollback = scrollback > 0
        ring = TermRing(capacity: rows + max(0, scrollback))
        scrollBottom = rows - 1
        for _ in 0..<rows {
            ring.push(TermLine(columns: columns))
        }
    }

    public var lineCount: Int { ring.count }

    public func line(_ index: Int) -> TermLine {
        ring[index]
    }

    /// The screen row `row` (0 is the top of the screen).
    public func row(_ row: Int) -> TermLine {
        ring[base + row]
    }
}
