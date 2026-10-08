// The diff canvas's layers (CanvasSurface.swift says why): the view's bitmap, and each pane's content layer and
// scrollbar thumb. A scroll moves the pixels of every bitmap and paints only the band that came into view.

import AppKit
import NativeCore

extension DiffCanvas {
    func paintLayers() {
        let scale = window?.backingScaleFactor ?? 2
        let width = Int((bounds.width * scale).rounded())
        let height = Int((bounds.height * scale).rounded())
        let windowSpace = window?.colorSpace?.cgColorSpace
        guard let content, colors != nil, width > 0, height > 0,
              let space = windowSpace ?? CGColorSpace(name: CGColorSpace.displayP3) else {
            layer?.contents = nil
            return
        }
        let paneWidth = self.paneWidth(content)
        let panes = self.panes(content, paneWidth: paneWidth, scale: scale)
        var whole = paintedOffset == nil
        if base.prepare(width: width, height: height, space: space) {
            whole = true
        }
        for (pane, surface) in zip(panes, paneSurfaces) {
            let right = ((pane.x + paneWidth) * scale).rounded(.up)
            if surface.prepare(width: Int(right - pane.surfaceX * scale), height: height, space: space) {
                whole = true
            }
        }
        var band = bounds
        if !whole, let paintedOffset {
            let moved = (offset - paintedOffset) * scale
            if moved == 0 {
                return
            }
            if moved == moved.rounded(), abs(moved) < CGFloat(height) {
                let rows = Int(moved)
                for surface in [base] + paneSurfaces {
                    surface.shift(rows: rows)
                }
                // Rows of pixels, not points, so the band's edges are the edges of what moved.
                let exposed = CGFloat(abs(rows)) / scale
                band = rows > 0
                    ? CGRect(x: 0, y: CGFloat(height) / scale - exposed, width: bounds.width, height: exposed)
                    : CGRect(x: 0, y: 0, width: bounds.width, height: exposed)
            }
        }
        paint(band, scale: scale)
        paintedOffset = offset
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layer?.contentsScale = scale
        layer?.contents = base.context?.makeImage()
        for (pane, surface) in zip(panes, paneSurfaces) {
            let surfaceWidth = CGFloat(surface.context?.width ?? 0) / scale
            surface.publish(
                frame: layerFrame(CGRect(x: pane.surfaceX, y: 0, width: surfaceWidth, height: bounds.height)),
                scale: scale
            )
        }
        for (pane, surface) in zip(panes, thumbSurfaces) {
            placeThumb(pane, width: paneWidth, surface: surface, space: space, scale: scale)
        }
        CATransaction.commit()
    }

    /// A rectangle in the view's points (y down) as a frame for a sublayer of the view's layer: AppKit flips the
    /// backing layer of a flipped view for its sublayers too, so the view's coordinates hold.
    func layerFrame(_ rect: CGRect) -> CGRect {
        rect
    }

    /// The pane's horizontal scrollbar thumb: as long as the visible share of the content, 2 points in from each
    /// edge of its 10-point track, at the start (the panes do not scroll sideways yet). The content reaches to its
    /// widest line or to the blame note, whichever ends further right. Its own layer over the pane, as on the page,
    /// so macOS composites it over the gutter and the code.
    private func placeThumb(_ pane: Pane, width: CGFloat, surface: CanvasSurface, space: CGColorSpace,
                            scale: CGFloat) {
        let scrollWidth = DiffPanes.gutterWidth + DiffPanes.markerWidth + max(pane.contentWidth, pane.noteEnd)
        guard scrollWidth > width + 0.5, let colors else {
            surface.layer.isHidden = true
            return
        }
        surface.layer.isHidden = false
        // WebKit sizes the thumb in whole points.
        let length = (width * width / scrollWidth).rounded()
        let pixels = (width: Int((length * scale).rounded()), height: Int(DiffPanes.scrollbarHeight * scale))
        if surface.prepare(width: pixels.width, height: pixels.height, space: space) || paintBand == bounds,
           let context = surface.context {
            context.clear(CGRect(x: 0, y: 0, width: pixels.width, height: pixels.height))
            context.saveGState()
            context.scaleBy(x: scale, y: scale)
            let rect = CGRect(x: 2, y: 2, width: length - 4, height: DiffPanes.scrollbarHeight - 4)
            context.setFillColor(colors.translucent("--text-dim", alpha: 0.35))
            context.addPath(CGPath(roundedRect: rect, cornerWidth: rect.height / 2, cornerHeight: rect.height / 2,
                                   transform: nil))
            context.fillPath()
            context.restoreGState()
        }
        let trackTop = DiffPanes.editorHeight(rowsBottom: pane.index.rowsBottom) - DiffPanes.scrollbarHeight - offset
        surface.publish(
            frame: layerFrame(CGRect(x: pane.x, y: trackTop, width: length, height: DiffPanes.scrollbarHeight)),
            scale: scale
        )
    }
}
