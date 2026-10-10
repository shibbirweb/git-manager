// The blame gutter (src/lib/editor/blame.ts .cm-blame-gutter): 236 points after the line numbers with a 1-point
// --border on its right. Each line's cell has a 3-point bar on its left, the accent at the commit's heat over the
// gutter (the warning color for uncommitted lines); a block's first line has a 1-point --border line on top and the
// label in the UI font at 0.88em, --text-dim (italic when uncommitted), 7 points after the bar, cut with an ellipsis
// 8 points before the cell's end (BlameGutter in NativeCore).

import AppKit
import NativeCore

extension FileCanvas {
    func drawBlameGutter(_ content: Content, shown: Range<Int>, colors: CanvasColors, context: CGContext,
                         scale: CGFloat) {
        let width = CGFloat(content.geometry.blameWidth)
        guard width > 0 else {
            return
        }
        let left = CGFloat(content.geometry.numbersWidth)
        colors.nsColor("--border").setFill()
        NSRect(x: left + width - 1, y: paintBand.minY, width: 1, height: paintBand.height).fill()
        guard let blame = content.blame else {
            return
        }
        let ranks = BlameGutter.ageRanks(blame.commits)
        let active = Set(content.state.selection.ranges.map { row(of: $0.head, content) })
        let font = PageFont.ui(0.88 * CodeFonts.shared.regular.pointSize)
        for row in shown {
            let line = content.layout.lines(forRow: row).lowerBound
            guard let cell = BlameGutter.cell(blame, line: line, ranks: ranks) else {
                continue
            }
            let extra = blockExtra(row)
            let top = rowTop(row) - extra, height = CGFloat(EditorGeometry.lineHeight) + extra
            barColor(cell, theme: content.theme, active: active.contains(row)).setFill()
            NSRect(x: left, y: top, width: 3, height: height).fill()
            guard cell.first else {
                continue
            }
            colors.nsColor("--border").setFill()
            NSRect(x: left, y: top, width: width - 1, height: 1).fill()
            if let text = cell.text {
                drawLabel(text, cell: cell, font: font, left: left + 3 + 7, room: width - 1 - 3 - 7 - 8,
                          top: top, height: height, colors: colors, context: context, scale: scale)
            }
        }
    }

    /// color-mix(in srgb, --accent heat%, transparent) over the cell's background (the gutter, or on a cursor's row
    /// the active line over it), or --warning for uncommitted lines.
    private func barColor(_ cell: BlameGutter.Cell, theme: Theme, active: Bool) -> NSColor {
        if cell.uncommitted {
            return theme.nsColor("--warning")
        }
        guard let accent = CSSColor.parse(theme.raw("--accent") ?? ""),
              let gutter = CSSColor.parse(theme.raw("--editor-gutter") ?? "") else {
            return theme.nsColor("--accent")
        }
        var background = gutter.p3Bytes
        if active, let line = CSSColor.parse(theme.raw("--editor-active-line") ?? "") {
            background = line.filled(overBytes: background)
        }
        // The mixed color's alpha as WebKit stores it, in 8 bits (95% is 242).
        let opacity = (Double(cell.heatPercent) / 100 * 255).rounded() / 255
        let bytes = zip(accent.p3Bytes, background).map { (opacity * $0 + (1 - opacity) * $1).rounded() }
        return CSSColor.p3Color(bytes, alpha: 1)
    }

    private func drawLabel(
        _ text: String, cell: BlameGutter.Cell, font: NSFont, left: CGFloat, room: CGFloat, top: CGFloat,
        height: CGFloat, colors: CanvasColors, context: CGContext, scale: CGFloat
    ) {
        var labelFont = font
        if cell.uncommitted {
            labelFont = NSFont(descriptor: font.fontDescriptor.withSymbolicTraits(.italic), size: font.pointSize)
                ?? font
        }
        let attributes: [NSAttributedString.Key: Any] = [
            .font: labelFont, .foregroundColor: colors.textColor("--text-dim"),
        ]
        let full = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
        let ellipsis = CTLineCreateWithAttributedString(NSAttributedString(string: "…", attributes: attributes))
        let label = CTLineCreateTruncatedLine(full, Double(room), .end, ellipsis) ?? full
        // CSS splits the line box's leftover height above and below the font's rounded ascent and descent.
        let ascent = labelFont.ascender.rounded(), descent = (-labelFont.descender).rounded()
        // Half a point higher than that on the page (measured).
        let baseline = top + (height - ascent - descent) / 2 + ascent - 0.5
        glyphs.draw(label, x: left, rowTop: top, clip: localClip(context, scale: scale), into: context,
                    scale: scale, baseline: baseline)
    }
}
