// The current app's colors in SwiftUI: a theme's CSS tokens (Generated/Themes.swift) as colors that paint the same
// pixels as the current app's web view (CSSColor.swift does the conversion).

import AppKit
import SwiftUI

struct Theme {
    let id: String
    private let tokens: [String: String]

    init(_ themeTokens: ThemeTokens) {
        id = themeTokens.id
        tokens = themeTokens.colors
    }

    /// The built-in Git Manager Light or Dark theme, the current app's defaults.
    static func standard(for colorScheme: ColorScheme) -> Theme {
        let themeID = colorScheme == .dark ? "gm-dark" : "gm-light"
        guard let tokens = Themes.all.first(where: { $0.id == themeID }) ?? Themes.all.first else {
            fatalError("Generated/Themes.swift has no themes")
        }
        return Theme(tokens)
    }

    /// A token as a color, such as color("--panel"); clear when the token is missing or not a color.
    func color(_ tokenName: String) -> Color {
        Color(nsColor: nsColor(tokenName))
    }

    func nsColor(_ tokenName: String) -> NSColor {
        css(tokenName)?.displayP3 ?? .clear
    }

    /// A text color as WebKit draws glyphs with it: converted, not rounded (CSSColor.displayP3Exact).
    func textColor(_ tokenName: String) -> NSColor {
        css(tokenName)?.displayP3Exact ?? .clear
    }

    /// CSS color-mix(in srgb, first weight%, second), mixed in sRGB before the conversion, as the browser does.
    /// `weight` is a fraction (0.12 for 12%).
    func mix(_ first: String, _ weight: Double, _ second: String) -> Color {
        guard let one = css(first), let two = css(second) else {
            return .clear
        }
        return Color(nsColor: one.mixed(weight, with: two).displayP3)
    }

    /// `foreground` (a token or a literal such as "#ffffff") at `opacity` over the `background` token, as one solid
    /// color the way WebKit blends it: for CSS opacity and translucent fills over a known surface.
    func over(_ foreground: String, _ opacity: Double, on background: String) -> Color {
        guard let top = css(foreground) ?? CSSColor.parse(foreground), let bottom = css(background) else {
            return .clear
        }
        return Color(nsColor: top.over(bottom, opacity: opacity))
    }

    /// A translucent token (such as --diff-added) over the `background` token, at its own alpha, as one solid color.
    func solid(_ tokenName: String, on background: String) -> Color {
        Color(nsColor: nsSolid(tokenName, on: background))
    }

    /// A token (at `alpha` when given, for CSS color-mix(in srgb, token alpha%, transparent)) as WebKit hands it to
    /// Core Graphics for a fill in a see-through layer: converted to Display P3, not rounded, with its alpha.
    func translucent(_ tokenName: String, alpha: Double? = nil) -> CGColor {
        guard let color = css(tokenName), let space = CGColorSpace(name: CGColorSpace.displayP3) else {
            return CGColor(gray: 0, alpha: 0)
        }
        let exact = color.p3Exact.map { CGFloat($0 / 255) }
        return CGColor(colorSpace: space, components: exact + [CGFloat(alpha ?? color.alpha)])
            ?? CGColor(gray: 0, alpha: 0)
    }

    /// A token converted to Display P3, not rounded, 0...255.
    func exact(_ tokenName: String) -> [Double] {
        css(tokenName)?.p3Exact ?? [0, 0, 0]
    }

    /// A token's alpha, 0...1 (1 when it has none).
    func alpha(_ tokenName: String) -> Double {
        css(tokenName)?.alpha ?? 1
    }

    /// The bytes a see-through layer stores for a translucent token filled over nothing: its converted color times
    /// its alpha, rounded, and the alpha in 8 bits (red, green, blue, alpha in 0...255). Measured in the current
    /// app's layers: rgba(84, 170, 84, 0.2) is stored as 21, 34, 19, 51.
    func layerFill(_ tokenName: String) -> [Double] {
        guard let color = css(tokenName) else {
            return [0, 0, 0, 0]
        }
        let weight = (color.alpha * 255).rounded()
        return color.p3Bytes.map { ($0 * weight / 255).rounded() } + [weight]
    }

    func nsSolid(_ tokenName: String, on background: String) -> NSColor {
        guard let top = css(tokenName), let bottom = css(background) else {
            return .clear
        }
        return top.filled(over: bottom)
    }

    /// The token converted by macOS itself, for what macOS draws in the current app too: its title bar shows the
    /// window's sRGB background, converted by macOS (#1e1f22 as #1e1f21), not by WebKit.
    func systemColor(_ tokenName: String) -> Color {
        Color(nsColor: css(tokenName)?.systemSRGB ?? .clear)
    }

    /// A literal CSS color (such as WebKit's own #a9a9a9 placeholder) the way the web view paints it.
    static func parse(_ text: String) -> NSColor? {
        CSSColor.parse(text)?.displayP3
    }

    /// A token, or a literal such as "#b04ad8", as a CSS color, for color-mix() chains (LogColors.swift).
    func cssColor(_ tokenOrLiteral: String) -> CSSColor? {
        css(tokenOrLiteral) ?? CSSColor.parse(tokenOrLiteral)
    }

    /// The token as an sRGB color for a layer macOS converts when it composites (the Settings dialog's layer).
    func srgbLayerColor(_ tokenName: String) -> CGColor {
        css(tokenName)?.systemSRGB.cgColor ?? CGColor(gray: 0, alpha: 0)
    }

    /// A token's text as the theme has it, such as --shadow's "0 8px 28px rgba(0, 0, 0, 0.16)".
    func raw(_ tokenName: String) -> String? {
        tokens[tokenName]
    }

    private func css(_ tokenName: String) -> CSSColor? {
        CSSColor.parse(tokens[tokenName] ?? "")
    }
}

private struct ThemeKey: EnvironmentKey {
    static let defaultValue = Theme.standard(for: .light)
}

extension EnvironmentValues {
    var theme: Theme {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}
