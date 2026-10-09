// Find in Files' result list drawn in one view (src/lib/search/TextResult.svelte rows in the .list): building a
// SwiftUI view per row cost 20 to 34 ms before the first results showed, where WebKit takes a few. The rows go into
// one see-through bitmap, as the page's scrolled list is a layer of its own over the popup's background: the
// matches' boxes and the text blended as WebKit blends them (CanvasSurface, GlyphCompositor), the file icon
// stroked. The selected row's background is a layer under it. ResultsCanvasRows.swift draws a row;
// TextResultsList puts the canvas in SwiftUI.

import AppKit
import NativeCore

final class ResultsCanvas: NSView {
    struct Content {
        var rows: [TextRow]
        var selected: Int
        var scrollTop: Double
        var theme: Theme
        /// The list scrolls: its thumb takes 10 points from the rows.
        var overflows: Bool
        /// A line's text room (ResultText.ellipsized).
        var textWidth: CGFloat
    }

    static let paddingTop: CGFloat = 2
    static let paddingSide: CGFloat = 4

    var content: Content? {
        didSet {
            if content?.theme.id != colors?.theme.id {
                colors = content.map { CanvasColors(theme: $0.theme) }
            }
            needsDisplay = true
        }
    }

    /// The rows' right edge: the list's padding (and the scrollbar's room) in from the canvas's.
    var rowsRight: CGFloat {
        bounds.width - Self.paddingSide - (content?.overflows == true ? 10 : 0)
    }

    var onActivate: ((Int) -> Void)?
    var onScroll: ((Double) -> Void)?

    let surface = CanvasSurface()
    /// The selected row's background, a layer under the rows' bitmap: filled by Core Animation, as SwiftUI filled it,
    /// it lands on the page's color, where a fill stored in the bitmap came out a step off.
    let selection = CALayer()
    let glyphs = GlyphCompositor()
    private(set) var colors: CanvasColors?

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layerContentsRedrawPolicy = .onSetNeedsDisplay
    }

    required init?(coder: NSCoder) {
        nil
    }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        needsDisplay = true
    }

    override var isFlipped: Bool {
        true
    }

    override var wantsUpdateLayer: Bool {
        true
    }

    override func makeBackingLayer() -> CALayer {
        let layer = super.makeBackingLayer()
        selection.actions = CanvasSurface.noActions
        selection.cornerRadius = 4
        layer.addSublayer(selection)
        layer.addSublayer(surface.layer)
        return layer
    }

    override func updateLayer() {
        let scale = window?.backingScaleFactor ?? 2
        let width = Int((bounds.width * scale).rounded())
        let height = Int((bounds.height * scale).rounded())
        guard let content, let colors, width > 0, height > 0,
              let space = window?.colorSpace?.cgColorSpace ?? CGColorSpace(name: CGColorSpace.displayP3) else {
            surface.layer.contents = nil
            return
        }
        _ = surface.prepare(width: width, height: height, space: space)
        guard let context = surface.context else {
            return
        }
        context.clear(CGRect(x: 0, y: 0, width: width, height: height))
        let range = PopupRows.visibleRange(
            scrollTop: content.scrollTop, viewportHeight: Double(bounds.height),
            rowHeight: ResultRowLayout.rowHeight, count: content.rows.count
        )
        let origin = globalOrigin()
        for index in range {
            let top = Self.paddingTop + CGFloat(Double(index) * ResultRowLayout.rowHeight - content.scrollTop)
            drawRow(content.rows[index], selected: index == content.selected, top: top, content: content,
                    colors: colors, context: context, scale: scale, origin: origin)
        }
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        placeSelection(content, colors: colors)
        surface.publish(frame: bounds, scale: scale)
        CATransaction.commit()
    }

    private func placeSelection(_ content: Content, colors: CanvasColors) {
        guard content.rows.indices.contains(content.selected) else {
            selection.isHidden = true
            return
        }
        let top = Self.paddingTop + CGFloat(Double(content.selected) * ResultRowLayout.rowHeight - content.scrollTop)
        selection.isHidden = false
        selection.backgroundColor = colors.theme.systemNSColor("--selected").cgColor
        selection.frame = CGRect(x: Self.paddingSide, y: top, width: rowsRight - Self.paddingSide,
                                 height: CGFloat(ResultRowLayout.rowHeight))
    }

    /// The canvas's top left in the window's content, y down (SwiftUI's global space), for icons that snap there.
    private func globalOrigin() -> CGPoint {
        guard let contentView = window?.contentView else {
            return .zero
        }
        let point = convert(CGPoint.zero, to: contentView)
        return contentView.isFlipped ? point : CGPoint(x: point.x, y: contentView.bounds.height - point.y)
    }

    override func mouseDown(with event: NSEvent) {
        guard let content else {
            return
        }
        let point = convert(event.locationInWindow, from: nil)
        if let index = ResultRowLayout.row(at: Double(point.y), scrollTop: content.scrollTop,
                                           paddingTop: Double(Self.paddingTop), count: content.rows.count) {
            onActivate?(index)
        }
    }

    override func scrollWheel(with event: NSEvent) {
        let delta = event.hasPreciseScrollingDeltas ? event.scrollingDeltaY : event.scrollingDeltaY * 16
        onScroll?(Double(delta))
    }
}
