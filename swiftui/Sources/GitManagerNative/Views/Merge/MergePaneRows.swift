// A merge pane's rows in its content layer, in the page's paint order: each line's background (a chunk's tint or the
// active line) and its inset edges, the changed words' boxes, the code, the indent guides, then the opaque gutter
// with the line numbers (extensions.ts mergeTheme and setup.ts editorTheme).

import AppKit
import NativeCore

extension MergePaneCanvas {
    static func tintToken(_ type: ChangeType) -> String {
        "--diff-\(type.rawValue)"
    }

    static func edgeToken(_ type: ChangeType) -> String {
        "--diff-\(type.rawValue)-edge"
    }

    func drawRows(
        _ content: Content, top: Double, bottom: Double, colors: CanvasColors, context: CGContext, scale: CGFloat
    ) {
        let rows = content.index.visible(from: top - Self.spill, to: bottom + Self.spill)
        let width = max(clientWidth, content.gutterWidth + contentWidth)
        let textX = content.gutterWidth
        for row in rows {
            let y = CGFloat(content.index.tops[row]) - offset
            let lineRect = NSRect(x: textX, y: y, width: width - textX, height: Self.lineHeight)
            let style = content.styles[row]
            if let tint = style?.tint {
                store(fill(Self.tintToken(tint), colors), in: lineRect, scale: scale)
            } else if row == content.activeLine {
                store(colors.layerFill("--editor-active-line"), in: lineRect, scale: scale)
            }
            guard let style else {
                continue
            }
            if let edge = style.edge.map(Self.edgeToken) {
                if style.edgeTop {
                    store(colors.layerFill(edge), in: NSRect(x: textX, y: y, width: lineRect.width, height: 1),
                          scale: scale)
                }
                if style.edgeBottom {
                    store(colors.layerFill(edge), in: NSRect(x: textX, y: y + Self.lineHeight - 1,
                                                             width: lineRect.width, height: 1), scale: scale)
                }
            }
            if let gap = style.gapBefore {
                store(colors.layerFill(Self.edgeToken(gap)), in: NSRect(x: textX, y: y, width: lineRect.width,
                                                                       height: 2), scale: scale)
            }
            if let gap = style.gapAfter {
                store(colors.layerFill(Self.edgeToken(gap)), in: NSRect(x: textX, y: y + Self.lineHeight - 2,
                                                                       width: lineRect.width, height: 2), scale: scale)
            }
        }
        for row in rows where row < content.lines.count {
            drawLine(row, content: content, y: CGFloat(content.index.tops[row]) - offset, colors: colors,
                     context: context, scale: scale)
        }
        drawGuides(content, top: top, bottom: bottom, colors: colors, scale: scale)
        colors.nsColor("--editor-gutter").setFill()
        NSRect(x: 0, y: paintBand.minY, width: content.gutterWidth, height: paintBand.height).fill()
        for row in rows where row < content.lines.count {
            drawNumber(row, content: content, y: CGFloat(content.index.tops[row]) - offset, colors: colors,
                       context: context, scale: scale)
        }
    }

    /// A translucent token as the page's layer stores it: the exact converted color times the 8-bit alpha, rounded
    /// (measured: --diff-conflict's blue is 16, where the rounded color gives 15).
    func fill(_ tokenName: String, _ colors: CanvasColors) -> [Double] {
        let weight = (colors.alpha(tokenName) * 255).rounded()
        return colors.exact(tokenName).map { ($0 * weight / 255).rounded() } + [weight]
    }

    /// Writes a fill's stored bytes over `rect` (canvas points) of the content layer.
    func store(_ bytes: [Double], in rect: NSRect, scale: CGFloat) {
        let clipped = rect.intersection(paintBand).intersection(NSRect(x: 0, y: -1e6, width: clientWidth,
                                                                       height: 2e6))
        guard !clipped.isNull else {
            return
        }
        surface.store(bytes, in: CGRect(x: clipped.minX * scale, y: clipped.minY * scale,
                                        width: clipped.width * scale, height: clipped.height * scale))
    }

    private func drawLine(
        _ row: Int, content: Content, y: CGFloat, colors: CanvasColors, context: CGContext, scale: CGFloat
    ) {
        let text = content.lines[row]
        let start = row < content.lineStarts.count ? content.lineStarts[row] : 0
        let spans = content.spans?.line(start: start, length: (text as NSString).length) ?? []
        let line = CodeLineText.line(text, spans: spans, colors: colors)
        let x = content.gutterWidth + 6
        if let word = content.matchWord {
            let matches = WordMatches.ranges(of: word, in: text)
            if !matches.isEmpty {
                // color-mix(in srgb, var(--accent) 18%, transparent), its alpha in 8 bits.
                drawMarks(matches, of: line, x: x, rowTop: y, token: "--accent", alpha: (0.18 * 255).rounded() / 255,
                          radius: 0, colors: colors, scale: scale)
            }
        }
        if let marks = content.styles[row]?.inline, !marks.isEmpty {
            let alpha = (colors.alpha("--diff-inline") * 255).rounded() / 255
            drawMarks(marks, of: line, x: x, rowTop: y, token: "--diff-inline", alpha: alpha, radius: 2, colors: colors,
                      scale: scale)
        }
        glyphs.draw(line, x: x, rowTop: y, clip: clip(context, scale: scale), into: context, scale: scale,
                    layer: true)
    }

    /// Inline backgrounds, blended into the content layer over the line's tint: the changed words' boxes
    /// (cm-mc-inline, 2-point corners) and the cursor word's matches (cm-selectionMatch, square), each like the
    /// diff's changed text 17 points from a point above the row, so the next line's box overlaps by a point.
    private func drawMarks(
        _ marks: [Range<Int>], of line: CTLine, x: CGFloat, rowTop: CGFloat, token: String, alpha: Double,
        radius: CGFloat, colors: CanvasColors, scale: CGFloat
    ) {
        let pixel = { (value: CGFloat) in (value * scale).rounded() }
        let bandClip = CGRect(x: 0, y: paintBand.minY * scale, width: clientWidth * scale,
                              height: paintBand.height * scale)
        for mark in marks {
            let start = pixel(x + CTLineGetOffsetForStringIndex(line, mark.lowerBound, nil))
            let end = pixel(x + CTLineGetOffsetForStringIndex(line, mark.upperBound, nil))
            let rect = CGRect(x: start, y: (rowTop - 1) * scale, width: end - start, height: 17 * scale)
            let path = CGPath(roundedRect: rect, cornerWidth: radius * scale, cornerHeight: radius * scale,
                              transform: nil)
            surface.blend(colors.exact(token), alpha: alpha, path: path, clip: bandClip)
        }
    }

    /// The gutter of a line: the active line's color behind its number, and the number right-aligned 10 points from
    /// the gutter's edge (12 and 10 points of padding, at least 40 wide).
    private func drawNumber(
        _ row: Int, content: Content, y: CGFloat, colors: CanvasColors, context: CGContext, scale: CGFloat
    ) {
        let active = row == content.activeLine
        if active {
            colors.nsColor("--editor-active-line").setFill()
            NSRect(x: 0, y: y, width: content.gutterWidth, height: Self.lineHeight).fill()
        }
        let numberLine = CTLineCreateWithAttributedString(NSAttributedString(string: "\(row + 1)", attributes: [
            .font: CodeFonts.shared.regular,
            .foregroundColor: colors.textColor(active ? "--text-dim" : "--editor-line-number"),
        ]))
        let numberWidth = CTLineGetTypographicBounds(numberLine, nil, nil, nil)
        glyphs.draw(numberLine, x: content.gutterWidth - 10 - numberWidth, rowTop: y, clip: clip(context, scale: scale),
                    into: context, scale: scale)
    }

    func clip(_ context: CGContext, scale: CGFloat) -> CGRect {
        CGRect(x: 0, y: paintBand.minY, width: CGFloat(context.width) / scale, height: paintBand.height)
    }

    /// Indent guides as in the diff (DiffCanvasExtras.drawGuides): a 1-point line per run at 38% of --text-faint.
    private func drawGuides(_ content: Content, top: Double, bottom: Double, colors: CanvasColors, scale: CGFloat) {
        let originX = content.gutterWidth + 6
        let step = CodeLineText.advance * 2
        for run in content.guides where run.bottom > top && run.top < bottom {
            let segmentTop = max(run.top, top), segmentBottom = min(run.bottom, bottom)
            let indent = (CGFloat(run.level) * step * 64).rounded(.down) / 64
            let left = (originX + indent) * scale, right = left + scale
            var column = left.rounded(.down)
            let segment = CGRect(x: 0, y: CGFloat(segmentTop) - offset, width: 1,
                                 height: CGFloat(segmentBottom - segmentTop))
            let rows = segment.intersection(CGRect(x: 0, y: paintBand.minY, width: 1, height: paintBand.height))
            while column < right, !rows.isNull {
                let coverage = Double(min(right, column + 1) - max(left, column))
                surface.blend(colors.exact("--text-faint"), alpha: 0.38 * coverage, in: CGRect(
                    x: column, y: rows.minY * scale, width: 1, height: rows.height * scale
                ))
                column += 1
            }
        }
    }
}
