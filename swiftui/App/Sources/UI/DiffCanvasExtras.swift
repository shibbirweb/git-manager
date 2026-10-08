// The diff canvas's fold bars (foldField.ts), and its layers over the rows: indent guides (indentGuides.ts, a layer
// above the text) and each pane's horizontal scrollbar thumb (app.css ::-webkit-scrollbar-thumb).

import AppKit
import NativeCore

extension DiffCanvas {
    /// .cm-diffFold: --panel-alt between --border lines, the label 12 points in (8 of padding, 4 of its own), and a
    /// "10 lines" step button at each edge that has one: the top one before the label, the bottom one at the bar's
    /// right end. The bar is as wide as CodeMirror's content: the pane, or its widest line when that is wider.
    func drawFoldBar(_ range: FoldRange, pane: Pane, y: CGFloat, width: CGFloat, theme: Theme, context: CGContext) {
        let textX = pane.x + DiffPanes.gutterWidth + DiffPanes.markerWidth
        let shown = width - (textX - pane.x)
        let barRect = NSRect(x: textX, y: y, width: shown, height: DiffPanes.foldHeight)
        theme.nsColor("--panel-alt").setFill()
        barRect.fill()
        theme.nsColor("--border").setFill()
        NSRect(x: barRect.minX, y: y, width: barRect.width, height: 1).fill()
        NSRect(x: barRect.minX, y: barRect.maxY - 1, width: barRect.width, height: 1).fill()
        let textY = y + 1 + (DiffPanes.foldHeight - 2 - lineHeight(foldFont)) / 2
        let edges = DiffFold.edges(range, lineCount: pane.lineStarts.count)
        var labelX = textX + 8 + 4
        if edges.top {
            labelX += drawFoldStep("chevron-up", x: textX + 8, y: y, textY: textY, theme: theme) + 8
        }
        // The label is text in the code's layer, on the bar's opaque fill: blended like code text.
        let label = CTLineCreateWithAttributedString(NSAttributedString(
            string: "\(range.count) unchanged lines",
            attributes: [.font: foldFont, .foregroundColor: theme.textColor("--text-dim")]
        ))
        let under = TextUnder(
            editor: theme.bytes("--editor-bg"), fill: TextUnder.Fill(color: theme.bytes("--panel-alt"), alpha: 255)
        )
        glyphs.draw(
            label, x: labelX, rowTop: y, clip: CGRect(x: pane.x, y: 0, width: width, height: bounds.height),
            into: context, scale: window?.backingScaleFactor ?? 2, under: under, baseline: textY + foldFont.ascender
        )
        if edges.bottom {
            let barRight = textX + max(shown, pane.contentWidth)
            let stepWidth = foldStepWidth()
            drawFoldStep("chevron-down", x: barRight - 8 - stepWidth, y: y, textY: textY, theme: theme)
        }
    }

    /// .cm-diffFoldStep: 6 points of padding, a 12-point chevron, 3 points, then "10 lines", in --accent.
    @discardableResult
    private func drawFoldStep(_ icon: String, x: CGFloat, y: CGFloat, textY: CGFloat, theme: Theme) -> CGFloat {
        let color = theme.nsColor("--accent")
        let iconRect = NSRect(x: x + 6, y: y + (DiffPanes.foldHeight - 12) / 2, width: 12, height: 12)
        drawIcon(icon, in: iconRect, color: color)
        let text = NSAttributedString(string: "\(DiffFold.step) lines", attributes: [
            .font: foldFont, .foregroundColor: color,
        ])
        text.draw(at: NSPoint(x: x + 6 + 12 + 3, y: textY))
        return foldStepWidth()
    }

    private func foldStepWidth() -> CGFloat {
        let text = NSAttributedString(string: "\(DiffFold.step) lines", attributes: [.font: foldFont])
        return 6 + 12 + 3 + text.size().width + 6
    }

    /// A 1-point line per run, color-mix(--text-faint 38%, transparent) over whatever the row shows (the editor,
    /// a tinted line, a fold bar), at its exact x (369.6 points shows as two partly covered pixels, as on the page).
    func drawGuides(_ pane: Pane, top: Double, bottom: Double, theme: Theme) {
        let runs = pane.guides.filter { $0.bottom > top && $0.top < bottom }
        guard !runs.isEmpty else {
            return
        }
        let originX = pane.x + DiffPanes.gutterWidth + DiffPanes.markerWidth + 6
        let step = CodeLineText.advance * 2
        let guide: (token: String, alpha: Double?) = ("--text-faint", 0.38)
        for row in pane.index.visible(from: top, to: bottom) {
            let rowTop = pane.index.tops[row], rowBottom = pane.index.tops[row + 1]
            let color: NSColor
            switch pane.rows[row] {
            case .line(_, _, let kind) where kind != .unchanged:
                color = theme.nsLayers([(DiffCanvas.tintToken(kind), nil), guide], on: "--editor-bg", overlay: true)
            case .fold:
                color = theme.nsLayers([guide], on: "--panel-alt", overlay: true)
            default:
                color = theme.nsLayers([guide], on: "--editor-bg", overlay: true)
            }
            color.setFill()
            for run in runs where run.bottom > rowTop && run.top < rowBottom {
                let x = originX + CGFloat(run.level) * step
                let segmentTop = max(run.top, rowTop), segmentBottom = min(run.bottom, rowBottom)
                NSRect(x: x, y: CGFloat(segmentTop) - offset, width: 1, height: CGFloat(segmentBottom - segmentTop))
                    .fill()
            }
        }
    }

    /// The thumb as long as the visible share of the content, 2 points in from each edge of its 10-point track, at
    /// the start (the panes do not scroll sideways yet).
    func drawScrollbar(_ pane: Pane, width: CGFloat, theme: Theme) {
        let scrollWidth = DiffPanes.gutterWidth + DiffPanes.markerWidth + pane.contentWidth
        guard scrollWidth > width + 0.5 else {
            return
        }
        let length = width * width / scrollWidth
        let trackTop = DiffPanes.editorHeight(rowsBottom: pane.index.rowsBottom) - DiffPanes.scrollbarHeight - offset
        let rect = NSRect(x: pane.x + 2, y: trackTop + 2, width: length - 4, height: DiffPanes.scrollbarHeight - 4)
        theme.nsLayers([("--text-dim", 0.35)], on: "--editor-bg").setFill()
        NSBezierPath(roundedRect: rect, xRadius: rect.height / 2, yRadius: rect.height / 2).fill()
    }
}
