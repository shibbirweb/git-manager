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
