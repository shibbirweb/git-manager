// The file canvas's layers (FileCanvas.swift says which): a scroll moves the pixels of the content layer and paints
// only the band that came into view; an edit or a selection change paints only the rows
// it touches (`dirtyRows`); the cursors and the thumbs are placed each time.

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
        var whole = paintedOffset == nil || dirtyRows == nil
        let surfaceWidth = Int((visibleWidth * scale).rounded())
        // A shorter view keeps its rows (the find bar opening); a taller one paints the rows it now shows.
        let shownBefore = surface.shownHeight
        if surface.prepare(width: surfaceWidth, height: height, space: space, keepTaller: true) {
            whole = true
        }
        var bands: [CGRect] = []
        if whole {
            bands = [bounds]
        } else if let paintedOffset {
            let moved = (offset - paintedOffset) * scale
            if moved != 0 && (moved != moved.rounded() || abs(moved) >= CGFloat(height)) {
                bands = [bounds]
            } else {
                if moved != 0 {
                    let rows = Int(moved)
                    surface.shift(rows: rows)
                    let exposed = CGFloat(abs(rows)) / scale
                    bands.append(rows > 0
                        ? CGRect(x: 0, y: CGFloat(height) / scale - exposed, width: bounds.width, height: exposed)
                        : CGRect(x: 0, y: 0, width: bounds.width, height: exposed))
                }
                bands += rowBands(content)
                if height > shownBefore {
                    let top = CGFloat(shownBefore) / scale
                    bands.append(CGRect(x: 0, y: top, width: bounds.width, height: bounds.height - top))
                }
            }
        }
        for band in bands {
            paint(band.intersection(bounds), content: content, scale: scale)
        }
        dirtyRows = IndexSet()
        dirtyBoxes = []
        paintedOffset = offset
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layer?.contentsScale = scale
        // The editor's background is one color: the layer's own, not a bitmap to fill, shift and publish.
        let background = colors?.nsColor("--editor-bg").cgColor
        if layer?.backgroundColor != background {
            layer?.backgroundColor = background
        }
        surface.publish(frame: CGRect(x: 0, y: 0, width: visibleWidth, height: bounds.height), scale: scale)
        placeCursors(content, space: space, scale: scale, repaint: whole)
        placeThumbs(content, space: space, scale: scale, repaint: whole)
        CATransaction.commit()
    }

    /// The dirty rows as bands of canvas points, and the dirty boxes as rectangles.
    private func rowBands(_ content: Content) -> [CGRect] {
        guard let dirtyRows else {
            return [bounds]
        }
        let height = CGFloat(EditorGeometry.lineHeight)
        // Rows at most two apart share a band: each band draws a row and a half of text around it anyway.
        var merged: [Range<Int>] = []
        for rows in dirtyRows.rangeView {
            if let last = merged.last, rows.lowerBound - last.upperBound <= 2 {
                merged[merged.count - 1] = last.lowerBound..<rows.upperBound
            } else {
                merged.append(rows)
            }
        }
        // Two points above and below: a selected find match's outline sits a point outside its 17-point box, which
        // starts a point above its row.
        let full = merged.map { rows in
            CGRect(x: 0, y: rowTop(rows.lowerBound) - 2, width: bounds.width, height: CGFloat(rows.count) * height + 4)
        }
        let textLeft = textX(content)
        let boxes = dirtyBoxes.filter { !dirtyRows.contains($0.row) }.map { box in
            CGRect(x: textLeft + box.from, y: rowTop(box.row) - 2, width: box.to - box.from, height: height + 4)
        }
        return (full + boxes).filter { $0.maxY > 0 && $0.minY < bounds.height }
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
        localClip(context, scale: scale).clip()
        draw()
        NSGraphicsContext.current = previous
        context.restoreGState()
    }

    private func paint(_ band: CGRect, content: Content, scale: CGFloat) {
        guard let colors, let context = surface.context, !band.isEmpty else {
            return
        }
        // Whole device pixels, so a band and its neighbour never paint the same pixel twice.
        let top = (band.minY * scale).rounded(.down) / scale, bottom = (band.maxY * scale).rounded(.up) / scale
        let left = (band.minX * scale).rounded(.down) / scale, right = (band.maxX * scale).rounded(.up) / scale
        paintBand = CGRect(x: left, y: top, width: right - left, height: bottom - top)
        withContext(context, scale: scale) {
            context.clear(localClip(context, scale: scale))
            drawContent(content, colors: colors, context: context, scale: scale)
            // A box inside the code (a find match) leaves the gutter as it is.
            if paintBand.minX < CGFloat(content.geometry.guttersWidth) {
                drawGutter(content, colors: colors, context: context, scale: scale)
            }
        }
    }

    /// The cursors (.cm-cursor): 2 points of --editor-cursor from a point above the row, 17 tall, centered on the
    /// position, one per range at its head, while the editor has the focus. Layers of their own, as the page
    /// animates them; "blink" shows them for the first half of each 1.2 s, restarted when one moves.
    private func placeCursors(_ content: Content, space: CGColorSpace, scale: CGFloat, repaint: Bool) {
        let heads = content.focused ? content.state.selection.ranges.map(\.head) : []
        while cursorSurfaces.count < heads.count {
            let made = CanvasSurface()
            layer?.insertSublayer(made.layer, below: thumbSurfaces[0].layer)
            cursorSurfaces.append(made)
        }
        let key = "\(content.path):\(heads)"
        let moved = blinkKey != key
        blinkKey = key
        for (index, cursorSurface) in cursorSurfaces.enumerated() {
            guard index < heads.count, let colors else {
                cursorSurface.layer.isHidden = true
                continue
            }
            let head = heads[index], row = row(of: head, content)
            let x = textX(content) + x(of: head, row: row, content) - 1
            guard x >= CGFloat(content.geometry.guttersWidth) - 1, x < visibleWidth else {
                cursorSurface.layer.isHidden = true
                continue
            }
            cursorSurface.layer.isHidden = false
            let made = cursorSurface.prepare(width: Int(2 * scale), height: Int(17 * scale), space: space)
            if made || repaint, let context = cursorSurface.context {
                context.setFillColor(colors.nsColor("--editor-cursor").cgColor)
                context.fill(CGRect(x: 0, y: 0, width: context.width, height: context.height))
            }
            cursorSurface.publish(frame: CGRect(x: x, y: rowTop(row) - 1, width: 2, height: 17), scale: scale)
            blink(cursorSurface.layer, restart: moved, blinking: content.blinking)
        }
    }

    private func blink(_ layer: CALayer, restart: Bool, blinking: String) {
        if blinking == "solid" {
            layer.removeAnimation(forKey: "blink")
            return
        }
        if restart || layer.animation(forKey: "blink") == nil {
            let blink = CAKeyframeAnimation(keyPath: "opacity")
            blink.values = [1, 0]
            blink.keyTimes = [0, 0.5]
            blink.calculationMode = .discrete
            blink.duration = 1.2
            blink.repeatCount = .infinity
            layer.removeAnimation(forKey: "blink")
            layer.add(blink, forKey: "blink")
        }
    }

    /// The scrollbars' thumbs (app.css ::-webkit-scrollbar-thumb): --text-dim at 35%, 2 points in from the 10-point
    /// track's edges, fully rounded; WebKit sizes them in whole points.
    private func placeThumbs(_ content: Content, space: CGColorSpace, scale: CGFloat, repaint: Bool) {
        let geometry = content.geometry
        let size = CGFloat(EditorGeometry.scrollbarSize)
        let vertical = EditorGeometry.thumb(
            track: Double(visibleHeight), visible: Double(bounds.height),
            total: geometry.documentHeight(viewport: Double(bounds.height)), offset: Double(offset)
        )
        place(thumbSurfaces[0], thumb: vertical, space: space, scale: scale, repaint: repaint) { start, length in
            CGRect(x: self.bounds.width - size, y: start, width: size, height: length)
        }
        let scrollWidth = Double(geometry.guttersWidth) + max(geometry.contentWidth, Double(noteEnd(content)))
        let horizontal = EditorGeometry.thumb(
            track: Double(visibleWidth), visible: Double(visibleWidth), total: scrollWidth, offset: Double(offsetX)
        )
        place(thumbSurfaces[1], thumb: horizontal, space: space, scale: scale, repaint: repaint) { start, length in
            CGRect(x: start, y: self.bounds.height - size, width: length, height: size)
        }
    }

    private func place(
        _ thumbSurface: CanvasSurface, thumb: (start: Double, length: Double)?, space: CGColorSpace, scale: CGFloat,
        repaint: Bool, frame: (CGFloat, CGFloat) -> CGRect
    ) {
        guard let thumb, let colors else {
            thumbSurface.layer.isHidden = true
            return
        }
        thumbSurface.layer.isHidden = false
        let rect = frame(CGFloat(thumb.start), CGFloat(thumb.length))
        let pixels = (width: Int((rect.width * scale).rounded()), height: Int((rect.height * scale).rounded()))
        if thumbSurface.prepare(width: pixels.width, height: pixels.height, space: space) || repaint,
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
