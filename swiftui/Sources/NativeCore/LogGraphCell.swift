// What one row of the commit graph draws, from src/lib/log/GraphCell.svelte: lanes 14 points apart, 9 points in,
// each segment a straight line or a cubic curve (2-point strokes with round caps), and the node: a 4-point dot, a
// 4-point ring for a merge, and HEAD's 4.5-point dot inside a 7.5-point halo.

public enum LogGraphCell {
    public static let laneGap = 14.0
    public static let pad = 9.0
    public static let maxLanes = 24
    /// Mid-tone hues that keep contrast on light and dark panels (LANE_COLORS).
    public static let laneColors = [
        "#4a8af4", "#e0604f", "#3aa55d", "#d9a21b", "#a46ee8", "#1fb1b5", "#e2639f", "#e8883a",
    ]

    public struct Point: Equatable, Sendable {
        public let x: Double
        public let y: Double

        public init(_ x: Double, _ y: Double) {
            self.x = x
            self.y = y
        }
    }

    /// A segment's path: from `start` to `end`, through `control1` and `control2` when it bends.
    public struct Stroke: Equatable, Sendable {
        public let start: Point
        public let end: Point
        public let controls: (Point, Point)?
        /// An index into laneColors.
        public let color: Int

        public init(start: Point, end: Point, controls: (Point, Point)?, color: Int) {
            self.start = start
            self.end = end
            self.controls = controls
            self.color = color
        }

        public static func == (left: Stroke, right: Stroke) -> Bool {
            left.start == right.start && left.end == right.end && left.color == right.color
                && left.controls?.0 == right.controls?.0 && left.controls?.1 == right.controls?.1
        }
    }

    /// The graph column's width for `laneCount` lanes (graphColumnWidth).
    public static func columnWidth(laneCount: Int) -> Double {
        let lanes = min(max(1, laneCount), maxLanes)
        return pad * 2 + Double(lanes - 1) * laneGap
    }

    public static func laneX(_ lane: Int) -> Double {
        pad + Double(lane) * laneGap
    }

    public static func colorIndex(_ index: Int) -> Int {
        ((index % laneColors.count) + laneColors.count) % laneColors.count
    }

    /// The row's segments as strokes, in the order the page draws them; none while filtering (`nodeOnly`).
    public static func strokes(_ row: GraphRow, height: Double, nodeOnly: Bool = false) -> [Stroke] {
        if nodeOnly {
            return []
        }
        let mid = height / 2
        return row.segments.map { segment in
            let x1 = laneX(segment.from)
            let x2 = laneX(segment.to)
            let color = colorIndex(segment.color)
            switch segment.kind {
            case .incoming:
                let controls = x1 == x2 ? nil : (Point(x1, mid), Point(x2, 0))
                return Stroke(start: Point(x1, 0), end: Point(x2, mid), controls: controls, color: color)
            case .outgoing:
                let controls = x1 == x2 ? nil : (Point(x1, height), Point(x2, mid))
                return Stroke(start: Point(x1, mid), end: Point(x2, height), controls: controls, color: color)
            case .pass:
                return Stroke(start: Point(x1, 0), end: Point(x1, height), controls: nil, color: color)
            }
        }
    }

    /// Where the node sits: its lane, or the first lane while filtering.
    public static func nodeX(_ row: GraphRow, nodeOnly: Bool = false) -> Double {
        nodeOnly ? pad : laneX(row.lane)
    }
}
