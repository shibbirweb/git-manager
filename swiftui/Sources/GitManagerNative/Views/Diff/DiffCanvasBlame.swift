// The right pane's blame gutter while the toolbar's Blame is on (blame.ts blameGutter in the merge view's editor): the
// file view's gutter (FileCanvasBlame.swift) after the line numbers, in the opaque gutter layer. Each shown line's
// cell has the 3-point bar; a block's first line (by document line, so a fold hides a block's start) has the line
// above it and the label. Fold and spacer rows leave the column empty.

import AppKit
import NativeCore

extension DiffCanvas {
    func drawBlameCells(
        _ pane: Pane, rows: Range<Int>, colors: CanvasColors, context: CGContext, scale: CGFloat
    ) {
        guard let blame = pane.blame, let theme = content?.theme else {
            return
        }
        let left = pane.x + DiffPanes.gutterWidth, width = pane.blameWidth
        // The gutter's right border runs as tall as the editor's content: the rows and the padding, not the
        // scrollbar below them.
        let gutterBottom = CGFloat(pane.index.rowsBottom) + DiffPanes.topPadding - offset
        colors.nsColor("--border").setFill()
        NSRect(x: left + width - 1, y: -offset, width: 1, height: gutterBottom + offset).intersection(paintBand).fill()
        let ranks = BlameGutter.ageRanks(blame.commits)
        let font = PageFont.ui(0.88 * CodeFonts.shared.regular.pointSize)
        for row in rows {
            guard case .line(let number, _, _) = pane.rows[row],
                  let cell = BlameGutter.cell(blame, line: number - 1, ranks: ranks) else {
                continue
            }
            let top = CGFloat(pane.index.tops[row]) - offset
            Self.blameBar(cell, theme: theme).setFill()
            NSRect(x: left, y: top, width: 3, height: DiffPanes.lineHeight).fill()
            guard cell.first else {
                continue
            }
            colors.nsColor("--border").setFill()
            NSRect(x: left, y: top, width: width - 1, height: 1).fill()
            if let text = cell.text {
                drawBlameLabel(text, uncommitted: cell.uncommitted, font: font, x: left + 3 + 7 - pane.surfaceX,
                               room: width - 1 - 3 - 7 - 8, top: top, colors: colors, context: context, scale: scale)
            }
        }
    }

    /// color-mix(in srgb, --accent heat%, transparent) over the gutter's --editor-bg, or --warning when uncommitted.
    static func blameBar(_ cell: BlameGutter.Cell, theme: Theme) -> NSColor {
        if cell.uncommitted {
            return theme.nsColor("--warning")
        }
        guard let accent = CSSColor.parse(theme.raw("--accent") ?? ""),
              let background = CSSColor.parse(theme.raw("--editor-bg") ?? "") else {
            return theme.nsColor("--accent")
        }
        // The mixed color's alpha as WebKit stores it, in 8 bits.
        let opacity = (Double(cell.heatPercent) / 100 * 255).rounded() / 255
        let bytes = zip(accent.p3Bytes, background.p3Bytes).map { (opacity * $0 + (1 - opacity) * $1).rounded() }
        return CSSColor.p3Color(bytes, alpha: 1)
    }

    private func drawBlameLabel(
        _ text: String, uncommitted: Bool, font: NSFont, x: CGFloat, room: CGFloat, top: CGFloat,
        colors: CanvasColors, context: CGContext, scale: CGFloat
    ) {
        var labelFont = font
        if uncommitted {
            labelFont = NSFont(descriptor: font.fontDescriptor.withSymbolicTraits(.italic), size: font.pointSize)
                ?? font
        }
        let attributes: [NSAttributedString.Key: Any] = [
            .font: labelFont, .foregroundColor: colors.textColor("--text-dim"),
        ]
        let full = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
        let ellipsis = CTLineCreateWithAttributedString(NSAttributedString(string: "…", attributes: attributes))
        let label = CTLineCreateTruncatedLine(full, Double(room), .end, ellipsis) ?? full
        let ascent = labelFont.ascender.rounded(), descent = (-labelFont.descender).rounded()
        let baseline = top + (DiffPanes.lineHeight - ascent - descent) / 2 + ascent - 0.5
        glyphs.draw(label, x: x, rowTop: top, clip: localClip(context, scale: scale), into: context, scale: scale,
                    baseline: baseline)
    }
}
