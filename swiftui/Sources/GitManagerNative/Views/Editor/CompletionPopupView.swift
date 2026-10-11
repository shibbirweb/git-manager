// The completion popup (.cm-tooltip-autocomplete, styled by features.ts completionTheme): --panel in a 1-point
// --border-strong ring with 6-point corners and the page's --shadow, the options in the code font, the selected one
// on --selected. Drawn into one bitmap (CompletionPopupRows.swift draws a row); its shadow is a layer of its own
// under it (ShadowLayerView), as WebKit composites the popup over the editor. A click on an option picks it; the
// wheel scrolls a long list.

import AppKit
import NativeCore

final class CompletionPopupView: NSView {
    struct Content {
        /// The rendered options (at most 100, around the selected one) and the index of the first in the list.
        var options: [CompletionOption]
        var first: Int
        var selected: Int
        var layout: CompletionPopupLayout
        var theme: Theme
        var markerTop: Bool
        var markerBottom: Bool

        /// True when `other` paints the same pixels.
        func drawsLike(_ other: Content) -> Bool {
            options == other.options && first == other.first && selected == other.selected
                && layout == other.layout && theme.id == other.theme.id && markerTop == other.markerTop
                && markerBottom == other.markerBottom
        }
    }

    var content: Content? {
        didSet {
            if content?.theme.id != colors?.theme.id {
                colors = content.map { CanvasColors(theme: $0.theme) }
            }
            if let content {
                // A new list starts at its top; a new selection scrolls just enough to show it.
                if content.options != oldValue?.options || content.first != oldValue?.first {
                    scrollTop = 0
                }
                if content.selected != oldValue?.selected || scrollTop == 0 {
                    scrollTop = content.layout.scrollTop(showing: content.selected - content.first, from: scrollTop)
                }
                scrollTop = min(scrollTop, content.layout.maxScrollTop)
            }
            needsDisplay = true
        }
    }

    /// The list's scroll offset.
    private(set) var scrollTop = 0.0
    var onPick: ((CompletionOption) -> Void)?

    let surface = CanvasSurface()
    /// The selected row's background, a layer under the bitmap (whose row is see-through there): filled by Core
    /// Animation it lands on the page's color, where a fill stored in the bitmap came out a step off.
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

    override var isFlipped: Bool {
        true
    }

    override var wantsUpdateLayer: Bool {
        true
    }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        needsDisplay = true
    }

    override func makeBackingLayer() -> CALayer {
        let layer = super.makeBackingLayer()
        selection.actions = CanvasSurface.noActions
        layer.addSublayer(selection)
        layer.addSublayer(surface.layer)
        return layer
    }

    override func updateLayer() {
        let scale = window?.backingScaleFactor ?? 2
        let width = Int((bounds.width * scale).rounded()), height = Int((bounds.height * scale).rounded())
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
        // Fills in device pixels, y down (the glyphs are blended into the pixels directly).
        context.saveGState()
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: 1, y: -1)
        drawFrame(context, colors: colors, scale: scale)
        drawList(content, context: context, colors: colors, scale: scale)
        context.restoreGState()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        let selected = selectedRect(content)
        selection.isHidden = selected == nil
        selection.frame = selected ?? .zero
        selection.backgroundColor = colors.theme.systemNSColor("--selected").cgColor
        surface.publish(frame: bounds, scale: scale)
        CATransaction.commit()
    }

    /// The border ring and the panel inside it, with the corners' antialiasing as Core Graphics draws it.
    private func drawFrame(_ context: CGContext, colors: CanvasColors, scale: CGFloat) {
        let radius = 6 * scale
        let outer = CGRect(x: 0, y: 0, width: bounds.width * scale, height: bounds.height * scale)
        context.saveGState()
        context.setFillColor(colors.nsColor("--border-strong").cgColor)
        context.addPath(CGPath(roundedRect: outer, cornerWidth: radius, cornerHeight: radius, transform: nil))
        context.fillPath()
        let inner = outer.insetBy(dx: scale, dy: scale)
        context.setFillColor(colors.nsColor("--panel").cgColor)
        context.addPath(CGPath(roundedRect: inner, cornerWidth: radius - scale, cornerHeight: radius - scale,
                               transform: nil))
        context.fillPath()
        context.restoreGState()
    }

    override func mouseDown(with event: NSEvent) {
        guard let content else {
            return
        }
        let point = convert(event.locationInWindow, from: nil)
        let border = CompletionPopupLayout.border
        guard Double(point.x) < border + content.layout.rowWidth,
              let row = content.layout.row(at: Double(point.y) - border + scrollTop),
              content.options.indices.contains(row) else {
            return
        }
        onPick?(content.options[row])
    }

    override func scrollWheel(with event: NSEvent) {
        guard let content, content.layout.overflows else {
            return
        }
        scrollTop = min(content.layout.maxScrollTop, max(0, scrollTop - Double(event.scrollingDeltaY)))
        needsDisplay = true
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
    }
}
