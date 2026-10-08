// The diff canvas's colors, worked out once per theme: Theme parses a token's CSS on every call, and a paint asks
// for the same few colors for every row. Same answers as Theme, so the pixels do not change; a few dozen entries.

import AppKit

final class CanvasColors {
    let theme: Theme
    /// Whether the display composites in extended range (it shows HDR content), which changes the page's blends.
    let extendedRange: Bool
    private var colors: [String: NSColor] = [:]
    private var fills: [String: TextUnder.Fill] = [:]
    private var byteValues: [String: [Double]] = [:]

    init(theme: Theme, extendedRange: Bool) {
        self.theme = theme
        self.extendedRange = extendedRange
    }

    func nsColor(_ tokenName: String) -> NSColor {
        color("c" + tokenName) { theme.nsColor(tokenName) }
    }

    func textColor(_ tokenName: String) -> NSColor {
        color("t" + tokenName) { theme.textColor(tokenName) }
    }

    func nsSolid(_ tokenName: String, on background: String) -> NSColor {
        color("s\(tokenName) \(background)") { theme.nsSolid(tokenName, on: background) }
    }

    func nsLayers(
        _ layers: [(token: String, alpha: Double?)], on background: String, overlay: Bool = false,
        boxOnTop: Bool = false
    ) -> NSColor {
        let names = layers.map { "\($0.token)@\($0.alpha.map { "\($0)" } ?? "")" }.joined(separator: ",")
        return color("l\(names) \(background) \(overlay) \(boxOnTop)") {
            theme.nsLayers(layers, on: background, overlay: overlay, boxOnTop: boxOnTop, extendedRange: extendedRange)
        }
    }

    func layerFill(_ tokenNames: [String]) -> TextUnder.Fill {
        let key = tokenNames.joined(separator: ",")
        if let fill = fills[key] {
            return fill
        }
        let fill = theme.layerFill(tokenNames)
        fills[key] = fill
        return fill
    }

    func bytes(_ tokenName: String) -> [Double] {
        if let value = byteValues[tokenName] {
            return value
        }
        let value = theme.bytes(tokenName)
        byteValues[tokenName] = value
        return value
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
