// What the file canvas draws around the text: the selection rectangles (drawSelection's rectanglesForRange: one box
// for a range in one row, else a top piece to the content's right side, the rows between, and a bottom piece), the
// word and selection match tints, the matching brackets, the fold placeholder, the change bars and the fold marker.
// Boxes are the text's 17-point line box from a point above the row; edges land on device pixels as WebKit snaps
// a background.

import AppKit
import NativeCore

extension FileCanvas {
    /// The selection rectangles of every non-empty range, in canvas points.
    func selectionRects(_ content: Content) -> [CGRect] {
        let textX = self.textX(content), rightSide = contentRight(content)
        var rects: [CGRect] = []
        for range in content.state.selection.ranges where !range.isEmpty {
            let fromRow = row(of: range.from, content), toRow = row(of: range.to, content)
            let fromX = textX + x(of: range.from, row: fromRow, content)
            let toX = textX + x(of: range.to, row: toRow, content)
            if fromRow == toRow {
                rects.append(CGRect(x: fromX, y: rowTop(fromRow) - 1, width: max(0, toX - fromX), height: 17))
                continue
            }
            let top = CGRect(x: fromX, y: rowTop(fromRow) - 1, width: max(0, rightSide - fromX), height: 17)
            let bottom = CGRect(x: textX, y: rowTop(toRow) - 1, width: max(0, toX - textX), height: 17)
            rects.append(top)
            if toRow > fromRow + 1 {
                rects.append(CGRect(x: textX, y: top.maxY, width: max(0, rightSide - textX),
                                    height: bottom.minY - top.maxY))
            }
            rects.append(bottom)
        }
        return rects
    }

    func drawSelections(_ content: Content, colors: CanvasColors, scale: CGFloat) {
        let fill = colors.layerFill("--editor-selection")
        for rect in selectionRects(content) {
            storeSnapped(fill, in: rect, scale: scale)
        }
    }

    /// Writes `bytes` over `rect` with its edges rounded to device pixels, inside the paint band.
    func storeSnapped(_ bytes: [Double], in rect: CGRect, scale: CGFloat) {
        let snapped = CGRect(x: (rect.minX * scale).rounded() / scale, y: (rect.minY * scale).rounded() / scale,
                             width: 0, height: 0)
        let right = (rect.maxX * scale).rounded() / scale, bottom = (rect.maxY * scale).rounded() / scale
        store(bytes, in: CGRect(x: snapped.minX, y: snapped.minY, width: right - snapped.minX,
                                height: bottom - snapped.minY), scale: scale)
    }

    /// The match tints (--accent at 18%), the matching brackets and the dots of selected spaces, on rows `shown`.
    func drawHighlights(_ content: Content, shown: Range<Int>, colors: CanvasColors, scale: CGFloat) {
        let alpha = (0.18 * 255).rounded() / 255
        for (row, range) in matchRanges(content) where shown.contains(row) {
            blendBox(colors.exact("--accent"), alpha: alpha, row: row, range: range, content, scale: scale)
        }
        for match in BracketMatch.matches(content.state) {
            let tint: (color: [Double], alpha: Double) = match.end == nil
                ? ([0xbb, 0x55, 0x55], Double(0x44) / 255) : ([0x32, 0x8c, 0x82], Double(0x52) / 255)
            for range in [match.start] + (match.end.map { [$0] } ?? []) {
                let row = row(of: range.lowerBound, content)
                if shown.contains(row) {
                    blendBox(tint.color, alpha: tint.alpha, row: row, range: range, content, scale: scale)
                }
            }
        }
        drawSelectedSpaces(content, shown: shown, colors: colors, scale: scale)
    }

    /// Word matches around an empty cursor, or the matches of a single selection, with their rows.
    func matchRanges(_ content: Content) -> [(Int, Range<Int>)] {
        let state = content.state
        let visible = rows(content, from: 0, to: bounds.height, spill: 0)
        guard !visible.isEmpty else {
            return []
        }
        let firstLine = content.layout.lines(forRow: visible.lowerBound).lowerBound
        let lastLine = content.layout.lines(forRow: visible.upperBound - 1).upperBound
        let from = content.doc.line(firstLine).from, to = content.doc.line(lastLine).to
        var ranges: [Range<Int>] = []
        if state.selection.ranges.count == 1 && state.selection.main.isEmpty {
            let head = state.selection.main.head, line = content.doc.lineAt(head)
            let extra = content.state.config.language.wordUnits
            let matches = WordMatches.matches(cursorLine: line.index, cursorColumn: head - line.from,
                                              visible: firstLine..<(lastLine + 1), extra: extra) {
                Array(content.doc.line($0).text.utf16)
            }
            ranges = matches.map { match in
                let start = content.doc.line(match.line).from
                return (start + match.range.lowerBound)..<(start + match.range.upperBound)
            }
        } else {
            ranges = SelectionMatches.ranges(state, visible: from..<to)
        }
        return ranges.map { (row(of: $0.lowerBound, content), $0) }
    }

    /// A tint over `range` in `row`: 17 points from a point above the row, edges on device pixels.
    func blendBox(_ color: [Double], alpha: Double, row: Int, range: Range<Int>, _ content: Content,
                  scale: CGFloat) {
        let textX = self.textX(content)
        let start = ((textX + x(of: range.lowerBound, row: row, content)) * scale).rounded()
        let end = ((textX + x(of: range.upperBound, row: row, content)) * scale).rounded()
        let rect = CGRect(x: start, y: (rowTop(row) - 1) * scale, width: end - start, height: 17 * scale)
        let clip = CGRect(x: 0, y: paintBand.minY * scale, width: bounds.width * scale,
                          height: paintBand.height * scale)
        let area = rect.intersection(clip)
        if !area.isNull {
            surface.blend(color, alpha: alpha, in: area)
        }
    }

    /// renderWhitespace "selection": a small --text-faint dot in the middle of each selected space.
    private func drawSelectedSpaces(_ content: Content, shown: Range<Int>, colors: CanvasColors, scale: CGFloat) {
        let textX = self.textX(content)
        for range in content.state.selection.ranges where !range.isEmpty {
            let fromRow = max(row(of: range.from, content), shown.lowerBound)
            let toRow = min(row(of: range.to, content), shown.upperBound - 1)
            guard fromRow <= toRow else {
                continue
            }
            for row in fromRow...toRow {
                for case .text(let from, let to) in segments(content, row: row) {
                    let start = max(from, range.from), end = min(to, range.to)
                    guard start < end else {
                        continue
                    }
                    for (offset, unit) in content.doc.slice(start, end).utf16.enumerated() where unit == 32 {
                        let left = textX + x(of: start + offset, row: row, content)
                        let center = CGPoint(x: left + CodeLineText.advance / 2, y: rowTop(row) - 1 + 17 * 0.52)
                        let dot = CGPath(ellipseIn: CGRect(x: center.x - 0.75, y: center.y - 0.75, width: 1.5,
                                                           height: 1.5), transform: nil)
                        var transform = CGAffineTransform(scaleX: scale, y: scale)
                        if let scaled = dot.copy(using: &transform) {
                            let clip = CGRect(x: 0, y: paintBand.minY * scale, width: bounds.width * scale,
                                              height: paintBand.height * scale)
                            surface.blend(colors.exact("--text-faint"), alpha: 1, path: scaled, clip: clip)
                        }
                    }
                }
            }
        }
    }

    /// .cm-foldPlaceholder at `x` (its margin box): CodeMirror's #eee inside a 1-point #ddd border, 0.2em corners,
    /// "…" in #888 2 points in from its border box; 19 points tall from a point above the row (measured).
    func drawPlaceholder(at x: CGFloat, row: Int, colors: CanvasColors, context: CGContext, scale: CGFloat) {
        // WebKit snaps the border box's left edge down to a device pixel; the right edge stays.
        let right = x + Self.placeholderWidth - 1, left = ((x + 1) * scale).rounded(.down) / scale
        let box = CGRect(x: left, y: rowTop(row) - 1 - 1, width: right - left, height: 17 + 2)
        let clip = CGRect(x: 0, y: paintBand.minY * scale, width: bounds.width * scale,
                          height: paintBand.height * scale)
        var transform = CGAffineTransform(scaleX: scale, y: scale)
        let radius = 0.2 * CodeFonts.shared.regular.pointSize
        let outer = CGPath(roundedRect: box, cornerWidth: radius, cornerHeight: radius, transform: &transform)
        let inner = CGPath(roundedRect: box.insetBy(dx: 1, dy: 1), cornerWidth: radius - 1, cornerHeight: radius - 1,
                           transform: &transform)
        surface.blend(CSSColor.parse("#eee")?.p3Exact ?? [238, 238, 238], alpha: 1, path: inner, clip: clip)
        surface.blend(CSSColor.parse("#ddd")?.p3Exact ?? [221, 221, 221], alpha: 1, path: outer.subtracting(inner),
                      clip: clip)
        let dots = CTLineCreateWithAttributedString(NSAttributedString(string: Self.placeholderText, attributes: [
            .font: CodeFonts.shared.regular, .foregroundColor: CSSColor.parse("#888")?.displayP3Exact ?? NSColor.gray,
        ]))
        glyphs.draw(dots, x: x + 1 + 1 + 1, rowTop: rowTop(row), clip: localClip(context, scale: scale),
                    into: context, scale: scale, layer: true)
    }

    /// .cm-change-bar: 3 points at the change gutter's left edge, the row's height; a deletion is a 5-point wedge on
    /// the next line's top edge (its bottom at the document's end).
    func drawChangeBars(_ content: Content, shown: Range<Int>, colors: CanvasColors) {
        let bars = ChangeMarks.gutter(content.marks, lineCount: content.doc.lineCount)
        let left = CGFloat(content.geometry.numbersWidth + content.geometry.blameWidth)
        for row in shown {
            guard let bar = bars[content.layout.lines(forRow: row).lowerBound] else {
                continue
            }
            let extra = blockExtra(row)
            let top = rowTop(row) - extra
            switch bar.kind {
            case "deleted":
                let tip = bar.atEnd ? top + CGFloat(EditorGeometry.lineHeight) + extra : top
                let wedge = NSBezierPath()
                wedge.move(to: NSPoint(x: left, y: tip - 4))
                wedge.line(to: NSPoint(x: left + 5, y: tip))
                wedge.line(to: NSPoint(x: left, y: tip + 4))
                wedge.close()
                colors.nsColor("--danger").setFill()
                wedge.fill()
            default:
                let token = bar.kind == "added" ? "--diff-added-edge"
                    : bar.kind == "conflict" ? "--danger" : "--diff-modified-edge"
                colors.nsColor(token).setFill()
                NSRect(x: left, y: top, width: 3, height: CGFloat(EditorGeometry.lineHeight) + extra).fill()
            }
        }
    }

    /// A folded row's marker (.cm-gm-fold-closed): the 10-point chevron turned to point right, in --text-faint,
    /// centered in the 14-point fold gutter. Open markers show only while the pointer is over the gutter.
    func drawFoldMarker(_ content: Content, row: Int, colors: CanvasColors) {
        let left = CGFloat(content.geometry.numbersWidth + content.geometry.blameWidth
            + EditorGeometry.changeGutterWidth) + 2
        // Centered in the folded row's 17-point block, half a point above the shifted row.
        let top = rowTop(row) - blockExtra(row) / 2 + 3
        let chevron = NSBezierPath()
        chevron.move(to: NSPoint(x: left + 3.5, y: top + 2))
        chevron.line(to: NSPoint(x: left + 6.5, y: top + 5))
        chevron.line(to: NSPoint(x: left + 3.5, y: top + 8))
        chevron.lineWidth = 1.3
        chevron.lineCapStyle = .round
        chevron.lineJoinStyle = .round
        colors.nsColor("--text-faint").setStroke()
        chevron.stroke()
    }
}
