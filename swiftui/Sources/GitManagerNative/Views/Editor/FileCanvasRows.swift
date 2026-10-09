// The file canvas's content layer (FileCanvas.swift), in the page's paint order: the selection layer (behind the
// lines), the active line's background (only while nothing is selected, highlightActiveLineWhenEmpty), the
// highlights (word or selection matches, matching brackets, the whitespace dots of selected spaces), the fold
// placeholders, the code text, the indent guides and the blame note; then the gutter, opaque over the code as WebKit
// composites the sticky gutter above it: its background, the cursor lines', the change bars, the numbers and the
// fold markers.

import AppKit
import NativeCore

extension FileCanvas {
    func drawContent(_ content: Content, colors: CanvasColors, context: CGContext, scale: CGFloat) {
        let shown = rows(content, from: paintBand.minY, to: paintBand.maxY)
        let left = CGFloat(content.geometry.guttersWidth)
        drawSelections(content, colors: colors, scale: scale)
        let selection = content.state.selection
        if selection.ranges.allSatisfy(\.isEmpty) {
            var done = Set<Int>()
            for range in selection.ranges {
                let row = row(of: range.head, content)
                if shown.contains(row) && done.insert(row).inserted {
                    let extra = blockExtra(row)
                    store(colors.layerFill("--editor-active-line"), in: CGRect(
                        x: left, y: rowTop(row) - extra, width: visibleWidth - left,
                        height: CGFloat(EditorGeometry.lineHeight) + extra
                    ), scale: scale)
                }
            }
        }
        drawHighlights(content, shown: shown, colors: colors, scale: scale)
        let textX = self.textX(content)
        for row in shown {
            drawRow(content, row: row, x: textX, colors: colors, context: context, scale: scale)
        }
        drawGuides(content, colors: colors, scale: scale)
        drawBlameNote(content, shown: shown, colors: colors, context: context, scale: scale)
    }

    /// One row's text (and its fold placeholders) with its syntax colors.
    private func drawRow(_ content: Content, row: Int, x: CGFloat, colors: CanvasColors, context: CGContext,
                         scale: CGFloat) {
        var left = x
        let clip = localClip(context, scale: scale)
        let tabSize = content.state.config.tabSize
        var column = 0
        for segment in segments(content, row: row) {
            switch segment {
            case .text(let from, let to):
                let raw = content.doc.slice(from, to)
                let spans = content.colors?.line(start: from, length: to - from) ?? []
                let (text, mapped) = Self.expandTabs(raw, spans: spans, startColumn: column, tabSize: tabSize)
                if !text.isEmpty {
                    glyphs.draw(CodeLineText.line(text, spans: mapped, colors: colors), x: left, rowTop: rowTop(row),
                                clip: clip, into: context, scale: scale, layer: true)
                }
                let width = text.utf16.count
                column += width
                left += CGFloat(width) * CodeLineText.advance
            case .placeholder:
                drawPlaceholder(at: left, row: row, colors: colors, context: context, scale: scale)
                left += Self.placeholderWidth
            }
        }
    }

    /// The text with each tab as the spaces to its tab stop, and the spans moved to match.
    static func expandTabs(_ text: String, spans: [SyntaxSpans.Span], startColumn: Int,
                           tabSize: Int) -> (String, [SyntaxSpans.Span]) {
        guard text.contains("\t") else {
            return (text, spans)
        }
        var result = "", map: [Int] = [], column = startColumn
        for unit in text.utf16 {
            map.append(column - startColumn)
            if unit == 9 {
                let width = tabSize - column % tabSize
                result += String(repeating: " ", count: width)
                column += width
            } else {
                result += String(decoding: [unit], as: UTF16.self)
                column += 1
            }
        }
        map.append(column - startColumn)
        let moved = spans.map { span in
            SyntaxSpans.Span(from: map[min(span.from, map.count - 1)], to: map[min(span.to, map.count - 1)],
                             style: span.style)
        }
        return (result, moved)
    }

    /// The main cursor line's note, 36 points after its row's end, while nothing is selected.
    private func drawBlameNote(_ content: Content, shown: Range<Int>, colors: CanvasColors, context: CGContext,
                               scale: CGFloat) {
        guard let label = content.blameLabel else {
            return
        }
        let row = row(of: content.state.selection.main.head, content)
        guard shown.contains(row) else {
            return
        }
        let note = CTLineCreateWithAttributedString(NSAttributedString(string: label, attributes: [
            .font: noteFont, .foregroundColor: colors.textColor("--text-faint"),
        ]))
        let x = CGFloat(content.geometry.guttersWidth) - offsetX + noteX(rowWidth: rowWidth(content, row: row))
        glyphs.draw(note, x: x, rowTop: rowTop(row), clip: localClip(context, scale: scale), into: context,
                    scale: scale, layer: true, baseline: rowTop(row) + noteBaseline)
    }

    /// The note's baseline below its row's top: a 17-point line box from a point above the row, the font's ascent
    /// and descent rounded as WebKit rounds them, the rest split above and below.
    var noteBaseline: CGFloat {
        let ascent = noteFont.ascender.rounded(), descent = (-noteFont.descender).rounded()
        return -1 + (17 - ascent - descent) / 2 + ascent
    }

    /// The gutter: line numbers right-aligned 10 points before their gutter's end, the cursor lines' in --text-dim
    /// on the active line's background (highlightActiveLineGutter, also with a selection), the change bars, and a
    /// folded row's marker.
    func drawGutter(_ content: Content, colors: CanvasColors, context: CGContext, scale: CGFloat) {
        let geometry = content.geometry
        let width = CGFloat(geometry.guttersWidth)
        colors.nsColor("--editor-gutter").setFill()
        NSRect(x: 0, y: paintBand.minY, width: width, height: paintBand.height).fill()
        let shown = rows(content, from: paintBand.minY, to: paintBand.maxY)
        let active = Set(content.state.selection.ranges.map { row(of: $0.head, content) })
        for row in shown where active.contains(row) {
            colors.nsColor("--editor-active-line").setFill()
            let extra = blockExtra(row)
            let height = CGFloat(EditorGeometry.lineHeight) + extra
            NSRect(x: 0, y: rowTop(row) - extra, width: width, height: height).fill()
        }
        drawChangeBars(content, shown: shown, colors: colors)
        let right = CGFloat(geometry.numbersWidth) - 10
        for row in shown {
            let line = content.layout.lines(forRow: row).lowerBound
            let token = active.contains(row) ? "--text-dim" : "--editor-line-number"
            let number = CTLineCreateWithAttributedString(NSAttributedString(string: "\(line + 1)", attributes: [
                .font: CodeFonts.shared.regular, .foregroundColor: colors.textColor(token),
            ]))
            let numberWidth = CGFloat(CTLineGetTypographicBounds(number, nil, nil, nil))
            glyphs.draw(number, x: right - numberWidth, rowTop: rowTop(row) - blockExtra(row),
                        clip: localClip(context, scale: scale), into: context, scale: scale)
            if content.layout.group(forLine: line) != nil {
                drawFoldMarker(content, row: row, colors: colors)
            }
        }
    }

    /// One 1-point line per indent guide run, color-mix(--text-faint 38%, transparent), at its exact x: each pixel
    /// column it touches takes the alpha times its coverage (DiffCanvasExtras.drawGuides).
    private func drawGuides(_ content: Content, colors: CanvasColors, scale: CGFloat) {
        let top = Double(paintBand.minY + offset), bottom = Double(paintBand.maxY + offset)
        let step = CodeLineText.advance * CGFloat(content.indentSize)
        let originX = textX(content)
        for run in guides(content) where run.bottom > top && run.top < bottom {
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

    /// The indent guide runs of the rows, worked out again only when the text or the folds change.
    private func guides(_ content: Content) -> [IndentGuides.Run] {
        let key = "\(content.path):\(content.docRevision)"
        if let guideCache, guideCache.key == key {
            return guideCache.runs
        }
        let lines = content.doc.allLines
        let unit = content.indentSize
        let levels = IndentGuides.levels(lines: lines, tabSize: EditorInfo.defaultTabSize, unit: unit)
        let rows = (0..<content.layout.rowCount).map { row -> DiffRow in
            let line = content.layout.lines(forRow: row).lowerBound
            return DiffRow.line(number: line + 1, text: "", kind: .unchanged)
        }
        let runs = IndentGuides.runs(rows: rows, levels: levels, metrics: RowMetrics(
            line: EditorGeometry.lineHeight, fold: 0, padding: EditorGeometry.topPadding
        ))
        guideCache = (key, runs)
        return runs
    }

    /// Writes a fill's stored bytes over `rect` (canvas points) of the content layer, inside the paint band.
    func store(_ bytes: [Double], in rect: CGRect, scale: CGFloat) {
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
