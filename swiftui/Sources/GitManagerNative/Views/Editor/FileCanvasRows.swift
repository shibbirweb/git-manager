// The file canvas's content layer (FileCanvas.swift), in the page's paint order: the active line's background, the
// word highlights (cm-selectionMatch), the code text, the indent guides and the blame note; then the gutter, opaque
// over the code as WebKit composites the sticky gutter above it: its background, the active line's, and the numbers.

import AppKit
import NativeCore

extension FileCanvas {
    func drawContent(_ content: Content, colors: CanvasColors, context: CGContext, scale: CGFloat) {
        let shown = lines(content, from: paintBand.minY, to: paintBand.maxY)
        let file = content.file
        let left = CGFloat(content.geometry.guttersWidth)
        let cursorLine = content.cursor.line
        if shown.contains(cursorLine) {
            store(colors.layerFill("--editor-active-line"), in: CGRect(
                x: left, y: lineTop(cursorLine), width: visibleWidth - left, height: CGFloat(EditorGeometry.lineHeight)
            ), scale: scale)
        }
        drawMatches(content, shown: shown, colors: colors, scale: scale)
        let textX = self.textX(content)
        for line in shown {
            let text = file.lines[line]
            let spans = file.spans?.line(start: file.lineStarts[line], length: text.utf16.count) ?? []
            glyphs.draw(CodeLineText.line(text, spans: spans, colors: colors), x: textX, rowTop: lineTop(line),
                        clip: localClip(context, scale: scale), into: context, scale: scale, layer: true)
        }
        drawGuides(content, colors: colors, scale: scale)
        if let label = content.blameLabel, shown.contains(cursorLine) {
            let note = CTLineCreateWithAttributedString(NSAttributedString(string: label, attributes: [
                .font: noteFont, .foregroundColor: colors.textColor("--text-faint"),
            ]))
            let x = left - offsetX + noteX(lineLength: file.lines[cursorLine].utf16.count)
            glyphs.draw(note, x: x, rowTop: lineTop(cursorLine), clip: localClip(context, scale: scale),
                        into: context, scale: scale, layer: true, baseline: lineTop(cursorLine) + noteBaseline)
        }
    }

    /// The note's baseline below its line's top: a 17-point line box from a point above the row, the font's ascent
    /// and descent rounded as WebKit rounds them, the rest split above and below.
    var noteBaseline: CGFloat {
        let ascent = noteFont.ascender.rounded(), descent = (-noteFont.descender).rounded()
        return -1 + (17 - ascent - descent) / 2 + ascent
    }

    /// The word at the cursor and its other whole-word matches in the lines on screen (WordMatches): 17 points from
    /// a point above the row, --accent at 18% in 8 bits, edges on device pixels.
    private func drawMatches(_ content: Content, shown: Range<Int>, colors: CanvasColors, scale: CGFloat) {
        let file = content.file
        let onScreen = lines(content, from: 0, to: bounds.height, spill: 0)
        let extra: Set<UInt16> = ["TypeScript", "JavaScript", "TypeScript JSX", "JavaScript JSX"]
            .contains(file.language) ? [36] : []
        let matches = WordMatches.matches(
            cursorLine: content.cursor.line, cursorColumn: content.cursor.column, visible: onScreen, extra: extra
        ) { Array(file.lines[$0].utf16) }
        let alpha = (0.18 * 255).rounded() / 255
        let textX = self.textX(content)
        for match in matches where shown.contains(match.line) {
            let start = ((textX + CGFloat(match.range.lowerBound) * CodeLineText.advance) * scale).rounded()
            let end = ((textX + CGFloat(match.range.upperBound) * CodeLineText.advance) * scale).rounded()
            let top = (lineTop(match.line) - 1) * scale
            let rect = CGRect(x: start, y: top, width: end - start, height: 17 * scale)
            let clip = CGRect(x: 0, y: paintBand.minY * scale, width: bounds.width * scale,
                              height: paintBand.height * scale)
            let area = rect.intersection(clip)
            if !area.isNull {
                surface.blend(colors.exact("--accent"), alpha: alpha, in: area)
            }
        }
    }

    /// The gutter: line numbers right-aligned 10 points before their gutter's end, the cursor line's in --text-dim
    /// on the active line's background, the change and fold gutters empty.
    func drawGutter(_ content: Content, colors: CanvasColors, context: CGContext, scale: CGFloat) {
        let geometry = content.geometry
        let width = CGFloat(geometry.guttersWidth)
        colors.nsColor("--editor-gutter").setFill()
        NSRect(x: 0, y: paintBand.minY, width: width, height: paintBand.height).fill()
        let shown = lines(content, from: paintBand.minY, to: paintBand.maxY)
        let cursorLine = content.cursor.line
        if shown.contains(cursorLine) {
            colors.nsColor("--editor-active-line").setFill()
            NSRect(x: 0, y: lineTop(cursorLine), width: width, height: CGFloat(EditorGeometry.lineHeight)).fill()
        }
        let right = CGFloat(geometry.numbersWidth) - 10
        for line in shown {
            let token = line == cursorLine ? "--text-dim" : "--editor-line-number"
            let number = CTLineCreateWithAttributedString(NSAttributedString(string: "\(line + 1)", attributes: [
                .font: CodeFonts.shared.regular, .foregroundColor: colors.textColor(token),
            ]))
            let numberWidth = CGFloat(CTLineGetTypographicBounds(number, nil, nil, nil))
            glyphs.draw(number, x: right - numberWidth, rowTop: lineTop(line), clip: localClip(context, scale: scale),
                        into: context, scale: scale)
        }
    }

    /// One 1-point line per indent guide run, color-mix(--text-faint 38%, transparent), at its exact x: each pixel
    /// column it touches takes the alpha times its coverage (DiffCanvasExtras.drawGuides).
    private func drawGuides(_ content: Content, colors: CanvasColors, scale: CGFloat) {
        let top = Double(paintBand.minY + offset), bottom = Double(paintBand.maxY + offset)
        let step = CodeLineText.advance * CGFloat(content.file.indent?.size ?? 2)
        let originX = textX(content)
        for run in content.file.guides where run.bottom > top && run.top < bottom {
            let indent = (CGFloat(run.level) * step * 64).rounded(.down) / 64
            let left = (originX + indent) * scale, right = left + scale
            let segment = CGRect(x: 0, y: CGFloat(max(run.top, top)) - offset, width: 1,
                                 height: CGFloat(min(run.bottom, bottom) - max(run.top, top)))
            var column = left.rounded(.down)
            while column < right, segment.height > 0 {
                let coverage = Double(min(right, column + 1) - max(left, column))
                surface.blend(colors.exact("--text-faint"), alpha: 0.38 * coverage, in: CGRect(
                    x: column, y: segment.minY * scale, width: 1, height: segment.height * scale
                ))
                column += 1
            }
        }
    }

    /// Writes a fill's stored bytes over `rect` (canvas points) of the content layer, inside the paint band.
    private func store(_ bytes: [Double], in rect: CGRect, scale: CGFloat) {
        let clipped = rect.intersection(paintBand)
        guard !clipped.isNull else {
            return
        }
        surface.store(bytes, in: CGRect(x: clipped.minX * scale, y: clipped.minY * scale,
                                        width: clipped.width * scale, height: clipped.height * scale))
    }

    func localClip(_ context: CGContext, scale: CGFloat) -> CGRect {
        CGRect(x: 0, y: paintBand.minY, width: CGFloat(context.width) / scale, height: paintBand.height)
    }
}
