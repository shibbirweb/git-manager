// Draws what is on screen of a side-by-side diff, and nothing else: one view the size of the viewport that paints
// the rows crossing it from the scroll offset (RowIndex), so memory stays the same however long the file is or
// however far it scrolls. The look is measured from the current app (DiffPanes.swift has the sizes).
// The pixels are layers as the current app's page has them (CanvasSurface.swift): the view's own bitmap holds what
// lies under the editors' content (the background, the gutters, the revert column), each pane has a see-through
// content layer over it, and each pane's scrollbar thumb is a layer of its own (DiffCanvasLayers.swift).

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
        /// Where the pane's content layer starts, in canvas points: glyphs are written into that layer's pixels.
        var surfaceX: CGFloat = 0
    }

    var content: Content? {
        didSet {
            if let content, let oldValue, content.drawsLike(oldValue) {
                return
            }
            if content?.theme.id != colors?.theme.id {
                colors = content.map { CanvasColors(theme: $0.theme) }
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

    /// What lies under the panes' content: the view's own layer shows it.
    let base = CanvasSurface()
    /// Each pane's content layer (WebKit's .cm-content layer), see-through where nothing is painted.
    let paneSurfaces = [CanvasSurface(), CanvasSurface()]
    /// Each pane's horizontal scrollbar thumb, a layer over the pane as on the page.
    let thumbSurfaces = [CanvasSurface(), CanvasSurface()]
    /// The offset the bitmaps show, so a scroll moves those pixels and paints only the rows that came into view;
    /// nil when they must be painted whole.
    var paintedOffset: CGFloat?
    private(set) var colors: CanvasColors?
    /// The part of the canvas being painted: glyphs, which GlyphCompositor writes straight into the pixels, stay in it.
    var paintBand = CGRect.zero
    let glyphs = GlyphCompositor()

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layerContentsRedrawPolicy = .onSetNeedsDisplay
    }

    required init?(coder: NSCoder) {
        nil
    }

    override func makeBackingLayer() -> CALayer {
        let layer = super.makeBackingLayer()
        for surface in paneSurfaces + thumbSurfaces {
            layer.addSublayer(surface.layer)
        }
        return layer
    }

    override var isFlipped: Bool {
        true
    }

    let foldFont = NSFont.systemFont(ofSize: 11.5)

    override var wantsUpdateLayer: Bool {
        true
    }

    /// Paints into bitmaps in the window's color space and hands the layers the images: AppKit's own backing store
    /// converted every color one step off, while these values pass through unchanged, as they do for SwiftUI's
    /// fills. In any other space (Display P3 at first) Core Animation converted the whole image on every frame.
    override func updateLayer() {
        DrawStats.measure {
            paintLayers()
        }
    }

    /// Paints `band` of the canvas whole: what lies there is the same whether the canvas is painted at once or band
    /// by band, as each row is drawn with what spills over from its neighbors (a glyph's tail, a changed word's box a
    /// point above its row, a chevron 4 points above).
    func paint(_ band: NSRect, scale: CGFloat) {
        guard let content, let colors, let baseContext = base.context else {
            return
        }
        paintBand = band
        let paneWidth = self.paneWidth(content)
        let top = Double(offset + band.minY)
        let bottom = Double(offset + band.maxY)
        let panes = self.panes(content, paneWidth: paneWidth, scale: scale)
        withContext(baseContext, scale: scale, originX: 0) {
            colors.nsColor("--editor-bg").setFill()
            band.fill()
            drawRevertColumn(content, colors: colors, x: paneWidth, top: top, bottom: bottom)
        }
        for (pane, surface) in zip(panes, paneSurfaces) {
            guard let context = surface.context else {
                continue
            }
            withContext(context, scale: scale, originX: pane.surfaceX) {
                context.clear(band)
                drawContent(pane, top: top, bottom: bottom, width: paneWidth, colors: colors, context: context,
                            scale: scale)
            }
        }
    }

    /// Runs `draw` with `context` as the current graphics context, in canvas points (y down) shifted so `originX`
    /// is the bitmap's left edge, and clipped to the paint band.
    private func withContext(_ context: CGContext, scale: CGFloat, originX: CGFloat, _ draw: () -> Void) {
        context.saveGState()
        context.translateBy(x: 0, y: CGFloat(context.height))
        context.scaleBy(x: scale, y: -scale)
        context.translateBy(x: -originX, y: 0)
        // The page's -webkit-font-smoothing: antialiased, as the app's AppleFontSmoothing 0 gives the other views.
        context.setShouldSmoothFonts(false)
        let previous = NSGraphicsContext.current
        NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: true)
        NSRect(x: originX, y: paintBand.minY, width: CGFloat(context.width) / scale, height: paintBand.height).clip()
        draw()
        NSGraphicsContext.current = previous
        context.restoreGState()
    }

    func panes(_ content: Content, paneWidth: CGFloat, scale: CGFloat) -> [Pane] {
        let layout = content.layout
        let rightX = paneWidth + DiffPanes.gapWidth
        return [
            Pane(rows: layout.left, index: content.left, x: 0, spans: content.leftSpans, marks: layout.leftMarks,
                 lineStarts: layout.leftLineStarts, guides: content.leftGuides, contentWidth: content.leftWidth),
            Pane(rows: layout.right, index: content.right, x: rightX, spans: content.rightSpans,
                 marks: layout.rightMarks, lineStarts: layout.rightLineStarts, guides: content.rightGuides,
                 contentWidth: content.rightWidth, noteEnd: content.rightNoteEnd,
                 surfaceX: (rightX * scale).rounded(.down) / scale),
        ]
    }

    /// How far a row's drawing reaches past its own 16 points: its glyphs' band (GlyphCompositor) and more.
    static let spill = 24.0

    /// Half of what the revert column leaves, less the merge view's 10-point vertical scrollbar once the rows are
    /// taller than the view: the ruler hides that scrollbar, but it still takes its room from the panes.
    func paneWidth(_ content: Content) -> CGFloat {
        let scrolls = mergeViewScrolls(content)
        return max(0, (bounds.width - DiffPanes.gapWidth - (scrolls ? DiffPanes.scrollbarHeight : 0)) / 2)
    }

    /// Whether the rows are taller than the view, so the merge view scrolls.
    func mergeViewScrolls(_ content: Content) -> Bool {
        let rowsBottom = max(content.left.rowsBottom, content.right.rowsBottom)
        return DiffPanes.editorHeight(rowsBottom: rowsBottom) > bounds.height
    }
}
