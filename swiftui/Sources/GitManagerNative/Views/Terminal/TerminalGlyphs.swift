// A cell's character as the current app's xterm.js WebGL renderer rasterizes it into its glyph atlas
// (addon-webgl TextureAtlas.ts _drawToCache): drawn by WebKit's canvas, which is Core Graphics, over the cell's
// background with font smoothing, then every pixel within a threshold of the background made transparent
// (clearColor). Measured byte for byte against a dump of the current app's WebGL canvas.

import AppKit
import CoreGraphics
import CoreText
import Foundation
import NativeCore

/// The device-pixel geometry xterm.js works out for the font (WebglRenderer._updateDimensions).
struct TerminalMetrics: Equatable {
    /// Cell size in device pixels (15 x 36 for Menlo 13 at line height 1.2 on a 2x display).
    var cellWidth: Int
    var cellHeight: Int
    var charHeight: Int
    var charTop: Int
    /// The alphabetic baseline below the ideographic one (the font's descent at the device size, rounded).
    var descent: Int
    var deviceFontSize: CGFloat
    let scale: Int

    /// xterm's TextMetricsMeasureStrategy (canvas measureText of "W": its advance, and the font box, which WebKit
    /// rounds to whole pixels), then floor, ceil and line height as WebglRenderer does.
    init(font: CTFont, fontSize: CGFloat, lineHeight: CGFloat, scale: Int) {
        self.scale = scale
        let cssFont = CTFontCreateCopyWithAttributes(font, fontSize, nil, nil)
        var glyph = CGGlyph(0)
        var character = UniChar(("W" as Unicode.Scalar).value)
        CTFontGetGlyphsForCharacters(cssFont, &character, &glyph, 1)
        var advance = CGSize.zero
        CTFontGetAdvancesForGlyphs(cssFont, .horizontal, &glyph, &advance, 1)
        let boxHeight = CTFontGetAscent(cssFont).rounded() + CTFontGetDescent(cssFont).rounded()
        let deviceScale = CGFloat(scale)
        cellWidth = Int((advance.width * deviceScale).rounded(.down))
        charHeight = Int((boxHeight * deviceScale).rounded(.up))
        cellHeight = Int((CGFloat(charHeight) * lineHeight).rounded(.down))
        charTop = lineHeight == 1 ? 0 : Int((CGFloat(cellHeight - charHeight) / 2).rounded())
        deviceFontSize = fontSize * deviceScale
        descent = Int(CTFontGetDescent(CTFontCreateCopyWithAttributes(font, deviceFontSize, nil, nil)).rounded())
    }
}

/// One rasterized character: opaque pixels (premultiplied BGRA, alpha 255) and cleared ones (0), placed relative to
/// the cell's top left.
struct TerminalGlyph {
    var width = 0
    var height = 0
    var originX = 0
    var originY = 0
    var pixels: [UInt32] = []

    static let empty = TerminalGlyph()
}

struct TerminalGlyphKey: Hashable {
    var text: String
    var foreground: TermRGBA
    var background: UInt32
    var bold: Bool
    var italic: Bool
    var underline: Bool
    var strikethrough: Bool
    var overline: Bool
    var cells: Int
    /// Rasterized in the atlas's warm-up (see `warmFonts`).
    var warm: Bool
}

final class TerminalGlyphs {
    let metrics: TerminalMetrics
    private let fonts: [CTFont]
    /// xterm.js warms its atlas up with ASCII 33 to 125 in the default colors on a canvas outside the page, where
    /// WebKit only finds system fonts (Menlo for the default list); every other glyph is drawn on a canvas inside
    /// the terminal's element, where the user's fonts resolve too (JetBrains Mono). Measured on the current app.
    private let warmFonts: [CTFont]
    private var cache: [TerminalGlyphKey: TerminalGlyph] = [:]
    private let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
    /// xterm's TMP_CANVAS_GLYPH_PADDING (2) twice.
    private let padding = 4

    /// `fonts` and `warmFonts`: regular, bold, italic, bold italic at the device size.
    init(metrics: TerminalMetrics, fonts: [CTFont], warmFonts: [CTFont]) {
        self.metrics = metrics
        self.fonts = fonts
        self.warmFonts = warmFonts
    }

    /// The cache grows with each new character and color; a theme change starts a new one.
    var count: Int { cache.count }

    func glyph(_ key: TerminalGlyphKey) -> TerminalGlyph {
        if let glyph = cache[key] {
            return glyph
        }
        let glyph = rasterize(key)
        cache[key] = glyph
        return glyph
    }

    private func rasterize(_ key: TerminalGlyphKey) -> TerminalGlyph {
        let width = metrics.cellWidth * max(key.cells, 2) + padding * 2
        let height = metrics.cellHeight + padding * 2
        let info = CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        guard let context = CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
            space: colorSpace, bitmapInfo: info
        ) else {
            return .empty
        }
        // Canvas coordinates: y down from the top.
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: 1, y: -1)
        context.setFillColor(color(key.background, alpha: 255))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        let foreground = color(key.foreground.rgb, alpha: key.foreground.alpha)
        let font = (key.warm ? warmFonts : fonts)[(key.bold ? 1 : 0) + (key.italic ? 2 : 0)]
        // textBaseline "ideographic": the font's own descent above the bottom of the character box.
        let baseline = CGFloat(padding + metrics.charHeight) - CTFontGetDescent(font).rounded()
        if key.underline {
            drawUnderline(context, key: key, foreground: foreground, font: font, baseline: baseline)
        }
        if key.overline {
            line(context, y: CGFloat(padding) + 0.5, width: 1, cells: key.cells, color: foreground)
        }
        context.setFillColor(foreground)
        drawText(key.text, font: font, context: context, x: CGFloat(padding), baseline: baseline, stroke: nil,
                 smooth: key.warm)
        if key.strikethrough {
            let lineWidth = max(1, (metrics.deviceFontSize / 10).rounded(.down))
            let y = CGFloat(padding) + CGFloat(metrics.charHeight / 2) - 0.5
            line(context, y: y, width: lineWidth, cells: key.cells, color: foreground)
        }
        return extract(context, key: key, width: width, height: height)
    }

    private func drawUnderline(
        _ context: CGContext, key: TerminalGlyphKey, foreground: CGColor, font: CTFont, baseline: CGFloat
    ) {
        let lineWidth = max(1, (metrics.deviceFontSize / 15).rounded(.down))
        let offset: CGFloat = Int(lineWidth) % 2 == 1 ? 0.5 : 0
        let top = CGFloat(padding + metrics.charHeight) - offset
        line(context, y: top, width: lineWidth, cells: key.cells, color: foreground)
        // A gap in the background color where descenders cross the line (font size 12 and up).
        guard key.text != " ", Self.descends(key.text, font: font) else {
            return
        }
        context.saveGState()
        let clipTop = top - (lineWidth / 2).rounded(.up)
        let clipHeight = lineWidth * 2 + (lineWidth / 2).rounded(.up)
        context.clip(to: CGRect(
            x: CGFloat(padding), y: clipTop, width: CGFloat(metrics.cellWidth * key.cells), height: clipHeight
        ))
        context.setStrokeColor(color(key.background, alpha: 255))
        context.setLineWidth(CGFloat(metrics.scale * 3))
        drawText(key.text, font: font, context: context, x: CGFloat(padding), baseline: baseline, stroke: true,
                 smooth: key.warm)
        context.restoreGState()
    }

    private func line(_ context: CGContext, y: CGFloat, width: CGFloat, cells: Int, color: CGColor) {
        context.saveGState()
        context.setStrokeColor(color)
        context.setLineWidth(width)
        for cell in 0..<cells {
            let left = CGFloat(padding + cell * metrics.cellWidth)
            context.move(to: CGPoint(x: left, y: y))
            context.addLine(to: CGPoint(x: left + CGFloat(metrics.cellWidth), y: y))
            context.strokePath()
        }
        context.restoreGState()
    }

    private static func descends(_ text: String, font: CTFont) -> Bool {
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [.font: font]))
        let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
        return bounds.minY < 0
    }

    /// Draws like the canvas's fillText (or strokeText): Core Text with font smoothing, ligatures off.
    /// The warm-up canvas smooths fonts (WebKit's default); the canvas inside the page inherits the page's
    /// -webkit-font-smoothing: antialiased.
    private func drawText(
        _ text: String, font: CTFont, context: CGContext, x: CGFloat, baseline: CGFloat, stroke: Bool?, smooth: Bool
    ) {
        context.saveGState()
        context.setAllowsFontSmoothing(smooth)
        context.setShouldSmoothFonts(smooth)
        context.setAllowsFontSubpixelPositioning(true)
        context.setShouldSubpixelPositionFonts(true)
        context.setShouldSubpixelQuantizeFonts(true)
        context.setTextDrawingMode(stroke == true ? .stroke : .fill)
        context.textMatrix = CGAffineTransform(scaleX: 1, y: -1)
        context.textPosition = CGPoint(x: x, y: baseline)
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font, .ligature: 0,
            NSAttributedString.Key(kCTForegroundColorFromContextAttributeName as String): true,
        ]
        CTLineDraw(CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes)), context)
        context.restoreGState()
    }

    private func color(_ rgb: UInt32, alpha: UInt8) -> CGColor {
        let components: [CGFloat] = [
            CGFloat(rgb >> 16 & 0xFF) / 255, CGFloat(rgb >> 8 & 0xFF) / 255, CGFloat(rgb & 0xFF) / 255,
            CGFloat(alpha) / 255,
        ]
        return CGColor(colorSpace: colorSpace, components: components)!
    }

    /// clearColor: the background and anything within the threshold becomes transparent.
    private func extract(_ context: CGContext, key: TerminalGlyphKey, width: Int, height: Int) -> TerminalGlyph {
        guard let data = context.data else {
            return .empty
        }
        let source = data.bindMemory(to: UInt32.self, capacity: width * height)
        let background = key.background
        let bgRed = Int(background >> 16 & 0xFF), bgGreen = Int(background >> 8 & 0xFF)
        let bgBlue = Int(background & 0xFF)
        let foreground = key.foreground
        let contrast = abs(bgRed - foreground.red) + abs(bgGreen - foreground.green) + abs(bgBlue - foreground.blue)
        let threshold = contrast / 12
        let checkThreshold = !(0xE0A4...0xE0D6).contains(key.text.unicodeScalars.first?.value ?? 0)
        var pixels = [UInt32](repeating: 0, count: width * height)
        var (left, top, right, bottom) = (width, height, -1, -1)
        for index in 0..<(width * height) {
            let pixel = source[index]
            let red = Int(pixel >> 16 & 0xFF), green = Int(pixel >> 8 & 0xFF), blue = Int(pixel & 0xFF)
            let distance = abs(red - bgRed) + abs(green - bgGreen) + abs(blue - bgBlue)
            if distance == 0 || (checkThreshold && distance < threshold) {
                continue
            }
            pixels[index] = pixel | 0xFF00_0000
            let (x, y) = (index % width, index / width)
            (left, top, right, bottom) = (min(left, x), min(top, y), max(right, x), max(bottom, y))
        }
        if right < 0 {
            return .empty
        }
        // Only the ink's box is kept, as the atlas keeps each glyph's bounding box.
        let boxWidth = right - left + 1, boxHeight = bottom - top + 1
        var box = [UInt32](repeating: 0, count: boxWidth * boxHeight)
        for row in 0..<boxHeight {
            for column in 0..<boxWidth {
                box[row * boxWidth + column] = pixels[(top + row) * width + left + column]
            }
        }
        return TerminalGlyph(
            width: boxWidth, height: boxHeight, originX: left - padding, originY: metrics.charTop - padding + top,
            pixels: box
        )
    }
}
