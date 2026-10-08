// One bitmap of the diff canvas and the layer that shows it. The current app's page is a stack of Core Animation
// layers (found by dumping its layer tree and surfaces on 2026-10-08): the editor's background, then each editor's
// content (tints, changed words, code text, fold bars, indent guides) in a see-through 8-bit layer, the gutter, and
// the scrollbar thumbs. macOS composites them, and how it rounds depends on the display (HDR headroom or not) and on
// what the window shows, so no blend formula holds everywhere. The canvas builds the same stack: it paints what
// WebKit stores in each layer and lets macOS composite, which gives the same pixels in every case.

import AppKit
import QuartzCore

final class CanvasSurface {
    let layer: CALayer
    private(set) var context: CGContext?

    init(layer: CALayer = CALayer()) {
        self.layer = layer
        layer.actions = CanvasSurface.noActions
        layer.contentsGravity = .topLeft
    }

    /// No implicit animation when the canvas moves, shows or replaces a layer.
    static let noActions: [String: CAAction] = [
        "contents": NSNull(), "bounds": NSNull(), "position": NSNull(), "frame": NSNull(), "hidden": NSNull(),
        "backgroundColor": NSNull(), "contentsScale": NSNull(),
    ]

    /// Makes the bitmap `width` x `height` pixels in `space` unless it already is; true when it was made, so it must
    /// be painted whole.
    func prepare(width: Int, height: Int, space: CGColorSpace) -> Bool {
        guard width > 0, height > 0 else {
            context = nil
            return true
        }
        if let context, context.width == width, context.height == height, context.colorSpace == space {
            return false
        }
        context = CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: space,
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        )
        return true
    }

    /// Moves the pixels up (a positive `rows`, scrolling down) or down by whole rows.
    func shift(rows: Int) {
        guard let context, let data = context.data, rows != 0, abs(rows) < context.height else {
            return
        }
        let rowBytes = context.bytesPerRow
        let kept = (context.height - abs(rows)) * rowBytes
        if rows > 0 {
            memmove(data, data + rows * rowBytes, kept)
        } else {
            memmove(data + -rows * rowBytes, data, kept)
        }
    }

    /// Sets the pixels of `rect` (bitmap pixels, y down) to one premultiplied color, as WebKit stores a fill in a
    /// see-through layer: `bytes` are red, green, blue and alpha, 0...255.
    func store(_ bytes: [Double], in rect: CGRect) {
        guard let context, let data = context.data else {
            return
        }
        let left = max(0, Int(rect.minX.rounded())), right = min(context.width, Int(rect.maxX.rounded()))
        let top = max(0, Int(rect.minY.rounded())), bottom = min(context.height, Int(rect.maxY.rounded()))
        guard left < right, top < bottom else {
            return
        }
        let pixel = bytes.map { UInt8(min(255, max(0, $0.rounded()))) }
        let bgra = UInt32(pixel[2]) | UInt32(pixel[1]) << 8 | UInt32(pixel[0]) << 16 | UInt32(pixel[3]) << 24
        let words = data.assumingMemoryBound(to: UInt32.self)
        let rowWords = context.bytesPerRow / 4
        for row in top..<bottom {
            let start = row * rowWords
            for column in left..<right {
                words[start + column] = bgra
            }
        }
    }

    /// Paints a translucent color over the pixels of `rect` (bitmap pixels, y down) as WebKit composites a fill
    /// into a see-through layer: the exact converted `color` (0...255) at `alpha` over the premultiplied bytes there,
    /// rounded once. Measured in the current app's layers: an indent guide (#5f636b at 38%) is stored as 36, 38,
    /// 40, 97 over nothing and 49, 59, 52, 128 over the added tint's 21, 34, 19, 51.
    func blend(_ color: [Double], alpha: Double, in rect: CGRect, coverage: ((Int, Int) -> Double)? = nil) {
        guard let context, let data = context.data else {
            return
        }
        let left = max(0, Int(rect.minX.rounded())), right = min(context.width, Int(rect.maxX.rounded()))
        let top = max(0, Int(rect.minY.rounded())), bottom = min(context.height, Int(rect.maxY.rounded()))
        guard left < right, top < bottom else {
            return
        }
        let bytes = data.assumingMemoryBound(to: UInt8.self)
        // On the GPU in half precision, like the text (GlyphCompositor).
        let half = GlyphCompositor.half
        let mix = { (top: Double, below: UInt8, alpha: Double) -> UInt8 in
            let value = half(half(top / 255 * alpha) + half(Double(below) / 255 * (1 - alpha))) * 255
            return UInt8(min(255, max(0, value.rounded())))
        }
        for row in top..<bottom {
            for column in left..<right {
                let pixelAlpha = alpha * (coverage?(column, row) ?? 1)
                if pixelAlpha <= 0 {
                    continue
                }
                // BGRA in memory: blue, green, red, alpha.
                let pixel = row * context.bytesPerRow + column * 4
                for (slot, channel) in [(0, 2), (1, 1), (2, 0)] {
                    bytes[pixel + slot] = mix(color[channel], bytes[pixel + slot], pixelAlpha)
                }
                bytes[pixel + 3] = mix(255, bytes[pixel + 3], pixelAlpha)
            }
        }
    }

    /// The same blend through `path` (bitmap pixels, y down): each pixel takes the path's 8-bit coverage there, as
    /// Core Graphics rasterizes it (a changed word's box, with its rounded corners), inside `clip`.
    func blend(_ color: [Double], alpha: Double, path: CGPath, clip: CGRect) {
        let box = path.boundingBoxOfPath.integral
        guard box.width > 0, box.height > 0, let mask = CGContext(
            data: nil, width: Int(box.width), height: Int(box.height), bitsPerComponent: 8,
            bytesPerRow: Int(box.width), space: CGColorSpaceCreateDeviceGray(),
            bitmapInfo: CGImageAlphaInfo.none.rawValue
        ), let maskData = mask.data else {
            return
        }
        // The mask's rows run top down like the bitmap's: flip so path y (down) maps onto them.
        mask.translateBy(x: -box.minX, y: box.maxY)
        mask.scaleBy(x: 1, y: -1)
        mask.setFillColor(gray: 1, alpha: 1)
        mask.addPath(path)
        mask.fillPath()
        let values = maskData.assumingMemoryBound(to: UInt8.self)
        let left = Int(box.minX), top = Int(box.minY), rowBytes = mask.bytesPerRow
        let area = box.intersection(clip)
        guard !area.isNull else {
            return
        }
        blend(color, alpha: alpha, in: area) { column, row in
            Double(values[(row - top) * rowBytes + (column - left)]) / 255
        }
    }

    /// Hands the layer the bitmap at `frame` (layer points).
    func publish(frame: CGRect, scale: CGFloat) {
        layer.frame = frame
        layer.contentsScale = scale
        layer.contents = context?.makeImage()
    }
}
