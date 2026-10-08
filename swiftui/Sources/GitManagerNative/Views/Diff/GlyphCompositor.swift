// Text blended into the diff canvas the way the page blends it, measured against WebKit with a test page (each ink
// on its background, with white-on-black rows for the coverage). Glyph coverage is the same 8-bit mask in both
// apps, but WebKit blends with the text color's exact converted value (not its rounded bytes) on the GPU, in half
// precision. Code text is drawn into its editor's see-through content layer (CanvasSurface.swift) over what that
// layer holds there (a line's tint, a changed word's box, a fold bar, or nothing) and stored in 8 bits; macOS then
// composites the layer. The gutter's line numbers blend straight onto its opaque background. So a line is drawn
// into a 16-bit buffer one row tall, and each pixel is blended here. One row-sized buffer is kept, so the cost does
// not grow with the file.

import AppKit
import CoreText

final class GlyphCompositor {
    private var buffer: CGContext?

    /// The band a line's glyphs can reach: from 4 points above its row to 20 below the row's top.
    private static let above: CGFloat = 4
    private static let band: CGFloat = 24
    private static let overhang: CGFloat = 6

    /// Draws `line` at `x` in the row at `rowTop` (the target's points) into `target`, inside `clip`. Code text is
    /// drawn into a see-through `layer` (stored premultiplied, over what the layer holds); without it, onto opaque
    /// pixels (line numbers). `baseline` defaults to a code row's (CodeLineText.baseline below `rowTop`).
    func draw(
        _ line: CTLine, x: CGFloat, rowTop: CGFloat, clip: CGRect, into target: CGContext, scale: CGFloat,
        layer: Bool = false, baseline: CGFloat? = nil
    ) {
        guard let data = target.data, let buffer = buffer(width: target.width, height: Int(Self.band * scale)) else {
            return
        }
        let bandTop = Int(((rowTop - Self.above) * scale).rounded(.down))
        // Only the columns the line can ink are cleared and blended: a line number is a few pixels of a canvas-wide
        // buffer. Glyphs overhang their advances a little (italics), so a margin on each side.
        let advance = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        let inkFirst = max(0, Int(((x - Self.overhang) * scale).rounded(.down)))
        let inkLast = min(buffer.width, Int(((x + advance + Self.overhang) * scale).rounded(.up)))
        guard inkFirst < inkLast else {
            return
        }
        buffer.clear(CGRect(x: inkFirst, y: 0, width: inkLast - inkFirst, height: buffer.height))
        buffer.saveGState()
        // Buffer pixel (column, row) is canvas pixel (column, bandTop + row), y down.
        buffer.translateBy(x: 0, y: CGFloat(buffer.height))
        buffer.scaleBy(x: scale, y: -scale)
        buffer.translateBy(x: 0, y: -CGFloat(bandTop) / scale)
        buffer.setShouldSmoothFonts(false)
        buffer.textMatrix = CGAffineTransform(scaleX: 1, y: -1)
        // Snapped to a device pixel here: Core Text snaps a fractional baseline in the flipped buffer downward on
        // screen, half a point lower than the page.
        let lineBaseline = ((baseline ?? rowTop + CodeLineText.baseline) * scale).rounded() / scale
        buffer.textPosition = CGPoint(x: x, y: lineBaseline)
        CTLineDraw(line, buffer)
        buffer.restoreGState()
        guard let source = buffer.data else {
            return
        }
        let firstColumn = max(inkFirst, Int((clip.minX * scale).rounded(.down)))
        let lastColumn = min(target.width, inkLast, Int((clip.maxX * scale).rounded(.up)))
        let firstRow = max(0, bandTop, Int((clip.minY * scale).rounded(.down)))
        let lastRow = min(target.height, bandTop + buffer.height, Int((clip.maxY * scale).rounded(.up)))
        guard firstColumn < lastColumn, firstRow < lastRow else {
            return
        }
        let glyphs = source.assumingMemoryBound(to: UInt16.self)
        let canvas = data.assumingMemoryBound(to: UInt8.self)
        let glyphRow = buffer.bytesPerRow / 2, canvasRow = target.bytesPerRow
        for row in firstRow..<lastRow {
            let glyphLine = (row - bandTop) * glyphRow, canvasLine = row * canvasRow
            for column in firstColumn..<lastColumn {
                let glyph = glyphLine + column * 4
                let alpha = glyphs[glyph + 3]
                if alpha == 0 {
                    continue
                }
                let coverage = Double(alpha) / 65535
                // The canvas is BGRA (32-bit little-endian, alpha first); the buffer is RGBA.
                let pixel = canvasLine + column * 4
                let below = Double(canvas[pixel + 3])
                for channel in 0..<3 {
                    let ink = Double(glyphs[glyph + channel]) / Double(alpha)
                    let slot = pixel + 2 - channel
                    if layer {
                        canvas[slot] = Self.stored(ink: ink, coverage: coverage, below: Double(canvas[slot]))
                    } else {
                        canvas[slot] = Self.plain(ink: ink, under: Double(canvas[slot]) / 255, coverage: coverage)
                    }
                }
                if layer {
                    canvas[pixel + 3] = UInt8(min(255, (255 * (coverage + below / 255 * (1 - coverage))).rounded()))
                }
            }
        }
    }

    /// In a see-through layer: the text over the premultiplied color `below` (0...255) the layer holds there, as
    /// WebKit stores it.
    static func stored(ink: Double, coverage: Double, below: Double) -> UInt8 {
        byte(half(half(half(ink) * coverage) + half(below / 255 * (1 - coverage))))
    }

    /// Straight onto an opaque background, every step in half precision.
    static func plain(ink: Double, under: Double, coverage: Double) -> UInt8 {
        let alpha = half(coverage)
        return byte(half(half(half(ink) * alpha) + half(under * (1 - alpha))))
    }

    private static func byte(_ value: Double) -> UInt8 {
        UInt8(min(255, max(0, (value * 255).rounded())))
    }

    /// A value in 0...1 rounded to the nearest float16 (ties to even), as the GPU stores it.
    static func half(_ value: Double) -> Double {
        #if arch(arm64)
        Double(Float16(value))
        #else
        guard value > 0 else {
            return 0
        }
        let step = pow(2, max(floor(log2(value)), -14) - 10)
        return (value / step).rounded(.toNearestOrEven) * step
        #endif
    }

    private func buffer(width: Int, height: Int) -> CGContext? {
        if let buffer, buffer.width == width, buffer.height == height {
            return buffer
        }
        guard let space = CGColorSpace(name: CGColorSpace.displayP3) else {
            return nil
        }
        buffer = CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 16, bytesPerRow: 0, space: space,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder16Little.rawValue
        )
        return buffer
    }
}
