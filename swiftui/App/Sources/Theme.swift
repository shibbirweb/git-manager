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

    /// Translucent layers painted one over another on `background`, as the page shows them. A layer is a token, or
    /// a token and an alpha for CSS color-mix(in srgb, token alpha%, transparent). Measured on the diff screen: one
    /// layer lands where the premultiplied 8-bit fill does (CSSColor.filled), while two (a changed word's box on its
    /// line's tint) land where exact, unrounded blending does.
    /// `overlay` marks a layer drawn above the content (an indent guide), which blends exactly even alone.
    func nsLayers(
        _ layers: [(token: String, alpha: Double?)], on background: String, overlay: Bool = false
    ) -> NSColor {
        guard let base = css(background) else {
            return .clear
        }
        let colors = layers.compactMap { layer -> CSSColor? in
            guard let color = css(layer.token) else {
                return nil
            }
            return layer.alpha.map { CSSColor(red: color.red, green: color.green, blue: color.blue, alpha: $0) }
                ?? color
        }
        if colors.count == 1, !overlay, let only = colors.first {
            return only.filled(over: base)
        }
        var exact = base.p3Exact
        for color in colors {
            exact = zip(color.p3Exact, exact).map { color.alpha * $0 + (1 - color.alpha) * $1 }
        }
        return CSSColor.color(p3Bytes: exact.map { $0.rounded() })
    }

    /// The fill a code line's layer holds under its text (TextUnder): one translucent token as its premultiplied
    /// 8-bit color (as CSSColor.filled stores it), or two (a changed word on its line's tint) blended exactly.
    func layerFill(_ tokenNames: [String]) -> TextUnder.Fill {
        let colors = tokenNames.compactMap(css)
        if colors.count == 1, let only = colors.first {
            let weight = (only.alpha * 255).rounded()
            return TextUnder.Fill(color: only.p3Bytes.map { ($0 * weight / 255).rounded() }, alpha: weight)
        }
        var color = [0.0, 0.0, 0.0], alpha = 0.0
        for layer in colors {
            color = zip(layer.p3Exact, color).map { layer.alpha * $0 + (1 - layer.alpha) * $1 }
            alpha = layer.alpha + alpha * (1 - layer.alpha)
        }
        return TextUnder.Fill(color: color, alpha: alpha * 255)
    }

    /// A token's Display P3 bytes, as the page paints it.
    func bytes(_ tokenName: String) -> [Double] {
        css(tokenName)?.p3Bytes ?? [0, 0, 0]
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
