// The current app's icons, drawn like src/lib/ui/Icon.svelte: SVG paths on a 24-point grid scaled to `size`, round
// caps and joins, in the current foreground color. LayoutToggleIcon is src/lib/views/LayoutToggleIcon.svelte and
// CommitLayoutIcon is src/lib/views/changes/CommitLayoutIcon.svelte.

import SwiftUI

struct Icon: View {
    let name: String
    var size: CGFloat = 16
    var strokeWidth: CGFloat = 2

    var body: some View {
        // "more" (three dots) is drawn heavier in the current app, whatever stroke width is asked for.
        let width = name == "more" ? 3 : strokeWidth
        Canvas { context, canvasSize in
            let scale = canvasSize.width / 24
            let style = StrokeStyle(lineWidth: width * scale, lineCap: .round, lineJoin: .round)
            for path in IconPaths.paths(name) {
                context.stroke(Path(path).applying(CGAffineTransform(scaleX: scale, y: scale)), with: .foreground,
                               style: style)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// A window outline with one side marked; the side is filled while that sidebar is visible.
struct LayoutToggleIcon: View {
    enum Side {
        case left
        case right
    }

    let side: Side
    let visible: Bool
    var size: CGFloat = 16

    var body: some View {
        Canvas { context, canvasSize in
            let scale = canvasSize.width / 24
            let transform = CGAffineTransform(scaleX: scale, y: scale)
            let style = StrokeStyle(lineWidth: 1.8 * scale)
            let frame = Path(roundedRect: CGRect(x: 3, y: 4, width: 18, height: 16), cornerRadius: 2)
            context.stroke(frame.applying(transform), with: .foreground, style: style)
            let lineX: CGFloat = side == .left ? 9 : 15
            var line = Path()
            line.move(to: CGPoint(x: lineX, y: 4))
            line.addLine(to: CGPoint(x: lineX, y: 20))
            context.stroke(line.applying(transform), with: .foreground, style: style)
            if visible {
                let barX: CGFloat = side == .left ? 4 : 15
                context.fill(Path(CGRect(x: barX, y: 5, width: 5, height: 14)).applying(transform), with: .foreground)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// A panel with one commit box at its foot, or (per repository) a box at the top of each repository. Plain SVG
/// strokes: 1.8 wide with butt caps, unlike the round-capped icons.
struct CommitLayoutIcon: View {
    let perRepo: Bool
    var size: CGFloat = 15

    var body: some View {
        Canvas { context, canvasSize in
            let scale = canvasSize.width / 24
            let transform = CGAffineTransform(scaleX: scale, y: scale)
            let style = StrokeStyle(lineWidth: 1.8 * scale)
            var strokes = Path(roundedRect: CGRect(x: 3, y: 4, width: 18, height: 16), cornerRadius: 2)
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
            context.stroke(strokes.applying(transform), with: .foreground, style: style)
            for box in boxes {
                context.fill(Path(roundedRect: box, cornerRadius: 1).applying(transform), with: .foreground)
            }
        }
        .frame(width: size, height: size)
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
