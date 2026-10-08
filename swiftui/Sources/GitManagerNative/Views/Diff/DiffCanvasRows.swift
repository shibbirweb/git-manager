// The diff canvas's rows (DiffCanvas.swift paints the bands): a pane's content layer holds, in the page's paint
// order, the lines' tints and the fold bars (DiffCanvasExtras.swift), then each line's changed words and text, then
// the indent guides, all as WebKit stores them in that see-through layer; the gutter with its line numbers is opaque
// over it. The revert column between the panes lies in the view's own bitmap.

import AppKit
import NativeCore

extension DiffCanvas {
    /// One pane's content layer for the paint band, drawn in canvas points (the context's origin is the layer's).
    func drawContent(
        _ pane: Pane, top: Double, bottom: Double, width: CGFloat, colors: CanvasColors, context: CGContext,
        scale: CGFloat
    ) {
        let rows = pane.index.visible(from: top - Self.spill, to: bottom + Self.spill)
        // Backgrounds first, as the page paints every block's background before the text over it.
        for row in rows {
            let y = CGFloat(pane.index.tops[row]) - offset
            switch pane.rows[row] {
            case .line(_, _, let kind) where kind != .unchanged:
                let textX = pane.x + DiffPanes.gutterWidth + DiffPanes.markerWidth
                store(colors.layerFill(Self.tintToken(kind)), in: NSRect(
                    x: textX, y: y, width: width - textX + pane.x, height: DiffPanes.lineHeight
                ), pane: pane, scale: scale)
            case .fold(let range):
                drawFoldBar(range, pane: pane, y: y, width: width, colors: colors, context: context)
            default:
                break
            }
        }
        for row in rows {
            if case .line(let number, let text, let kind) = pane.rows[row] {
                drawLineText(number: number, text: text, kind: kind, pane: pane,
                             y: CGFloat(pane.index.tops[row]) - offset, colors: colors, context: context, scale: scale)
            }
        }
        drawGuides(pane, top: top, bottom: bottom, colors: colors)
        // The gutter, opaque over the content: WebKit composites it as a layer of its own above the code.
        let gutterWidth = DiffPanes.gutterWidth + DiffPanes.markerWidth
        colors.nsColor("--editor-bg").setFill()
        NSRect(x: pane.x, y: paintBand.minY, width: gutterWidth, height: paintBand.height).fill()
        for row in rows {
            drawGutter(pane.rows[row], pane: pane, y: CGFloat(pane.index.tops[row]) - offset, colors: colors,
                       context: context, scale: scale)
        }
    }

    /// Writes a fill's stored bytes over `rect` (canvas points) of the pane's content layer.
    func store(_ bytes: [Double], in rect: NSRect, pane: Pane, scale: CGFloat) {
        let surface = pane.x == 0 ? paneSurfaces[0] : paneSurfaces[1]
        let clipped = rect.intersection(paintBand)
        guard !clipped.isNull else {
            return
        }
        surface.store(bytes, in: CGRect(
            x: (clipped.minX - pane.surfaceX) * scale, y: clipped.minY * scale,
            width: clipped.width * scale, height: clipped.height * scale
        ))
    }

    /// A line's changed words (cm-changedText) and its text, in the content layer over the line's tint.
    private func drawLineText(
        number: Int, text: String, kind: DiffRow.Kind, pane: Pane, y: CGFloat, colors: CanvasColors,
        context: CGContext, scale: CGFloat
    ) {
        let textX = pane.x + DiffPanes.gutterWidth + DiffPanes.markerWidth
        let start = number - 1 < pane.lineStarts.count ? pane.lineStarts[number - 1] : 0
        let spans = pane.spans?.line(start: start, length: (text as NSString).length) ?? []
        let line = CodeLineText.line(text, spans: spans, colors: colors)
        if let marks = pane.marks[number], kind == .changed {
            drawMarks(marks, of: line, x: textX + 6, rowTop: y, pane: pane, colors: colors, scale: scale)
        }
        glyphs.draw(line, x: textX + 6 - pane.surfaceX, rowTop: y, clip: localClip(context, scale: scale),
                    into: context, scale: scale, layer: true)
    }

    /// The changed text's boxes (cm-changedText) behind the line: 17 points from a point above the row (the font's
    /// content area as the page lays it out), 2-point corners, edges on whole device pixels, blended into the content
    /// layer over what it holds there (the line's tint, and the row before's for the point above).
    private func drawMarks(
        _ marks: [Range<Int>], of line: CTLine, x: CGFloat, rowTop: CGFloat, pane: Pane, colors: CanvasColors,
        scale: CGFloat
    ) {
        let surface = pane.x == 0 ? paneSurfaces[0] : paneSurfaces[1]
        let pixel = { (value: CGFloat) in ((value - pane.surfaceX) * scale).rounded() }
        let clip = CGRect(x: 0, y: paintBand.minY * scale, width: .greatestFiniteMagnitude,
                          height: paintBand.height * scale)
        // The fill's alpha in 8 bits (0.28 is 71 of 255): light's rgba(53, 116, 240, 0.28) over its line's tint is
        // stored as 26, 43, 86, 95, where the unrounded alpha gives blue 87.
        let alpha = (colors.alpha("--diff-inline") * 255).rounded() / 255
        for mark in marks {
            let start = pixel(x + CTLineGetOffsetForStringIndex(line, mark.lowerBound, nil))
            let end = pixel(x + CTLineGetOffsetForStringIndex(line, mark.upperBound, nil))
            let rect = CGRect(x: start, y: (rowTop - 1) * scale, width: end - start, height: 17 * scale)
            let path = CGPath(roundedRect: rect, cornerWidth: 2 * scale, cornerHeight: 2 * scale, transform: nil)
            surface.blend(colors.exact("--diff-inline"), alpha: alpha, path: path, clip: clip)
        }
    }

    /// The gutter of a row: a changed line's marker edge and every line's number, blended onto the opaque gutter.
    func drawGutter(
        _ row: DiffRow, pane: Pane, y: CGFloat, colors: CanvasColors, context: CGContext, scale: CGFloat
    ) {
        guard case .line(let number, _, let kind) = row else {
            return
        }
        let textX = pane.x + DiffPanes.gutterWidth + DiffPanes.markerWidth
        if kind != .unchanged {
            colors.nsColor("--diff-modified-edge").setFill()
            NSRect(x: textX - 2, y: y, width: 2, height: DiffPanes.lineHeight).fill()
        }
        let numberLine = CTLineCreateWithAttributedString(NSAttributedString(string: "\(number)", attributes: [
            .font: CodeFonts.shared.regular, .foregroundColor: colors.textColor("--editor-line-number"),
        ]))
        let numberWidth = CTLineGetTypographicBounds(numberLine, nil, nil, nil)
        glyphs.draw(numberLine, x: pane.x + DiffPanes.gutterWidth - 10 - numberWidth - pane.surfaceX, rowTop: y,
                    clip: localClip(context, scale: scale), into: context, scale: scale)
    }

    /// The paint band in a pane's content layer's own points, for GlyphCompositor.
    func localClip(_ context: CGContext, scale: CGFloat) -> CGRect {
        CGRect(x: 0, y: paintBand.minY, width: CGFloat(context.width) / scale, height: paintBand.height)
    }

    /// --panel-alt between --border-strong lines, with a .diff-revert chevron 4 points above each change's first row.
    func drawRevertColumn(_ content: Content, colors: CanvasColors, x: CGFloat, top: Double, bottom: Double) {
        let index = content.left
        // .cm-merge-revert is as tall as the editors: the rows, their padding and the scrollbar below them.
        let columnRect = NSRect(
            x: x, y: -offset, width: DiffPanes.gap(readonly: content.readonly),
            height: DiffPanes.editorHeight(rowsBottom: max(index.rowsBottom, content.right.rowsBottom))
        )
        colors.nsColor("--border-strong").setFill()
        columnRect.fill()
        if content.readonly {
            return
        }
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

    func lineHeight(_ font: NSFont) -> CGFloat {
        (font.ascender - font.descender + font.leading).rounded(.up)
    }
}
