import Foundation

// A cell's colors as the current app's xterm.js paints them (addon-webgl TextureAtlas.ts): the theme's 16 colors and
// xterm's 240 more, bold in bright colors, inverse, dim at half opacity, and the minimum contrast ratio of 4.5 the
// current app sets (TerminalView.svelte), which darkens or lightens a foreground until it reads on its background.

/// 0xRRGGBB plus an 8-bit alpha (255 opaque; dim text is 128).
public struct TermRGBA: Equatable, Hashable, Sendable {
    public var rgb: UInt32
    public var alpha: UInt8

    public init(rgb: UInt32, alpha: UInt8 = 255) {
        self.rgb = rgb
        self.alpha = alpha
    }

    public var red: Int { Int(rgb >> 16 & 0xFF) }
    public var green: Int { Int(rgb >> 8 & 0xFF) }
    public var blue: Int { Int(rgb & 0xFF) }
}

public struct TermPalette: Equatable, Sendable {
    public var background: UInt32
    public var foreground: UInt32
    public var cursor: UInt32
    public var selection: UInt32
    /// 256 colors: the theme's 16, the 6 x 6 x 6 cube, 24 grays.
    public var ansi: [UInt32]
    public var minimumContrastRatio = 4.5

    public init(background: UInt32, foreground: UInt32, cursor: UInt32, selection: UInt32, ansi16: [UInt32]) {
        self.background = background
        self.foreground = foreground
        self.cursor = cursor
        self.selection = selection
        var colors = Array(ansi16.prefix(16))
        while colors.count < 16 {
            colors.append(0)
        }
        let levels: [UInt32] = [0x00, 0x5F, 0x87, 0xAF, 0xD7, 0xFF]
        for index in 0..<216 {
            colors.append(levels[index / 36 % 6] << 16 | levels[index / 6 % 6] << 8 | levels[index % 6])
        }
        for index in 0..<24 {
            let gray = UInt32(8 + index * 10)
            colors.append(gray << 16 | gray << 8 | gray)
        }
        ansi = colors
    }

    /// The background a cell is drawn on.
    public func background(_ style: TermStyle) -> UInt32 {
        let (mode, color) = style.isInverse ? (style.fgMode, style.fgColor) : (style.bgMode, style.bgColor)
        return resolve(mode, color, standard: style.isInverse ? foreground : background, bold: false)
    }

    /// The color a cell's character is drawn in: `glyph` is the character, as box and Powerline glyphs keep their
    /// color whatever the contrast.
    /// `on`: the background the cell really gets when it differs from its own (a selection), for the contrast.
    public func foreground(_ style: TermStyle, glyph: UInt32 = 0x41, on cellBackground: UInt32? = nil) -> TermRGBA {
        let (mode, color) = style.isInverse ? (style.bgMode, style.bgColor) : (style.fgMode, style.fgColor)
        let base = resolve(mode, color, standard: style.isInverse ? background : foreground, bold: style.isBold)
        if minimumContrastRatio > 1 && !Self.keepsColor(glyph) {
            let ratio = minimumContrastRatio / (style.isDim ? 2 : 1)
            let under = cellBackground ?? background(style)
            if let adjusted = Self.ensureContrastRatio(background: under, foreground: base, ratio: ratio) {
                return TermRGBA(rgb: adjusted)
            }
        }
        return TermRGBA(rgb: base, alpha: style.isDim ? 128 : 255)
    }

    private func resolve(_ mode: TermColorMode, _ color: UInt32, standard: UInt32, bold: Bool) -> UInt32 {
        switch mode {
        case .standard:
            return standard
        case .palette16, .palette256:
            // drawBoldTextInBrightColors (on by default): bold text in the first 8 colors takes the bright ones.
            let index = Int(color) + (bold && color < 8 ? 8 : 0)
            return ansi[min(index, ansi.count - 1)]
        case .rgb:
            return color
        }
    }

    /// Powerline symbols and box and block elements (RendererUtils.ts treatGlyphAsBackgroundColor).
    static func keepsColor(_ glyph: UInt32) -> Bool {
        (0xE0A4...0xE0D6).contains(glyph) || (0x2500...0x259F).contains(glyph)
    }

    // MARK: Contrast (xterm's Color.ts)

    static func luminance(_ red: Int, _ green: Int, _ blue: Int) -> Double {
        func channel(_ value: Int) -> Double {
            let scaled = Double(value) / 255
            return scaled <= 0.03928 ? scaled / 12.92 : pow((scaled + 0.055) / 1.055, 2.4)
        }
        return channel(red) * 0.2126 + channel(green) * 0.7152 + channel(blue) * 0.0722
    }

    static func luminance(_ rgb: UInt32) -> Double {
        luminance(Int(rgb >> 16 & 0xFF), Int(rgb >> 8 & 0xFF), Int(rgb & 0xFF))
    }

    static func contrastRatio(_ first: Double, _ second: Double) -> Double {
        first < second ? (second + 0.05) / (first + 0.05) : (first + 0.05) / (second + 0.05)
    }

    /// The foreground moved to reach `ratio` against the background, or nil when it already does.
    public static func ensureContrastRatio(background: UInt32, foreground: UInt32, ratio: Double) -> UInt32? {
        let backgroundL = luminance(background)
        let foregroundL = luminance(foreground)
        guard contrastRatio(backgroundL, foregroundL) < ratio else {
            return nil
        }
        let darker = foregroundL < backgroundL
        let first = darker ? reduce(background, foreground, ratio) : increase(background, foreground, ratio)
        let firstRatio = contrastRatio(backgroundL, luminance(first))
        if firstRatio >= ratio {
            return first
        }
        let second = darker ? increase(background, foreground, ratio) : reduce(background, foreground, ratio)
        return firstRatio > contrastRatio(backgroundL, luminance(second)) ? first : second
    }

    static func reduce(_ background: UInt32, _ foreground: UInt32, _ ratio: Double) -> UInt32 {
        var (red, green, blue) = (Int(foreground >> 16 & 0xFF), Int(foreground >> 8 & 0xFF), Int(foreground & 0xFF))
        let backgroundL = luminance(background)
        var ratioNow = contrastRatio(luminance(red, green, blue), backgroundL)
        while ratioNow < ratio && (red > 0 || green > 0 || blue > 0) {
            red -= max(0, Int((Double(red) * 0.1).rounded(.up)))
            green -= max(0, Int((Double(green) * 0.1).rounded(.up)))
            blue -= max(0, Int((Double(blue) * 0.1).rounded(.up)))
            ratioNow = contrastRatio(luminance(red, green, blue), backgroundL)
        }
        return UInt32(red) << 16 | UInt32(green) << 8 | UInt32(blue)
    }

    static func increase(_ background: UInt32, _ foreground: UInt32, _ ratio: Double) -> UInt32 {
        var (red, green, blue) = (Int(foreground >> 16 & 0xFF), Int(foreground >> 8 & 0xFF), Int(foreground & 0xFF))
        let backgroundL = luminance(background)
        var ratioNow = contrastRatio(luminance(red, green, blue), backgroundL)
        while ratioNow < ratio && (red < 255 || green < 255 || blue < 255) {
            red = min(255, red + Int((Double(255 - red) * 0.1).rounded(.up)))
            green = min(255, green + Int((Double(255 - green) * 0.1).rounded(.up)))
            blue = min(255, blue + Int((Double(255 - blue) * 0.1).rounded(.up)))
            ratioNow = contrastRatio(luminance(red, green, blue), backgroundL)
        }
        return UInt32(red) << 16 | UInt32(green) << 8 | UInt32(blue)
    }
}
