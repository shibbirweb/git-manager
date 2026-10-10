// The file editor's changes since the last commit (src/lib/editor/scrollMarkers.ts, navigation.ts and the file
// bar in FileView.svelte): the bridge's line_change_marks, the overview ruler's ticks, the change under the cursor
// and where Previous and Next change go, and the file bar's "No changes" / "1 of 2" label.

import Foundation

public struct LineMark: Decodable, Equatable, Sendable {
    /// Half-open 0-based line range in the editor's text; empty for a deletion.
    public let from: Int
    public let to: Int
    /// "added", "modified", "deleted" or "conflict".
    public let kind: String

    public init(from: Int, to: Int, kind: String) {
        self.from = from
        self.to = to
        self.kind = kind
    }
}

public enum ChangeMarks {
    /// sectionAt: the mark holding 0-based `line`, or -1.
    public static func section(_ marks: [LineMark], at line: Int) -> Int {
        for (index, mark) in marks.enumerated() {
            if line >= mark.from && line < max(mark.to, mark.from + 1) {
                return index
            }
            if mark.from > line {
                break
            }
        }
        return -1
    }

    /// sectionTarget: Next goes to the first mark after the line, Previous off the one the cursor is in; both wrap.
    public static func target(_ marks: [LineMark], from line: Int, forward: Bool) -> LineMark? {
        guard !marks.isEmpty else {
            return nil
        }
        if forward {
            return marks.first { $0.from > line } ?? marks[0]
        }
        let inside = section(marks, at: line)
        if inside >= 0 {
            return marks[(inside - 1 + marks.count) % marks.count]
        }
        return marks.last { $0.from < line } ?? marks[marks.count - 1]
    }

    /// The file bar's label: "No changes", "3 changes", or "2 of 3" with the cursor in one.
    public static func label(_ marks: [LineMark], cursorLine: Int) -> String {
        if marks.isEmpty {
            return "No changes"
        }
        let index = section(marks, at: cursorLine)
        if index >= 0 {
            return "\(index + 1) of \(marks.count)"
        }
        return "\(marks.count) \(marks.count == 1 ? "change" : "changes")"
    }

    /// layoutTicks: each mark's rows in proportion to `contentHeight` (the rows, the padding and the room scrollPastEnd
    /// adds) along a track `trackHeight` tall; at least 3 points, touching ticks of one kind merged.
    public static func ticks(_ marks: [LineMark], layout: FoldLayout, lineHeight: Double, contentHeight: Double,
                             trackHeight: Double) -> [(top: Double, height: Double, kind: String, line: Int)] {
        let scale = trackHeight / max(1, contentHeight)
        var ticks: [(top: Double, height: Double, kind: String, line: Int)] = []
        let lastLine = layout.lineCount - 1
        for mark in marks {
            let first = min(mark.from, lastLine)
            let top = Double(layout.row(forLine: first)) * lineHeight
            var bottom = top
            if mark.to > mark.from {
                bottom = Double(layout.row(forLine: min(mark.to, layout.lineCount) - 1) + 1) * lineHeight
            }
            let tick = (top: top * scale, height: max(3, (bottom - top) * scale), kind: mark.kind, line: first)
            if let last = ticks.last, last.kind == tick.kind, tick.top <= last.top + last.height + 1 {
                ticks[ticks.count - 1].height = max(last.height, tick.top + tick.height - last.top)
            } else {
                ticks.append(tick)
            }
        }
        return ticks
    }

    /// The gutter's bar on each line: its kind, and for a deletion whether the wedge sits at the line's bottom (the
    /// document's end).
    public static func gutter(_ marks: [LineMark], lineCount: Int) -> [Int: (kind: String, atEnd: Bool)] {
        var result: [Int: (kind: String, atEnd: Bool)] = [:]
        for mark in marks.sorted(by: { $0.from < $1.from }) {
            if mark.to > mark.from {
                let kind = mark.kind == "conflict" ? "conflict" : mark.kind == "added" ? "added" : "modified"
                for line in mark.from..<min(mark.to, lineCount) {
                    result[line] = (kind, false)
                }
            } else if mark.from < lineCount {
                result[mark.from] = ("deleted", false)
            } else {
                result[lineCount - 1] = ("deleted", true)
            }
        }
        return result
    }
}
