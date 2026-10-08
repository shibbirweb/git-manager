// One row of the commit graph (src/lib/log/GraphCell.svelte): the row's lane segments as 2-point strokes with round
// caps, then HEAD's halo (1.5-point ring at 45%), then the node: a dot, or a ring filled with the row's color for a
// merge. Shapes, not a Canvas, so the colors stay in Display P3 (Icon.swift).

import NativeCore
import SwiftUI

struct GraphCellView: View {
    @Environment(\.theme) private var theme

    let row: GraphRow
    let width: CGFloat
    var isHead = false
    var isMerge = false
    var nodeOnly = false
    /// The row's background token, which fills a merge's ring.
    var rowBackground = "--panel"

    var body: some View {
        let height = LogList.rowHeight
        let mid = height / 2
        let nodeX = LogGraphCell.nodeX(row, nodeOnly: nodeOnly)
        let nodeColor = theme.laneColor(row.color)
        ZStack(alignment: .topLeading) {
            ForEach(Array(LogGraphCell.strokes(row, height: height, nodeOnly: nodeOnly).enumerated()), id: \.offset) {
                _, stroke in
                StrokePath(stroke: stroke)
                    .stroke(theme.laneColor(stroke.color), style: StrokeStyle(lineWidth: 2, lineCap: .round))
            }
            if isHead {
                Circle(center: nodeX, mid: mid, radius: 7.5)
                    .stroke(nodeColor, lineWidth: 1.5)
                    .opacity(0.45)
            }
            if isMerge {
                Circle(center: nodeX, mid: mid, radius: 4)
                    .fill(theme.color(rowBackground))
                Circle(center: nodeX, mid: mid, radius: 4)
                    .stroke(nodeColor, lineWidth: 2)
            } else {
                Circle(center: nodeX, mid: mid, radius: isHead ? 4.5 : 4)
                    .fill(nodeColor)
            }
        }
        .frame(width: width, height: height, alignment: .topLeading)
        .clipped()
    }

    /// A circle at a point in the cell, as an SVG <circle>.
    private struct Circle: Shape {
        let center: Double
        let mid: Double
        let radius: Double

        func path(in rect: CGRect) -> Path {
            Path(ellipseIn: CGRect(x: center - radius, y: mid - radius, width: radius * 2, height: radius * 2))
        }
    }

    private struct StrokePath: Shape {
        let stroke: LogGraphCell.Stroke

        func path(in rect: CGRect) -> Path {
            var path = Path()
            path.move(to: CGPoint(x: stroke.start.x, y: stroke.start.y))
            if let (first, second) = stroke.controls {
                path.addCurve(
                    to: CGPoint(x: stroke.end.x, y: stroke.end.y),
                    control1: CGPoint(x: first.x, y: first.y),
                    control2: CGPoint(x: second.x, y: second.y)
                )
            } else {
                path.addLine(to: CGPoint(x: stroke.end.x, y: stroke.end.y))
            }
            return path
        }
    }
}
