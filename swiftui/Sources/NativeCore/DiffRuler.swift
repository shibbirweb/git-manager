// The change overview ruler beside a diff (src/lib/editor/scrollMarkers.ts layoutTicks): one tick per change on the
// modified side, placed in proportion to the whole content, at least 3 points tall, and touching ticks of the same
// kind merged into one.

import Foundation

public struct RulerTick: Equatable, Sendable {
    public enum Kind: Sendable {
        case added
        case modified
        case deleted
    }

    public var top: Double
    public var height: Double
    public let kind: Kind

    public init(top: Double, height: Double, kind: Kind) {
        self.top = top
        self.height = height
        self.kind = kind
    }
}

public struct RowMetrics: Sendable {
    public let line: Double
    public let fold: Double
    /// The content's padding above and below the rows.
    public let padding: Double

    public init(line: Double, fold: Double, padding: Double) {
        self.line = line
        self.fold = fold
        self.padding = padding
    }

    public func height(_ row: DiffRow) -> Double {
        switch row {
        case .line:
            return line
        case .fold:
            return fold
        case .spacer(let lines):
            return Double(lines) * line
        }
    }
}

public enum DiffRuler {
    static let minTick = 3.0

    /// The ticks for `rows` (the modified pane) in a track `trackHeight` tall.
    public static func ticks(
        rows: [DiffRow], hunks: [DiffHunk], metrics: RowMetrics, trackHeight: Double
    ) -> [RulerTick] {
        // Each shown line's top and bottom, by its 1-based number. Like CodeMirror's line blocks they start at the
        // document's top, below the padding, while the scale counts the padding on both sides.
        var lines: [Int: (top: Double, bottom: Double)] = [:]
        var y = 0.0
        var lastNumber = 0
        for row in rows {
            let height = metrics.height(row)
            if case .line(let number, _, _) = row {
                lines[number] = (y, y + height)
                lastNumber = max(lastNumber, number)
            }
            y += height
        }
        let total = max(1, y + 2 * metrics.padding)
        let scale = trackHeight / total
        var ticks: [RulerTick] = []
        for hunk in hunks {
            let first = min(hunk.newStart + 1, lastNumber)
            guard let top = lines[first]?.top else {
                continue
            }
            var bottom = top
            let kind: RulerTick.Kind
            if hunk.newEnd == hunk.newStart {
                kind = .deleted
            } else {
                bottom = lines[min(hunk.newEnd, lastNumber)]?.bottom ?? top
                kind = hunk.oldStart == hunk.oldEnd ? .added : .modified
            }
            let tick = RulerTick(top: top * scale, height: max(minTick, (bottom - top) * scale), kind: kind)
            if var last = ticks.last, last.kind == tick.kind, tick.top <= last.top + last.height + 1 {
                last.height = max(last.height, tick.top + tick.height - last.top)
                ticks[ticks.count - 1] = last
            } else {
                ticks.append(tick)
            }
        }
        return ticks
    }
}
