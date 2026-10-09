// A merge pane's scrollbar thumbs (app.css ::-webkit-scrollbar: 10-point tracks, the thumb 2 points in from each
// edge, color-mix(--text-dim 35%, transparent), fully rounded), each a layer over the pane as on the page.

import AppKit

extension MergePaneCanvas {
    /// The thumbs' length along a track: the visible share in whole points (WebKit sizes them so), at least 17
    /// (measured on a 2400-line file: 692 points of 38456 show a 17-point thumb).
    static func thumbLength(track: CGFloat, visible: CGFloat, total: CGFloat) -> CGFloat {
        min(track, max(17, (track * visible / max(total, 1)).rounded()))
    }

    func placeThumbs(_ content: Content, colors: CanvasColors, space: CGColorSpace, scale: CGFloat, force: Bool) {
        let bars = scrollbars
        if bars.horizontal {
            let width = clientWidth
            let length = Self.thumbLength(track: width, visible: width,
                                          total: content.gutterWidth + contentWidth)
            paint(thumb, size: CGSize(width: length, height: Self.scrollbar), colors: colors, space: space,
                  scale: scale, force: force)
            thumb.publish(frame: CGRect(x: 0, y: bounds.height - Self.scrollbar, width: length,
                                        height: Self.scrollbar), scale: scale)
        }
        thumb.layer.isHidden = !bars.horizontal
        if bars.vertical {
            let track = clientHeight
            let length = Self.thumbLength(track: track, visible: track, total: documentHeight)
            let range = max(1, documentHeight - track)
            let top = ((track - length) * min(1, max(0, offset / range))).rounded()
            paint(verticalThumb, size: CGSize(width: Self.scrollbar, height: length), colors: colors, space: space,
                  scale: scale, force: force)
            verticalThumb.publish(frame: CGRect(x: clientWidth, y: top, width: Self.scrollbar, height: length),
                                  scale: scale)
        }
        verticalThumb.layer.isHidden = !bars.vertical
    }

    private func paint(_ surface: CanvasSurface, size: CGSize, colors: CanvasColors, space: CGColorSpace,
                       scale: CGFloat, force: Bool) {
        let pixels = (width: Int((size.width * scale).rounded()), height: Int((size.height * scale).rounded()))
        guard surface.prepare(width: pixels.width, height: pixels.height, space: space) || force,
              let context = surface.context else {
            return
        }
        context.clear(CGRect(x: 0, y: 0, width: pixels.width, height: pixels.height))
        context.saveGState()
        context.scaleBy(x: scale, y: scale)
        let rect = CGRect(origin: .zero, size: size).insetBy(dx: 2, dy: 2)
        let radius = min(rect.width, rect.height) / 2
        context.setFillColor(colors.translucent("--text-dim", alpha: 0.35))
        context.addPath(CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil))
        context.fillPath()
        context.restoreGState()
    }
}
