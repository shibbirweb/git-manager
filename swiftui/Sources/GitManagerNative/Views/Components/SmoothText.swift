// Menu text drawn the way WebKit's <select> list draws it: with font smoothing, which thickens light text on a dark
// menu (measured: 26% more ink than AppKit's own menu text, the same as smoothing on against off). An image in the
// title as a text attachment (an item image would add a gap after it, and AppKit does not tint attachments), drawn
// once in the label color and once in the highlighted row's (SelectMenu swaps them).

import AppKit

enum SmoothText {
    /// A menu item's title: the text's image on the text's baseline, in `color`.
    static func title(_ text: String, font: NSFont, color: NSColor, space: CGColorSpace?) -> NSAttributedString {
        let (image, descent) = image(text, font: font, color: color, space: space)
        let attachment = NSTextAttachment()
        attachment.image = image
        attachment.bounds = CGRect(x: 0, y: -descent, width: image.size.width, height: image.size.height)
        return NSAttributedString(attachment: attachment)
    }

    /// `space` is the screen's, so the menu draws the pixels unconverted, as it draws its own text.
    static func image(
        _ text: String, font: NSFont, color: NSColor, space: CGColorSpace?, scale: CGFloat = 2
    ) -> (NSImage, CGFloat) {
        let attributed = NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: NSColor.white])
        let line = CTLineCreateWithAttributedString(attributed)
        var ascent: CGFloat = 0
        var descent: CGFloat = 0
        let width = ceil(CTLineGetTypographicBounds(line, &ascent, &descent, nil))
        let size = NSSize(width: width, height: ceil(ascent + descent))
        let pixelsWide = Int(size.width * scale)
        let pixelsHigh = Int(size.height * scale)
        guard let space = space ?? CGColorSpace(name: CGColorSpace.sRGB),
              let coverage = context(pixelsWide, pixelsHigh, space),
              let output = context(pixelsWide, pixelsHigh, space) else {
            return (NSImage(size: size), descent)
        }
        // White on black: smoothing needs an opaque background, and the gray level is then the glyph's coverage.
        coverage.setFillColor(CGColor(gray: 0, alpha: 1))
        coverage.fill(CGRect(x: 0, y: 0, width: pixelsWide, height: pixelsHigh))
        coverage.scaleBy(x: scale, y: scale)
        coverage.setAllowsFontSmoothing(true)
        coverage.setShouldSmoothFonts(true)
        // Half a point up, in the room ceil leaves at the top: AppKit sets an attachment that much lower than text
        // on the same baseline, and rounds its bounds to whole points (measured).
        coverage.textPosition = CGPoint(x: 0, y: descent + 0.5)
        CTLineDraw(line, coverage)
        let rgb = color.usingColorSpace(NSColorSpace(cgColorSpace: space) ?? .sRGB) ?? .white
        let channels = [rgb.redComponent, rgb.greenComponent, rgb.blueComponent]
        if let source = coverage.data?.assumingMemoryBound(to: UInt8.self),
           let target = output.data?.assumingMemoryBound(to: UInt8.self) {
            for index in 0..<(pixelsWide * pixelsHigh) {
                // Premultiplied: each channel at the glyph's coverage times the color's own alpha.
                let alpha = CGFloat(source[index * 4]) / 255 * rgb.alphaComponent
                for channel in 0..<3 {
                    target[index * 4 + channel] = UInt8((channels[channel] * alpha * 255).rounded())
                }
                target[index * 4 + 3] = UInt8((alpha * 255).rounded())
            }
        }
        guard let cgImage = output.makeImage() else {
            return (NSImage(size: size), descent)
        }
        return (NSImage(cgImage: cgImage, size: size), descent)
    }

    private static func context(_ pixelsWide: Int, _ pixelsHigh: Int, _ space: CGColorSpace) -> CGContext? {
        CGContext(data: nil, width: pixelsWide, height: pixelsHigh, bitsPerComponent: 8, bytesPerRow: pixelsWide * 4,
                  space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    }
}
