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
        /// Where the right pane's blame note ends, from the content's left edge (DiffState.noteEnd); 0 for none.
        var rightNoteEnd: CGFloat = 0

        /// True when `other` paints the same pixels: the same rows, colors and widths. Arrays compare by their
        /// storage first, so a content SwiftUI hands over again unchanged costs next to nothing.
        func drawsLike(_ other: Content) -> Bool {
            layout == other.layout && staged == other.staged && theme.id == other.theme.id
                && leftSpans == other.leftSpans && rightSpans == other.rightSpans && leftWidth == other.leftWidth
                && rightWidth == other.rightWidth && rightNoteEnd == other.rightNoteEnd
        }
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
        var noteEnd: CGFloat = 0
    }

    var content: Content? {
        didSet {
            if let content, let oldValue, content.drawsLike(oldValue) {
                return
            }
            if content?.theme.id != colors?.theme.id {
                colors = content.map { CanvasColors(theme: $0.theme, extendedRange: extendedRange) }
            }
            paintedOffset = nil
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
    /// The offset the bitmap shows, so a scroll moves those pixels and paints only the rows that came into view;
    /// nil when it must be painted whole.
    private var paintedOffset: CGFloat?
    private var colors: CanvasColors?
    /// The part of the canvas being painted: glyphs, which GlyphCompositor writes straight into the pixels, stay in it.
    private(set) var paintBand = CGRect.zero
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

    let foldFont = NSFont.systemFont(ofSize: 11.5)

    override var wantsUpdateLayer: Bool {
        true
    }

    /// Paints into a bitmap in the window's color space and hands the layer the image: AppKit's own backing store
    /// converted every color one step off, while these values pass through unchanged, as they do for SwiftUI's
    /// fills. In any other space (Display P3 at first) Core Animation converted the whole image on every frame.
    override func updateLayer() {
        DrawStats.measure {
            paintLayer()
        }
    }

    /// The page's blends as the display composes them, with or without HDR headroom. Theme.nsLayers' other dark
    /// rules came from captures by CGWindowListCreateImage, which composites the window again and, without HDR
    /// headroom, often lands one step off (the current app's right editor as 30, 31, 33): not what the display shows
    /// (GM-50; gm-measure captures through ScreenCaptureKit since).
    private let extendedRange = true

    private func paintLayer() {
        let scale = window?.backingScaleFactor ?? 2
        let width = Int((bounds.width * scale).rounded())
        let height = Int((bounds.height * scale).rounded())
        let windowSpace = window?.colorSpace?.cgColorSpace
        guard width > 0, height > 0, let space = windowSpace ?? CGColorSpace(name: CGColorSpace.displayP3) else {
            layer?.contents = nil
            return
        }
        if bitmap?.width != width || bitmap?.height != height || bitmap?.colorSpace != space {
            bitmap = CGContext(
                data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
            )
            paintedOffset = nil
        }
        guard let bitmap else {
            return
        }
        var band = bounds
        if let paintedOffset, let moved = shift(bitmap, by: (offset - paintedOffset) * scale) {
            if moved == 0 {
                return
            }
            // Rows of pixels, not points, so the band's edges are the edges of what moved.
            let exposed = CGFloat(min(abs(moved), height)) / scale
            band = moved > 0 ? CGRect(x: 0, y: CGFloat(height) / scale - exposed, width: bounds.width, height: exposed)
                : CGRect(x: 0, y: 0, width: bounds.width, height: exposed)
        }
        bitmap.saveGState()
        bitmap.translateBy(x: 0, y: CGFloat(height))
        bitmap.scaleBy(x: scale, y: -scale)
        // The page's -webkit-font-smoothing: antialiased, as the app's AppleFontSmoothing 0 gives the other views.
        bitmap.setShouldSmoothFonts(false)
        let previous = NSGraphicsContext.current
        NSGraphicsContext.current = NSGraphicsContext(cgContext: bitmap, flipped: true)
        paint(band)
        NSGraphicsContext.current = previous
        bitmap.restoreGState()
        paintedOffset = offset
        layer?.contentsScale = scale
        layer?.contents = bitmap.makeImage()
    }

    /// Moves the bitmap's pixels up (a positive `pixels`, scrolling down) or down, and returns the whole rows moved;
    /// nil when the move is not a whole number of rows or leaves nothing to keep, so everything is painted.
    private func shift(_ bitmap: CGContext, by pixels: CGFloat) -> Int? {
        guard pixels == pixels.rounded(), abs(pixels) < CGFloat(bitmap.height), let data = bitmap.data else {
            return nil
        }
        let rows = Int(pixels), rowBytes = bitmap.bytesPerRow
        let kept = (bitmap.height - abs(rows)) * rowBytes
        if rows > 0 {
            memmove(data, data + rows * rowBytes, kept)
        } else if rows < 0 {
            memmove(data + -rows * rowBytes, data, kept)
        }
        return rows
    }

    /// Paints `dirtyRect` of the canvas whole: what lies there is the same whether the canvas is painted at once or
    /// band by band, as each row is drawn with what spills over from its neighbors (a glyph's tail, a changed word's
    /// box a point above its row, a chevron 4 points above).
    private func paint(_ dirtyRect: NSRect) {
        guard let content, let colors, let context = NSGraphicsContext.current?.cgContext else {
            return
        }
        paintBand = dirtyRect
        context.saveGState()
        dirtyRect.clip()
        colors.nsColor("--editor-bg").setFill()
        dirtyRect.fill()
        let paneWidth = self.paneWidth(content)
        let top = Double(offset + dirtyRect.minY)
        let bottom = Double(offset + dirtyRect.maxY)
        let layout = content.layout
        let panes = [
            Pane(rows: layout.left, index: content.left, x: 0, spans: content.leftSpans, marks: layout.leftMarks,
                 lineStarts: layout.leftLineStarts, guides: content.leftGuides, contentWidth: content.leftWidth),
            Pane(rows: layout.right, index: content.right, x: paneWidth + DiffPanes.gapWidth,
                 spans: content.rightSpans, marks: layout.rightMarks, lineStarts: layout.rightLineStarts,
                 guides: content.rightGuides, contentWidth: content.rightWidth, noteEnd: content.rightNoteEnd),
        ]
        for pane in panes {
            context.saveGState()
            NSRect(x: pane.x, y: dirtyRect.minY, width: paneWidth, height: dirtyRect.height).clip()
            for row in pane.index.visible(from: top - Self.spill, to: bottom + Self.spill) {
                let y = CGFloat(pane.index.tops[row]) - offset
                let previousTinted = row > 0 && DiffCanvas.isTinted(pane.rows[row - 1])
                drawRow(pane.rows[row], pane: pane, y: y, width: paneWidth, colors: colors, context: context,
                        previousTinted: previousTinted)
            }
            drawGuides(pane, top: top, bottom: bottom, colors: colors)
            drawScrollbar(pane, width: paneWidth, colors: colors)
            context.restoreGState()
        }
        drawRevertColumn(content, colors: colors, x: paneWidth, top: top, bottom: bottom)
        context.restoreGState()
    }

    /// How far a row's drawing reaches past its own 16 points: its glyphs' band (GlyphCompositor) and more.
    private static let spill = 24.0

    /// Half of what the revert column leaves, less the merge view's 10-point vertical scrollbar once the rows are
    /// taller than the view: the ruler hides that scrollbar, but it still takes its room from the panes.
    func paneWidth(_ content: Content) -> CGFloat {
        let rowsBottom = max(content.left.rowsBottom, content.right.rowsBottom)
        let scrolls = DiffPanes.editorHeight(rowsBottom: rowsBottom) > bounds.height
        return max(0, (bounds.width - DiffPanes.gapWidth - (scrolls ? DiffPanes.scrollbarHeight : 0)) / 2)
    }
}
