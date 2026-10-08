// The diff canvas's rows (DiffCanvas.swift paints the bands): a line with its number, tint, changed words and text,
// a fold bar (DiffCanvasExtras.swift), and the revert column between the panes with a chevron per change.

import AppKit
import NativeCore

extension DiffCanvas {
    func drawRow(
        _ row: DiffRow, pane: Pane, y: CGFloat, width: CGFloat, colors: CanvasColors, context: CGContext,
        previousTinted: Bool
    ) {
        let x = pane.x
        let textX = x + DiffPanes.gutterWidth + DiffPanes.markerWidth
        switch row {
        case .line(let number, let text, let kind):
            if kind != .unchanged {
                tint(kind, colors).setFill()
                NSRect(x: textX, y: y, width: width - textX + x, height: DiffPanes.lineHeight).fill()
                colors.nsColor("--diff-modified-edge").setFill()
                NSRect(x: textX - 2, y: y, width: 2, height: DiffPanes.lineHeight).fill()
            }
            let numberLine = CTLineCreateWithAttributedString(NSAttributedString(string: "\(number)", attributes: [
                .font: CodeFonts.shared.regular, .foregroundColor: colors.textColor("--editor-line-number"),
            ]))
            let numberWidth = CTLineGetTypographicBounds(numberLine, nil, nil, nil)
            let scale = window?.backingScaleFactor ?? 2
            let clip = CGRect(x: x, y: paintBand.minY, width: width, height: paintBand.height)
            glyphs.draw(numberLine, x: x + DiffPanes.gutterWidth - 10 - numberWidth, rowTop: y, clip: clip,
                        into: context, scale: scale)
            let start = number - 1 < pane.lineStarts.count ? pane.lineStarts[number - 1] : 0
            let spans = pane.spans?.line(start: start, length: (text as NSString).length) ?? []
            let line = CodeLineText.line(text, spans: spans, colors: colors)
            var under = TextUnder(editor: colors.bytes("--editor-bg"))
            if kind != .unchanged {
                under.fill = colors.layerFill([Self.tintToken(kind)])
            }
            if let marks = pane.marks[number], kind == .changed {
                let onLine = colors.nsLayers(
                    [("--diff-modified", nil), ("--diff-inline", nil)], on: "--editor-bg", boxOnTop: true
                )
                let above = previousTinted
                    ? onLine : colors.nsLayers([("--diff-inline", nil)], on: "--editor-bg", boxOnTop: true)
                CodeLineText.drawMarks(
                    marks, of: line, x: textX + 6, rowTop: y, colors: (above: above, onLine: onLine), scale: scale
                )
                let fill = colors.layerFill(["--diff-modified", "--diff-inline"])
                under.marks = CodeLineText.markColumns(marks, of: line, x: textX + 6, scale: scale).map { ($0, fill) }
            }
            glyphs.draw(line, x: textX + 6, rowTop: y, clip: clip, into: context, scale: scale, under: under)
        case .fold(let range):
            drawFoldBar(range, pane: pane, y: y, width: width, colors: colors, context: context)
        case .spacer:
            break
        }
    }

    /// --panel-alt between --border-strong lines, with a .diff-revert chevron 4 points above each change's first row.
    func drawRevertColumn(_ content: Content, colors: CanvasColors, x: CGFloat, top: Double, bottom: Double) {
        let index = content.left
        // .cm-merge-revert is as tall as the editors: the rows, their padding and the scrollbar below them.
        let columnRect = NSRect(
            x: x, y: -offset, width: DiffPanes.gapWidth, height: DiffPanes.editorHeight(rowsBottom: index.rowsBottom)
        )
        colors.nsColor("--border-strong").setFill()
        columnRect.fill()
        colors.nsColor("--panel-alt").setFill()
        columnRect.insetBy(dx: 1, dy: 0).fill()
        let rows = content.layout.left
        let shown = index.visible(from: top - 20, to: bottom + 20)
        let icon = content.staged ? "chevrons-right" : "chevrons-left"
        for row in shown where DiffCanvas.startsChange(rows, at: row) {
            let y = CGFloat(index.tops[row]) - offset
            drawIcon(icon, in: NSRect(x: x + 1 + 4.5, y: y - 4 + 3.5, width: 13, height: 13),
                     color: colors.nsColor("--accent"))
        }
    }

    static func startsChange(_ rows: [DiffRow], at row: Int) -> Bool {
        func changed(_ index: Int) -> Bool {
            switch rows[index] {
            case .line(_, _, let kind):
                return kind != .unchanged
            case .spacer:
                return true
            case .fold:
                return false
            }
        }
        return changed(row) && (row == 0 || !changed(row - 1))
    }

    func drawIcon(_ name: String, in rect: NSRect, color: NSColor) {
        guard let context = NSGraphicsContext.current?.cgContext else {
            return
        }
        let scale = rect.width / 24
        context.saveGState()
        context.translateBy(x: rect.minX, y: rect.minY)
        context.scaleBy(x: scale, y: scale)
        context.setStrokeColor(color.cgColor)
        // iconSvg in mergeExtensions.ts: stroke-width 2.4 in the 24-unit box.
        context.setLineWidth(2.4)
        context.setLineCap(.round)
        context.setLineJoin(.round)
        for path in IconPaths.paths(name) {
            context.addPath(path)
            context.strokePath()
        }
        context.restoreGState()
    }

    static func isTinted(_ row: DiffRow) -> Bool {
        if case .line(_, _, let kind) = row {
            return kind != .unchanged
        }
        return false
    }

    /// The token of a changed line's tint.
    static func tintToken(_ kind: DiffRow.Kind) -> String {
        switch kind {
        case .added:
            return "--diff-added"
        case .deleted:
            return "--diff-deleted"
        default:
            return "--diff-modified"
        }
    }

    private func tint(_ kind: DiffRow.Kind, _ colors: CanvasColors) -> NSColor {
        switch kind {
        case .added:
            return colors.nsSolid("--diff-added", on: "--editor-bg")
        case .changed:
            return colors.nsSolid("--diff-modified", on: "--editor-bg")
        case .deleted:
            return colors.nsSolid("--diff-deleted", on: "--editor-bg")
        case .unchanged:
            return .clear
        }
    }

    func lineHeight(_ font: NSFont) -> CGFloat {
        (font.ascender - font.descender + font.leading).rounded(.up)
    }
}
