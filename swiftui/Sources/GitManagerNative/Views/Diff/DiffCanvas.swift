// Draws what is on screen of a side-by-side diff, and nothing else: one view the size of the viewport that paints
// the rows crossing it from the scroll offset (RowIndex), so memory stays the same however long the file is or
// however far it scrolls. The look is measured from the current app (DiffPanes.swift has the sizes).

import AppKit
import NativeCore

final class DiffCanvas: NSView {
    struct Content {
        var layout: DiffLayout
        var left: RowIndex
        var right: RowIndex
        var staged: Bool
        var theme: Theme
        var leftSpans: SyntaxColors?
        var rightSpans: SyntaxColors?
        var leftGuides: [IndentGuides.Run] = []
        var rightGuides: [IndentGuides.Run] = []
        /// Each pane's content width (its widest shown line and CodeMirror's line padding), for the scrollbar.
        var leftWidth: CGFloat = 0
        var rightWidth: CGFloat = 0
    }

    /// One pane's rows and what colors them.
    struct Pane {
        let rows: [DiffRow]
        let index: RowIndex
        let x: CGFloat
        let spans: SyntaxColors?
        let marks: [Int: [Range<Int>]]
        let lineStarts: [Int]
        let guides: [IndentGuides.Run]
        let contentWidth: CGFloat
    }

    var content: Content? {
        didSet {
            needsDisplay = true
        }
    }

    /// The scroll position: the content's y at the canvas's top edge.
    var offset: CGFloat = 0 {
        didSet {
            if offset != oldValue {
                needsDisplay = true
            }
        }
    }

    /// The viewport's pixels, reused while the size stays the same.
    private var bitmap: CGContext?
    let glyphs = GlyphCompositor()

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layerContentsRedrawPolicy = .onSetNeedsDisplay
    }

    required init?(coder: NSCoder) {
        nil
    }

    override var isFlipped: Bool {
        true
    }

    private let codeFont =
        NSFont(name: "JetBrains Mono", size: 13) ?? .monospacedSystemFont(ofSize: 13, weight: .regular)
    let foldFont = NSFont.systemFont(ofSize: 11.5)

    override var wantsUpdateLayer: Bool {
        true
    }

    /// Paints into a Display P3 bitmap and hands the layer the image: AppKit's own backing store converted every
    /// color one step off, while P3 values pass through unchanged, as they do for SwiftUI's fills.
    override func updateLayer() {
        let scale = window?.backingScaleFactor ?? 2
        let width = Int((bounds.width * scale).rounded())
        let height = Int((bounds.height * scale).rounded())
        guard width > 0, height > 0, let space = CGColorSpace(name: CGColorSpace.displayP3) else {
            layer?.contents = nil
            return
        }
        if bitmap?.width != width || bitmap?.height != height {
            bitmap = CGContext(
                data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
            )
        }
        guard let bitmap else {
            return
        }
        bitmap.saveGState()
        bitmap.translateBy(x: 0, y: CGFloat(height))
        bitmap.scaleBy(x: scale, y: -scale)
        // The page's -webkit-font-smoothing: antialiased, as the app's AppleFontSmoothing 0 gives the other views.
        bitmap.setShouldSmoothFonts(false)
        let previous = NSGraphicsContext.current
        NSGraphicsContext.current = NSGraphicsContext(cgContext: bitmap, flipped: true)
        paint(bounds)
        NSGraphicsContext.current = previous
        bitmap.restoreGState()
        layer?.contentsScale = scale
        layer?.contents = bitmap.makeImage()
    }

    private func paint(_ dirtyRect: NSRect) {
        guard let content, let context = NSGraphicsContext.current?.cgContext else {
            return
        }
        let theme = content.theme
        theme.nsColor("--editor-bg").setFill()
        dirtyRect.fill()
        let paneWidth = max(0, (bounds.width - DiffPanes.gapWidth) / 2)
        let top = Double(offset + dirtyRect.minY)
        let bottom = Double(offset + dirtyRect.maxY)
        let layout = content.layout
        let panes = [
            Pane(rows: layout.left, index: content.left, x: 0, spans: content.leftSpans, marks: layout.leftMarks,
                 lineStarts: layout.leftLineStarts, guides: content.leftGuides, contentWidth: content.leftWidth),
            Pane(rows: layout.right, index: content.right, x: paneWidth + DiffPanes.gapWidth,
                 spans: content.rightSpans, marks: layout.rightMarks, lineStarts: layout.rightLineStarts,
                 guides: content.rightGuides, contentWidth: content.rightWidth),
        ]
        for pane in panes {
            context.saveGState()
            NSRect(x: pane.x, y: dirtyRect.minY, width: paneWidth, height: dirtyRect.height).clip()
            for row in pane.index.visible(from: top, to: bottom) {
                let y = CGFloat(pane.index.tops[row]) - offset
                let previousTinted = row > 0 && DiffCanvas.isTinted(pane.rows[row - 1])
                drawRow(pane.rows[row], pane: pane, y: y, width: paneWidth, theme: theme, context: context,
                        previousTinted: previousTinted)
            }
            drawGuides(pane, top: top, bottom: bottom, theme: theme)
            drawScrollbar(pane, width: paneWidth, theme: theme)
            context.restoreGState()
        }
        drawRevertColumn(content, x: paneWidth, top: top, bottom: bottom)
    }

    private func drawRow(
        _ row: DiffRow, pane: Pane, y: CGFloat, width: CGFloat, theme: Theme, context: CGContext,
        previousTinted: Bool
    ) {
        let x = pane.x
        let textX = x + DiffPanes.gutterWidth + DiffPanes.markerWidth
        switch row {
        case .line(let number, let text, let kind):
            if kind != .unchanged {
                tint(kind, theme).setFill()
                NSRect(x: textX, y: y, width: width - textX + x, height: DiffPanes.lineHeight).fill()
                theme.nsColor("--diff-modified-edge").setFill()
                NSRect(x: textX - 2, y: y, width: 2, height: DiffPanes.lineHeight).fill()
            }
            let numberLine = CTLineCreateWithAttributedString(NSAttributedString(string: "\(number)", attributes: [
                .font: CodeFonts.shared.regular, .foregroundColor: theme.textColor("--editor-line-number"),
            ]))
            let numberWidth = CTLineGetTypographicBounds(numberLine, nil, nil, nil)
            let scale = window?.backingScaleFactor ?? 2
            let clip = CGRect(x: x, y: 0, width: width, height: bounds.height)
            glyphs.draw(numberLine, x: x + DiffPanes.gutterWidth - 10 - numberWidth, rowTop: y, clip: clip,
                        into: context, scale: scale)
            let start = number - 1 < pane.lineStarts.count ? pane.lineStarts[number - 1] : 0
            let spans = pane.spans?.line(start: start, length: (text as NSString).length) ?? []
            let line = CodeLineText.line(text, spans: spans, theme: theme)
            var under = TextUnder(editor: theme.bytes("--editor-bg"))
            if kind != .unchanged {
                under.fill = theme.layerFill([Self.tintToken(kind)])
            }
            if let marks = pane.marks[number], kind == .changed {
                let onLine = theme.nsLayers([("--diff-modified", nil), ("--diff-inline", nil)], on: "--editor-bg")
                let above = previousTinted ? onLine : theme.nsLayers([("--diff-inline", nil)], on: "--editor-bg")
                CodeLineText.drawMarks(
                    marks, of: line, x: textX + 6, rowTop: y, colors: (above: above, onLine: onLine), scale: scale
                )
                let fill = theme.layerFill(["--diff-modified", "--diff-inline"])
                under.marks = CodeLineText.markColumns(marks, of: line, x: textX + 6, scale: scale).map { ($0, fill) }
            }
            glyphs.draw(line, x: textX + 6, rowTop: y, clip: clip, into: context, scale: scale, under: under)
        case .fold(let range):
            drawFoldBar(range, pane: pane, y: y, width: width, theme: theme, context: context)
        case .spacer:
            break
        }
    }

    /// --panel-alt between --border-strong lines, with a .diff-revert chevron 4 points above each change's first row.
    private func drawRevertColumn(_ content: Content, x: CGFloat, top: Double, bottom: Double) {
        let index = content.left
        // .cm-merge-revert is as tall as the editors: the rows, their padding and the scrollbar below them.
        let columnRect = NSRect(
            x: x, y: -offset, width: DiffPanes.gapWidth, height: DiffPanes.editorHeight(rowsBottom: index.rowsBottom)
        )
        content.theme.nsColor("--border-strong").setFill()
        columnRect.fill()
        content.theme.nsColor("--panel-alt").setFill()
        columnRect.insetBy(dx: 1, dy: 0).fill()
        let rows = content.layout.left
        let shown = index.visible(from: top - 20, to: bottom + 20)
        let icon = content.staged ? "chevrons-right" : "chevrons-left"
        for row in shown where DiffCanvas.startsChange(rows, at: row) {
            let y = CGFloat(index.tops[row]) - offset
            drawIcon(icon, in: NSRect(x: x + 1 + 4.5, y: y - 4 + 3.5, width: 13, height: 13),
                     color: content.theme.nsColor("--accent"))
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

    private func tint(_ kind: DiffRow.Kind, _ theme: Theme) -> NSColor {
        switch kind {
        case .added:
            return theme.nsSolid("--diff-added", on: "--editor-bg")
        case .changed:
            return theme.nsSolid("--diff-modified", on: "--editor-bg")
        case .deleted:
            return theme.nsSolid("--diff-deleted", on: "--editor-bg")
        case .unchanged:
            return .clear
        }
    }

    /// The top of a line of `font` centered in a row at `rowTop`.
    private func textY(_ rowTop: CGFloat, _ font: NSFont) -> CGFloat {
        rowTop + (DiffPanes.lineHeight - lineHeight(font)) / 2
    }

    func lineHeight(_ font: NSFont) -> CGFloat {
        (font.ascender - font.descender + font.leading).rounded(.up)
    }
}
