// The file canvas's layers (FileCanvas.swift says which): a scroll moves the pixels of the view's bitmap and the
// content layer and paints only the band that came into view; the cursor and the thumbs are placed each time.

import AppKit
import NativeCore

extension FileCanvas {
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
        var whole = paintedOffset == nil
        if base.prepare(width: width, height: height, space: space) {
            whole = true
        }
        let surfaceWidth = Int((visibleWidth * scale).rounded())
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
                let exposed = CGFloat(abs(rows)) / scale
                band = rows > 0
                    ? CGRect(x: 0, y: CGFloat(height) / scale - exposed, width: bounds.width, height: exposed)
                    : CGRect(x: 0, y: 0, width: bounds.width, height: exposed)
            }
        }
        paint(band, content: content, scale: scale)
        paintedOffset = offset
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layer?.contentsScale = scale
        layer?.contents = base.context?.makeImage()
        surface.publish(frame: CGRect(x: 0, y: 0, width: visibleWidth, height: bounds.height), scale: scale)
        placeCursor(content, space: space, scale: scale)
        placeThumbs(content, space: space, scale: scale)
        CATransaction.commit()
    }

    /// Runs `draw` with `context` as the current graphics context, in canvas points (y down), clipped to the band.
    func withContext(_ context: CGContext, scale: CGFloat, _ draw: () -> Void) {
        context.saveGState()
        context.translateBy(x: 0, y: CGFloat(context.height))
        context.scaleBy(x: scale, y: -scale)
        // The page's -webkit-font-smoothing: antialiased, as the app's AppleFontSmoothing 0 gives the other views.
        context.setShouldSmoothFonts(false)
        let previous = NSGraphicsContext.current
        NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: true)
        NSRect(x: 0, y: paintBand.minY, width: CGFloat(context.width) / scale, height: paintBand.height).clip()
        draw()
        NSGraphicsContext.current = previous
        context.restoreGState()
    }

    private func paint(_ band: CGRect, content: Content, scale: CGFloat) {
        guard let colors, let baseContext = base.context, let context = surface.context else {
            return
        }
        paintBand = band
        withContext(baseContext, scale: scale) {
            colors.nsColor("--editor-bg").setFill()
            band.fill()
        }
        withContext(context, scale: scale) {
            // In canvas points: the context's transform is set.
            context.clear(CGRect(x: 0, y: band.minY, width: CGFloat(context.width) / scale, height: band.height))
            drawContent(content, colors: colors, context: context, scale: scale)
            drawGutter(content, colors: colors, context: context, scale: scale)
        }
    }

    /// The cursor (.cm-cursor): 2 points of --editor-cursor from a point above the line, 17 tall, centered on the
    /// column's left edge. Its own layer, as the page animates it.
    private func placeCursor(_ content: Content, space: CGColorSpace, scale: CGFloat) {
        let x = textX(content) + CGFloat(content.cursor.column) * CodeLineText.advance - 1
        let top = lineTop(content.cursor.line) - 1
        guard let colors, x >= CGFloat(content.geometry.guttersWidth) - 1, x < visibleWidth else {
            cursorSurface.layer.isHidden = true
            return
        }
        cursorSurface.layer.isHidden = false
        // A whole paint (a new file or theme) paints it again.
        let made = cursorSurface.prepare(width: Int(2 * scale), height: Int(17 * scale), space: space)
        if made || paintBand == bounds,
           let context = cursorSurface.context {
            context.setFillColor(colors.nsColor("--editor-cursor").cgColor)
            context.fill(CGRect(x: 0, y: 0, width: context.width, height: context.height))
        }
        let frame = CGRect(x: x, y: top, width: 2, height: 17)
        let key = "\(content.file.path):\(content.cursor.line):\(content.cursor.column)"
        let moved = blinkKey != key
        blinkKey = key
        cursorSurface.publish(frame: frame, scale: scale)
        // cursor.ts's "blink": shown for the first half of each 1.2 s, restarted when the cursor moves.
        if moved || cursorSurface.layer.animation(forKey: "blink") == nil {
            let blink = CAKeyframeAnimation(keyPath: "opacity")
            blink.values = [1, 0]
            blink.keyTimes = [0, 0.5]
            blink.calculationMode = .discrete
            blink.duration = 1.2
            blink.repeatCount = .infinity
            cursorSurface.layer.removeAnimation(forKey: "blink")
            cursorSurface.layer.add(blink, forKey: "blink")
        }
    }

    /// The scrollbars' thumbs (app.css ::-webkit-scrollbar-thumb): --text-dim at 35%, 2 points in from the 10-point
    /// track's edges, fully rounded; WebKit sizes them in whole points.
    private func placeThumbs(_ content: Content, space: CGColorSpace, scale: CGFloat) {
        let geometry = content.geometry
        let size = CGFloat(EditorGeometry.scrollbarSize)
        let vertical = EditorGeometry.thumb(
            track: Double(visibleHeight), visible: Double(bounds.height),
            total: geometry.documentHeight(viewport: Double(bounds.height)), offset: Double(offset)
        )
        place(thumbSurfaces[0], thumb: vertical, space: space, scale: scale) { start, length in
            CGRect(x: self.bounds.width - size, y: start, width: size, height: length)
        }
        let scrollWidth = Double(geometry.guttersWidth) + max(geometry.contentWidth, Double(noteEnd(content)))
        let horizontal = EditorGeometry.thumb(
            track: Double(visibleWidth), visible: Double(visibleWidth), total: scrollWidth, offset: Double(offsetX)
        )
        place(thumbSurfaces[1], thumb: horizontal, space: space, scale: scale) { start, length in
            CGRect(x: start, y: self.bounds.height - size, width: length, height: size)
        }
    }

    private func place(
        _ thumbSurface: CanvasSurface, thumb: (start: Double, length: Double)?, space: CGColorSpace, scale: CGFloat,
        frame: (CGFloat, CGFloat) -> CGRect
    ) {
        guard let thumb, let colors else {
            thumbSurface.layer.isHidden = true
            return
        }
        thumbSurface.layer.isHidden = false
        let rect = frame(CGFloat(thumb.start), CGFloat(thumb.length))
        let pixels = (width: Int((rect.width * scale).rounded()), height: Int((rect.height * scale).rounded()))
        if thumbSurface.prepare(width: pixels.width, height: pixels.height, space: space) || paintBand == bounds,
           let context = thumbSurface.context {
            context.clear(CGRect(x: 0, y: 0, width: pixels.width, height: pixels.height))
            context.saveGState()
            context.scaleBy(x: scale, y: scale)
            let inner = CGRect(origin: .zero, size: rect.size).insetBy(dx: 2, dy: 2)
            let radius = min(inner.width, inner.height) / 2
            context.setFillColor(colors.translucent("--text-dim", alpha: 0.35))
            context.addPath(CGPath(roundedRect: inner, cornerWidth: radius, cornerHeight: radius, transform: nil))
            context.fillPath()
            context.restoreGState()
        }
        thumbSurface.publish(frame: rect, scale: scale)
    }
}
