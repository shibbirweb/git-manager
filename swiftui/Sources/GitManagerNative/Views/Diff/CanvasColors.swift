// The diff canvas's colors, worked out once per theme: Theme parses a token's CSS on every call, and a paint asks
// for the same few colors for every row. Same answers as Theme, so the pixels do not change; a few dozen entries.

import AppKit

final class CanvasColors {
    let theme: Theme
    private var colors: [String: NSColor] = [:]
    private var translucents: [String: CGColor] = [:]
    private var fills: [String: [Double]] = [:]

    init(theme: Theme) {
        self.theme = theme
    }

    func nsColor(_ tokenName: String) -> NSColor {
        color("c" + tokenName) { theme.nsColor(tokenName) }
    }

    func textColor(_ tokenName: String) -> NSColor {
        color("t" + tokenName) { theme.textColor(tokenName) }
    }

    /// A token (at `alpha`, for CSS color-mix(in srgb, token alpha%, transparent), else its own) as the page paints
    /// it into a see-through layer: the exact converted color with its alpha, blended by Core Graphics there.
    func translucent(_ tokenName: String, alpha: Double? = nil) -> CGColor {
        let key = "\(tokenName)@\(alpha.map { "\($0)" } ?? "")"
        if let color = translucents[key] {
            return color
        }
        let color = theme.translucent(tokenName, alpha: alpha)
        translucents[key] = color
        return color
    }

    /// A token's converted color, not rounded, 0...255 (CSSColor.p3Exact).
    func exact(_ tokenName: String) -> [Double] {
        if let value = fills["exact" + tokenName] {
            return value
        }
        let value = theme.exact(tokenName)
        fills["exact" + tokenName] = value
        return value
    }

    /// A token's alpha, 0...1.
    func alpha(_ tokenName: String) -> Double {
        theme.alpha(tokenName)
    }

    /// A translucent token's premultiplied bytes and alpha as a layer stores the fill (Theme.layerFill).
    func layerFill(_ tokenName: String) -> [Double] {
        if let fill = fills[tokenName] {
            return fill
        }
        let fill = theme.layerFill(tokenName)
        fills[tokenName] = fill
        return fill
    }

    private func color(_ key: String, _ make: () -> NSColor) -> NSColor {
        if let color = colors[key] {
            return color
        }
        let color = make()
        colors[key] = color
        return color
    }
}
