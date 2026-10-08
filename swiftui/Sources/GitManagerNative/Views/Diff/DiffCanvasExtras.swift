// The diff canvas's fold bars (foldField.ts) and indent guides (indentGuides.ts), both painted into a pane's content
// layer: the bars with the rows' backgrounds, the guides over the text.

import AppKit
import NativeCore

extension DiffCanvas {
    /// .cm-diffFold: --panel-alt between --border lines, the label 12 points in (8 of padding, 4 of its own), and a
    /// "10 lines" step button at each edge that has one: the top one before the label, the bottom one at the bar's
    /// right end. The bar is as wide as CodeMirror's content: the pane, or its widest line when that is wider.
    func drawFoldBar(
        _ range: FoldRange, pane: Pane, y: CGFloat, width: CGFloat, colors: CanvasColors, context: CGContext
    ) {
        let textX = pane.x + DiffPanes.gutterWidth + DiffPanes.markerWidth
        let shown = width - (textX - pane.x)
        let barRect = NSRect(x: textX, y: y, width: shown, height: DiffPanes.foldHeight)
        colors.nsColor("--panel-alt").setFill()
        barRect.fill()
        colors.nsColor("--border").setFill()
        NSRect(x: barRect.minX, y: y, width: barRect.width, height: 1).fill()
        NSRect(x: barRect.minX, y: barRect.maxY - 1, width: barRect.width, height: 1).fill()
        let textY = y + 1 + (DiffPanes.foldHeight - 2 - lineHeight(foldFont)) / 2
        let edges = DiffFold.edges(range, lineCount: pane.lineStarts.count)
        var labelX = textX + 8 + 4
        if edges.top {
            labelX += drawFoldStep("chevron-up", x: textX + 8, y: y, textY: textY, colors: colors) + 8
        }
        // The label is text in the code's layer, on the bar's opaque fill.
        let label = CTLineCreateWithAttributedString(NSAttributedString(
            string: "\(range.count) unchanged lines",
            attributes: [.font: foldFont, .foregroundColor: colors.textColor("--text-dim")]
        ))
        let scale = window?.backingScaleFactor ?? 2
        glyphs.draw(
            label, x: labelX - pane.surfaceX, rowTop: y, clip: localClip(context, scale: scale), into: context,
            scale: scale, layer: true, baseline: textY + foldFont.ascender
        )
        if edges.bottom {
            let barRight = textX + max(shown, pane.contentWidth)
            let stepWidth = foldStepWidth()
            drawFoldStep("chevron-down", x: barRight - 8 - stepWidth, y: y, textY: textY, colors: colors)
        }
    }

    /// .cm-diffFoldStep: 6 points of padding, a 12-point chevron, 3 points, then "10 lines", in --accent.
    @discardableResult
    private func drawFoldStep(_ icon: String, x: CGFloat, y: CGFloat, textY: CGFloat, colors: CanvasColors) -> CGFloat {
        let color = colors.nsColor("--accent")
        // An <svg>: WebKit paints it at its box rounded to whole points (SVGSnap).
        let iconRect = NSRect(x: SVGSnap.whole(x + 6), y: SVGSnap.whole(y + (DiffPanes.foldHeight - 12) / 2),
                              width: 12, height: 12)
        drawIcon(icon, in: iconRect, color: color)
        let text = NSAttributedString(string: "\(DiffFold.step) lines", attributes: [
            .font: foldFont, .foregroundColor: color,
        ])
        text.draw(at: NSPoint(x: x + 6 + 12 + 3, y: textY))
        return foldStepWidth()
    }

    /// The fold under a click at `point` (content coordinates) and the part hit: a step button opens 10 lines at its
    /// edge, the rest of the bar opens the whole fold (foldField.ts). The index is among the original text's folds.
    func foldHit(at point: NSPoint) -> (foldIndex: Int, edge: FoldEdge)? {
        guard let content else {
            return nil
        }
        let paneWidth = self.paneWidth(content)
        let right = point.x >= paneWidth + DiffPanes.gapWidth
        let layout = content.layout
        let index = right ? content.right : content.left
        guard right || point.x < paneWidth,
              let row = index.visible(from: Double(point.y), to: Double(point.y) + 0.5).first,
              case .fold(let range) = (right ? layout.right : layout.left)[row],
              case .fold(let leftRange) = layout.left[row],
              let foldIndex = layout.leftFolds.firstIndex(of: leftRange) else {
            return nil
        }
        let x = point.x - (right ? paneWidth + DiffPanes.gapWidth : 0)
        let textX = DiffPanes.gutterWidth + DiffPanes.markerWidth
        let lineCount = (right ? layout.rightLineStarts : layout.leftLineStarts).count
        let edges = DiffFold.edges(range, lineCount: lineCount)
        let stepWidth = foldStepWidth()
        if edges.top, x >= textX + 8, x < textX + 8 + stepWidth {
            return (foldIndex, .top)
        }
        let barRight = textX + max(paneWidth - textX, right ? content.rightWidth : content.leftWidth)
        if edges.bottom, x >= barRight - 8 - stepWidth, x < barRight - 8 {
            return (foldIndex, .bottom)
        }
        return x >= textX ? (foldIndex, .all) : nil
    }

    private func foldStepWidth() -> CGFloat {
        let text = NSAttributedString(string: "\(DiffFold.step) lines", attributes: [.font: foldFont])
        return 6 + 12 + 3 + text.size().width + 6
    }

    /// A 1-point line per run, color-mix(--text-faint 38%, transparent), painted into the content layer over
    /// whatever the row holds there (a tint, a fold bar, nothing), at its exact x (369.6 points shows as two partly
    /// covered pixels, as on the page).
    func drawGuides(_ pane: Pane, top: Double, bottom: Double, colors: CanvasColors) {
        let runs = pane.guides.filter { $0.bottom > top && $0.top < bottom }
        guard !runs.isEmpty else {
            return
        }
        let originX = pane.x + DiffPanes.gutterWidth + DiffPanes.markerWidth + 6
        let step = CodeLineText.advance * 2
        let scale = window?.backingScaleFactor ?? 2
        for run in runs {
            let segmentTop = max(run.top, top), segmentBottom = min(run.bottom, bottom)
            guard segmentBottom > segmentTop else {
                continue
            }
            // Each pixel column the guide touches takes its alpha times its coverage. WebKit lays out in 1/64 of a
            // point (LayoutUnit), so 15.6 points of indent are 15.59375.
            let indent = (CGFloat(run.level) * step * 64).rounded(.down) / 64
            let left = (originX + indent) * scale, right = left + scale
            var column = left.rounded(.down)
            let surface = pane.x == 0 ? paneSurfaces[0] : paneSurfaces[1]
            let segment = CGRect(
                x: 0, y: CGFloat(segmentTop) - offset, width: 1, height: CGFloat(segmentBottom - segmentTop)
            )
            let rows = segment.intersection(CGRect(x: 0, y: paintBand.minY, width: 1, height: paintBand.height))
            while column < right, !rows.isNull {
                let coverage = Double(min(right, column + 1) - max(left, column))
                surface.blend(colors.exact("--text-faint"), alpha: 0.38 * coverage, in: CGRect(
                    x: column - pane.surfaceX * scale, y: rows.minY * scale, width: 1, height: rows.height * scale
                ))
                column += 1
            }
        }
    }
}
