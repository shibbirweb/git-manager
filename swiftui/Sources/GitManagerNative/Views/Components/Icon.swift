// The current app's icons, drawn like src/lib/ui/Icon.svelte: SVG paths on a 24-point grid scaled to `size`, round
// caps and joins, in the current foreground color. LayoutToggleIcon is src/lib/views/LayoutToggleIcon.svelte and
// CommitLayoutIcon is src/lib/views/changes/CommitLayoutIcon.svelte.

import SwiftUI

struct Icon: View {
    @Environment(\.svgBiasY) private var svgBiasY

    let name: String
    var size: CGFloat = 16
    var strokeWidth: CGFloat = 2

    var body: some View {
        // "more" (three dots) is drawn heavier in the current app, whatever stroke width is asked for.
        let width = name == "more" ? 3 : strokeWidth
        let style = StrokeStyle(lineWidth: width * size / 24, lineCap: .round, lineJoin: .round)
        // Shapes, not a Canvas: a Canvas stores its pixels as 8-bit sRGB, which puts the theme's Display P3 colors
        // one step off. Each path is stroked on its own, as the page draws each SVG <path>. (Core Graphics masks
        // tinted as template images came out no closer: the page's strokes are not Core Graphics' CPU pixels.)
        ZStack {
            ForEach(Array(IconPaths.paths(name).enumerated()), id: \.offset) { _, path in
                GridShape(path: Path(path)).stroke(style: style)
            }
        }
        .frame(width: size, height: size)
        .svgSnap(biasY: svgBiasY)
        .accessibilityHidden(true)
    }
}

/// A path on the icons' 24-point grid, scaled to the frame.
struct GridShape: Shape {
    let path: Path

    func path(in rect: CGRect) -> Path {
        path.applying(CGAffineTransform(scaleX: rect.width / 24, y: rect.height / 24))
    }
}

/// A window outline with one side marked; the side is filled while that sidebar is visible.
struct LayoutToggleIcon: View {
    @Environment(\.svgBiasY) private var svgBiasY

    enum Side {
        case left
        case right
    }

    let side: Side
    let visible: Bool
    var size: CGFloat = 16

    var body: some View {
        let style = StrokeStyle(lineWidth: 1.8 * size / 24)
        let lineX: CGFloat = side == .left ? 9 : 15
        var line = Path()
        line.move(to: CGPoint(x: lineX, y: 4))
        line.addLine(to: CGPoint(x: lineX, y: 20))
        return ZStack {
            GridShape(path: Self.frame).stroke(style: style)
            GridShape(path: line).stroke(style: style)
            if visible {
                GridShape(path: Path(CGRect(x: side == .left ? 4 : 15, y: 5, width: 5, height: 14)))
            }
        }
        .frame(width: size, height: size)
        .svgSnap(biasY: svgBiasY)
        .accessibilityHidden(true)
    }

    /// The SVG <rect rx="2">: circular corners.
    static let frame = Path(roundedRect: CGRect(x: 3, y: 4, width: 18, height: 16), cornerRadius: 2, style: .circular)
}

/// A panel with one commit box at its foot, or (per repository) a box at the top of each repository. Plain SVG
/// strokes: 1.8 wide with butt caps, unlike the round-capped icons.
struct CommitLayoutIcon: View {
    @Environment(\.svgBiasY) private var svgBiasY

    let perRepo: Bool
    var size: CGFloat = 15

    var body: some View {
        let style = StrokeStyle(lineWidth: 1.8 * size / 24)
        var strokes = LayoutToggleIcon.frame
        var boxes = [CGRect(x: 6, y: 14.5, width: 12, height: 3)]
        if perRepo {
            strokes.move(to: CGPoint(x: 3, y: 12))
            strokes.addLine(to: CGPoint(x: 21, y: 12))
            boxes.append(CGRect(x: 6, y: 6.5, width: 12, height: 3))
        } else {
            strokes.move(to: CGPoint(x: 7, y: 8.5))
            strokes.addLine(to: CGPoint(x: 17, y: 8.5))
            strokes.move(to: CGPoint(x: 7, y: 11.5))
            strokes.addLine(to: CGPoint(x: 14, y: 11.5))
        }
        return ZStack {
            GridShape(path: strokes).stroke(style: style)
            ForEach(Array(boxes.enumerated()), id: \.offset) { _, box in
                GridShape(path: Path(roundedRect: box, cornerRadius: 1, style: .circular))
            }
        }
        .frame(width: size, height: size)
        .svgSnap(biasY: svgBiasY)
        .accessibilityHidden(true)
    }
}

/// Parsed icon paths, kept after the first use (76 small icons).
enum IconPaths {
    private static var cache: [String: [CGPath]] = [:]

    static func paths(_ name: String) -> [CGPath] {
        if let cached = cache[name] {
            return cached
        }
        let parsed = (Icons.paths[name] ?? []).map(SVGPath.parse)
        cache[name] = parsed
        return parsed
    }
}
