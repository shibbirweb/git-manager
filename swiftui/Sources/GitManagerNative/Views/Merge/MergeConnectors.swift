// The 52-point strips between the panes (MergeEditor.svelte .connector): a ribbon from each open chunk's lines in a
// side to its lines in the result, and the chunk's apply (>> or <<) and ignore (x) buttons at the side's first line.

import NativeCore
import SwiftUI

struct MergeConnectors: View {
    @Environment(\.theme) private var theme
    @ObservedObject var session: MergeSession
    @ObservedObject var sync: MergeScrollSync

    static let width: CGFloat = 52

    let side: MergeSide

    struct Connector: Identifiable {
        let id: Int
        let sideSpan: (top: Double, bottom: Double)
        let resultSpan: (top: Double, bottom: Double)
        let type: ChangeType
        let buttonY: CGFloat
        let append: Bool
    }

    var body: some View {
        GeometryReader { proxy in
            let connectors = connectors(height: proxy.size.height)
            ZStack(alignment: .topLeading) {
                theme.color("--editor-bg")
                ForEach(connectors) { connector in
                    let path = ribbon(connector)
                    path.fill(ribbonFill(MergePaneCanvas.tintToken(connector.type)))
                    path.stroke(theme.color(MergePaneCanvas.edgeToken(connector.type)), lineWidth: 1)
                }
                ForEach(connectors) { connector in
                    buttons(connector)
                        .offset(x: side == .ours ? 2 : Self.width - 2 - 38, y: connector.buttonY)
                }
            }
            .clipped()
        }
        .frame(width: Self.width)
    }

    private func connectors(height: CGFloat) -> [Connector] {
        let lineHeight = Double(MergePaneCanvas.lineHeight), padding = Double(MergePaneCanvas.padding)
        let sideLines = session.sides.lines(side).count, resultLines = session.lines.count
        let sideOffset = Double(sync.offset(side == .ours ? .ours : .theirs))
        let resultOffset = Double(sync.offset(.result))
        var connectors: [Connector] = []
        for chunk in session.chunks where !chunk.done(side) && chunk.changed(side) {
            let sideSpan = MergePaneLayout.span(chunk.range(side), lineCount: sideLines, lineHeight: lineHeight,
                                                padding: padding, offset: sideOffset)
            let resultSpan = MergePaneLayout.span(chunk.result, lineCount: resultLines, lineHeight: lineHeight,
                                                  padding: padding, offset: resultOffset)
            if max(sideSpan.bottom, resultSpan.bottom) < -40 || min(sideSpan.top, resultSpan.top) > height + 40 {
                continue
            }
            connectors.append(Connector(
                id: chunk.id, sideSpan: sideSpan, resultSpan: resultSpan, type: chunk.changeType(side),
                buttonY: max(2, min(height - 20, CGFloat(sideSpan.top) + 1)),
                append: chunk.kind == .conflict && chunk.applied
            ))
        }
        return connectors
    }

    /// The ribbon's translucent fill over --editor-bg as one solid color, blended as the GPU composites it: the exact
    /// converted color in half precision over the background's bytes (measured: dark --diff-modified gives blue 74,
    /// where an 8-bit blend gives 73).
    private func ribbonFill(_ tokenName: String) -> Color {
        let half = GlyphCompositor.half
        // The alpha in 8 bits: light --diff-conflict's 0.15 as 38/255 gives blue 233, 0.15 itself 232.
        let alpha = (theme.alpha(tokenName) * 255).rounded() / 255
        let bytes = zip(theme.exact(tokenName), theme.exact("--editor-bg")).map { top, below in
            (half(half(top / 255 * alpha) + half(below.rounded() / 255 * (1 - alpha))) * 255).rounded()
        }
        return Color(nsColor: CSSColor.color(p3Bytes: bytes))
    }

    /// Left to right: ours to the result on the left strip, the result to theirs on the right one.
    private func ribbon(_ connector: Connector) -> Path {
        let left = side == .ours ? connector.sideSpan : connector.resultSpan
        let right = side == .ours ? connector.resultSpan : connector.sideSpan
        let width = Self.width, middle = width / 2
        var path = Path()
        path.move(to: CGPoint(x: 0, y: left.top))
        path.addCurve(to: CGPoint(x: width, y: right.top), control1: CGPoint(x: middle, y: left.top),
                      control2: CGPoint(x: middle, y: right.top))
        path.addLine(to: CGPoint(x: width, y: right.bottom))
        path.addCurve(to: CGPoint(x: 0, y: left.bottom), control1: CGPoint(x: middle, y: right.bottom),
                      control2: CGPoint(x: middle, y: left.bottom))
        path.closeSubpath()
        return path
    }

    /// .chunk-btn: 18 x 17 with a --border-strong border, 4-point corners, on --panel, 2 points apart; the apply
    /// button's chevrons in the chunk's edge color, the ignore button's x in --text-dim.
    private func buttons(_ connector: Connector) -> some View {
        HStack(spacing: 2) {
            if side == .ours {
                applyButton(connector)
                ignoreButton(connector)
            } else {
                ignoreButton(connector)
                applyButton(connector)
            }
        }
    }

    private func applyButton(_ connector: Connector) -> some View {
        chunkButton(icon: side == .ours ? "chevrons-right" : "chevrons-left", size: 12,
                    color: MergePaneCanvas.edgeToken(connector.type)) {
            session.apply(connector.id, side: side)
        }
    }

    private func ignoreButton(_ connector: Connector) -> some View {
        chunkButton(icon: "x", size: 11, color: "--text-dim") {
            session.ignore(connector.id, side: side)
        }
    }

    private func chunkButton(icon: String, size: CGFloat, color: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(name: icon, size: size, strokeWidth: 2.5)
                .foregroundStyle(theme.ink(color))
                .frame(width: 18, height: 17)
                .background(RoundedRectangle(cornerRadius: 4, style: .circular).fill(theme.color("--panel")))
                .borderRing(theme.color("--border-strong"), cornerRadius: 4)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
