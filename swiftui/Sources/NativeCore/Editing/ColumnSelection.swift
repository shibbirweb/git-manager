// Column selection (@codemirror/view's rectangularSelection, on in the current app's editors as Option+drag): the
// drag's start and its current point are each a line and a visual column (tabs expanded; past a line's end, the
// column the pointer's x gives), and every line between them gets the range between the two columns, or a cursor at
// its end when it is too short. Past 2000 characters into a line, offsets stand in for columns (MaxOff). Cmd while
// dragging keeps the selection the drag started from as well.

import Foundation

public enum ColumnSelection {
    /// MaxOff: beyond this offset in a line, columns are not worked out.
    public static let maxOffset = 2000

    /// A drag point: its 1-based line, its column (-1 when not worked out) and its offset in the line.
    public struct Point: Equatable, Sendable {
        public var line: Int
        public var column: Int
        public var offset: Int

        public init(line: Int, column: Int, offset: Int) {
            self.line = line
            self.column = column
            self.offset = offset
        }
    }

    /// getPos: the point for document position `position` (posAtCoords, not precise); at a line's end the column
    /// comes from the pointer, `pointerColumn` (its x from the text's left over a character's width, rounded).
    public static func point(_ doc: TextDocument, position: Int, pointerColumn: Int, tabSize: Int) -> Point {
        let line = doc.lineAt(position)
        let offset = position - line.from
        let column = offset > maxOffset ? -1
            : offset == line.length ? pointerColumn
            : TextUnits.countColumn(line.text, tabSize: tabSize, to: offset)
        return Point(line: line.number, column: column, offset: offset)
    }

    /// rectangleFor: one range per line from `start` to `end`'s line.
    public static func ranges(_ doc: TextDocument, from start: Point, to end: Point, tabSize: Int) -> [SelectionRange] {
        let first = min(start.line, end.line), last = max(start.line, end.line)
        var ranges: [SelectionRange] = []
        if start.offset > maxOffset || end.offset > maxOffset || start.column < 0 || end.column < 0 {
            let startOffset = min(start.offset, end.offset), endOffset = max(start.offset, end.offset)
            for number in first...last {
                let line = doc.line(number - 1)
                // The page adds the end offset to the line's end here (rectangleFor's own sum), kept as it is.
                if line.length <= endOffset {
                    ranges.append(.range(line.from + startOffset, line.to + endOffset))
                }
            }
            return ranges
        }
        let startColumn = min(start.column, end.column), endColumn = max(start.column, end.column)
        for number in first...last {
            let line = doc.line(number - 1)
            guard let from = TextUnits.findColumn(line.text, column: startColumn, tabSize: tabSize, strict: true) else {
                ranges.append(.cursor(line.to))
                continue
            }
            let to = TextUnits.findColumn(line.text, column: endColumn, tabSize: tabSize) ?? line.length
            ranges.append(.range(line.from + from, line.from + to))
        }
        return ranges
    }

    /// The selection during the drag: the rectangle, with the starting selection's ranges when Cmd adds; nil keeps
    /// the starting selection (no ranges).
    public static func selection(_ doc: TextDocument, from start: Point, to end: Point, tabSize: Int,
                                 adding startSelection: EditorSelection?) -> EditorSelection? {
        let rectangle = ranges(doc, from: start, to: end, tabSize: tabSize)
        guard !rectangle.isEmpty else {
            return nil
        }
        return EditorSelection(rectangle + (startSelection?.ranges ?? []), mainIndex: 0)
    }
}
