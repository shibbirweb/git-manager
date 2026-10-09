import NativeCore
import Testing

/// gm-light's terminal colors (src/lib/themes, --term-*).
private let light = TermPalette(
    background: 0xFFFFFF, foreground: 0x1E1F22, cursor: 0x1E1F22, selection: 0xA6D2FF,
    ansi16: [
        0x000000, 0xCD3131, 0x00BC00, 0x949800, 0x0451A5, 0xBC05BC, 0x0598BC, 0x555555,
        0x666666, 0xCD3131, 0x14CE14, 0xB5BA00, 0x0451A5, 0xBC05BC, 0x0598BC, 0xA5A5A5,
    ]
)

private func color(_ sgr: String, glyph: UInt32 = 0x41) -> TermRGBA {
    let term = TermEmulator(columns: 10, rows: 1)
    term.feed("\u{1B}[\(sgr)mA")
    return light.foreground(term.screen.row(0).cells[0].style, glyph: glyph)
}

// The values the current app's WebGL canvas holds for the same output (a layer dump of 0.1.0-beta.7, light).
@Test func lowContrastColorsAreDarkenedLikeTheCurrentApp() {
    #expect(color("32") == TermRGBA(rgb: 0x008800))
    #expect(color("33") == TermRGBA(rgb: 0x777A00))
    #expect(color("36") == TermRGBA(rgb: 0x037A98))
    #expect(color("92") == TermRGBA(rgb: 0x0C860C))
    #expect(color("31") == TermRGBA(rgb: 0xCD3131))
    #expect(color("90") == TermRGBA(rgb: 0x666666))
}

@Test func dimIsHalfOpacityAndBoldTakesTheBrightColor() {
    #expect(color("2") == TermRGBA(rgb: 0x1E1F22, alpha: 128))
    #expect(color("1;30") == TermRGBA(rgb: 0x666666))
    // Box drawing keeps its color whatever the contrast.
    #expect(color("32", glyph: 0x2500) == TermRGBA(rgb: 0x00BC00))
}

@Test func inverseSwapsTheDefaults() {
    let term = TermEmulator(columns: 10, rows: 1)
    term.feed("\u{1B}[7mA")
    let style = term.screen.row(0).cells[0].style
    #expect(light.background(style) == 0x1E1F22)
    #expect(light.foreground(style) == TermRGBA(rgb: 0xFFFFFF))
}

@Test func thePaletteHasTheCubeAndGrays() {
    #expect(light.ansi.count == 256)
    #expect(light.ansi[16] == 0x000000 && light.ansi[231] == 0xFFFFFF)
    #expect(light.ansi[196] == 0xFF0000 && light.ansi[232] == 0x080808 && light.ansi[255] == 0xEEEEEE)
}
