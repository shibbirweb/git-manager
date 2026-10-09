// One editor of the merge tool (a CodeMirror view in MergeEditor.svelte), drawn like the diff canvas: only the rows
// on screen, as the page's layers. The view's own bitmap is the editor background; a see-through content layer holds
// the chunk tints and edges, the active line, the changed words, the code and the indent guides, with the opaque
// gutter of line numbers over it; the horizontal scrollbar thumb is a layer of its own. The overview ruler is a
// SwiftUI strip over the right edge (MergePaneView).

import AppKit
import NativeCore

final class MergePaneCanvas: NSView {
    struct Content {
        var lines: [String]
        var index: RowIndex
        var styles: [Int: MergeLineStyle]
        var spans: SyntaxColors?
        var lineStarts: [Int]
        var guides: [IndentGuides.Run]
        /// The cursor's line (the result pane): the active-line color in the line and the gutter.
        var activeLine: Int?
        /// The word around the pane's cursor, marked wherever it stands alone (WordMatches).
        var matchWord: String?
        /// Each line's length in UTF-16 units: the content is as wide as the widest line CodeMirror has drawn.
        var lineLengths: [Int]
        /// The line numbers' gutter: 12 and 10 points of padding around the longest number, at least 40.
        var gutterWidth: CGFloat
        var theme: Theme

        func drawsLike(_ other: Content) -> Bool {
            lines == other.lines && styles == other.styles && spans == other.spans && activeLine == other.activeLine
                && matchWord == other.matchWord && theme.id == other.theme.id
        }
    }

    static let lineHeight: CGFloat = 16
    static let padding: CGFloat = 4
    static let minGutterWidth: CGFloat = 40
    /// The scroll markers' strip on the right (the scroller's 12-point right margin).
    static let stripWidth: CGFloat = 12
    static let scrollbar: CGFloat = 10
    static let spill = 24.0

    var content: Content? {
        didSet {
            if let content, let oldValue, content.drawsLike(oldValue) {
                return
            }
            if content?.lineLengths != oldValue?.lineLengths {
                // Measured again at the next layout, where the pane stands then.
                measured = nil
            }
            if content?.theme.id != colors?.theme.id {
                colors = content.map { CanvasColors(theme: $0.theme) }
            }
            paintedOffset = nil
            needsDisplay = true
        }
    }

    var offset: CGFloat = 0 {
        didSet {
            if offset != oldValue {
                if measured != nil {
                    measureWidth()
                }
                needsDisplay = true
                // The lines drawn decide the content's width, so a scroll can show or hide the scrollbar.
                if scrollbars.horizontal != shownScrollbars.horizontal {
                    superview?.needsLayout = true
                }
            }
        }
    }

    let base = CanvasSurface()
    let surface = CanvasSurface()
    let thumb = CanvasSurface()
    let verticalThumb = CanvasSurface()
    var paintedOffset: CGFloat?
    /// The widest measured line's length and the lines it was measured in (contentWidth).
    var measured: (width: Int, first: Int, last: Int)?
    /// The scrollbars the last layout gave room to.
    var shownScrollbars = (vertical: false, horizontal: false)
    private(set) var colors: CanvasColors?
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
        layer.addSublayer(surface.layer)
        layer.addSublayer(thumb.layer)
        layer.addSublayer(verticalThumb.layer)
        return layer
    }

    override var isFlipped: Bool {
        true
    }

    override var wantsUpdateLayer: Bool {
        true
    }

    override func updateLayer() {
        DrawStats.measure {
            paintLayers()
        }
    }

    /// The scroller's width: the pane less the ruler strip.
    var scrollerWidth: CGFloat {
        max(0, bounds.width - Self.stripWidth)
    }

    /// The document's height: the rows and CodeMirror's padding above and below.
    var documentHeight: CGFloat {
        CGFloat(content?.index.rowsBottom ?? 0) + Self.padding
    }

    /// How far CodeMirror draws lines beyond the viewport (its viewport margin, 1000 pixels each way).
    static let renderMargin: CGFloat = 1000

    /// The content's width: the widest line CodeMirror has measured in the lines it draws (the viewport and its
    /// margin), plus the line padding, 6 on the left and 2 on the right. Like CodeMirror's minWidth it keeps that
    /// width while the drawn lines still overlap the ones it was measured in, so a long line near the top keeps the
    /// horizontal scrollbar after a scroll down the file.
    var contentWidth: CGFloat {
        CGFloat(measured?.width ?? 0) * CodeLineText.advance + 8
    }

    /// Measures the lines drawn at the current offset into `measured`.
    func measureWidth() {
        guard let content, !content.lineLengths.isEmpty else {
            measured = nil
            return
        }
        let count = content.lineLengths.count
        let first = min(count, max(0, Int(((offset - Self.renderMargin - Self.padding) / Self.lineHeight)
            .rounded(.down))))
        let last = min(count, Int(((offset + bounds.height + Self.renderMargin) / Self.lineHeight).rounded(.up)) + 1)
        var widest = 0
        for index in first..<max(first, last) {
            widest = max(widest, content.lineLengths[index])
        }
        if let measured, measured.first < last, measured.last > first, measured.width >= widest {
            return
        }
        measured = (widest, first, last)
    }

    /// Which scrollbars the scroller shows: a vertical one when the document is taller than the room, a horizontal
    /// one when the content is wider; each takes 10 points from the other's room, as WebKit lays out classic bars.
    var scrollbars: (vertical: Bool, horizontal: Bool) {
        guard let content else {
            return (false, false)
        }
        let width = content.gutterWidth + contentWidth
        var vertical = documentHeight > bounds.height + 0.5
        let horizontal = width > scrollerWidth - (vertical ? Self.scrollbar : 0) + 0.5
        if horizontal && !vertical {
            vertical = documentHeight > bounds.height - Self.scrollbar + 0.5
        }
        return (vertical, horizontal)
    }

    var scrollsSideways: Bool {
        scrollbars.horizontal
    }

    /// The width the content shows: the scroller less the vertical scrollbar when there is one.
    var clientWidth: CGFloat {
        scrollerWidth - (scrollbars.vertical ? Self.scrollbar : 0)
    }

    /// The height the rows can show: the pane less the horizontal scrollbar when there is one.
    var clientHeight: CGFloat {
        bounds.height - (scrollbars.horizontal ? Self.scrollbar : 0)
    }

    private func paintLayers() {
        let scale = window?.backingScaleFactor ?? 2
        let width = Int((bounds.width * scale).rounded()), height = Int((bounds.height * scale).rounded())
        guard let content, let colors, width > 0, height > 0,
              let space = window?.colorSpace?.cgColorSpace ?? CGColorSpace(name: CGColorSpace.displayP3) else {
            layer?.contents = nil
            return
        }
        var whole = paintedOffset == nil
        if base.prepare(width: width, height: height, space: space) {
            whole = true
        }
        let surfaceWidth = Int((clientWidth * scale).rounded())
        if surface.prepare(width: surfaceWidth, height: height, space: space) {
            whole = true
        }
        var band = bounds
        if !whole, let paintedOffset {
            let moved = (offset - paintedOffset) * scale
            if moved == 0 {
                return
            }
            if moved == moved.rounded(), abs(moved) < CGFloat(height) {
                let rows = Int(moved)
                base.shift(rows: rows)
                surface.shift(rows: rows)
                // Nothing of the rows may move under the horizontal scrollbar's track.
                let track = Int(((bounds.height - clientHeight) * scale).rounded())
                surface.context?.clear(CGRect(x: 0, y: 0, width: surface.context?.width ?? 0, height: track))
                let exposed = CGFloat(abs(rows)) / scale
                band = rows > 0
                    ? CGRect(x: 0, y: CGFloat(height) / scale - exposed, width: bounds.width, height: exposed)
                    : CGRect(x: 0, y: 0, width: bounds.width, height: exposed)
            }
        }
        paint(band, content: content, colors: colors, scale: scale)
        paintedOffset = offset
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layer?.contentsScale = scale
        layer?.contents = base.context?.makeImage()
        surface.publish(frame: CGRect(x: 0, y: 0, width: CGFloat(surfaceWidth) / scale, height: bounds.height),
                        scale: scale)
        placeThumbs(content, colors: colors, space: space, scale: scale, force: band == bounds)
        CATransaction.commit()
    }

    private func paint(_ band: CGRect, content: Content, colors: CanvasColors, scale: CGFloat) {
        guard let baseContext = base.context, let context = surface.context else {
            return
        }
        paintBand = band
        withContext(baseContext, scale: scale) {
            colors.nsColor("--editor-bg").setFill()
            band.fill()
        }
        withContext(context, scale: scale) {
            context.clear(band)
        }
        // The scrollbars' tracks show the editor's background: rows stop at the client area.
        paintBand = band.intersection(CGRect(x: 0, y: 0, width: clientWidth, height: clientHeight))
        if paintBand.isNull {
            return
        }
        withContext(context, scale: scale) {
            drawRows(content, top: Double(offset + band.minY), bottom: Double(offset + band.maxY), colors: colors,
                     context: context, scale: scale)
        }
    }

    /// Runs `draw` with `context` current, in canvas points (y down), clipped to the paint band.
    func withContext(_ context: CGContext, scale: CGFloat, _ draw: () -> Void) {
        context.saveGState()
        context.translateBy(x: 0, y: CGFloat(context.height))
        context.scaleBy(x: scale, y: -scale)
        context.setShouldSmoothFonts(false)
        let previous = NSGraphicsContext.current
        NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: true)
        NSRect(x: 0, y: paintBand.minY, width: CGFloat(context.width) / scale, height: paintBand.height).clip()
        draw()
        NSGraphicsContext.current = previous
        context.restoreGState()
    }
}
