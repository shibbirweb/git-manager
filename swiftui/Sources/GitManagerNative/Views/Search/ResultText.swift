// The text of Find in Files' line rows (src/lib/search/TextResult.svelte): the line in the 13-point code font,
// keeping its ligatures (=> as one arrow) as the page sets none there, cut with an ellipsis to its room. The rows
// themselves are drawn by ResultsCanvas.

import AppKit
import NativeCore

enum ResultText {
    /// The longest start of `text` that fits `width` with "…" after it (WebKit keeps a space before it), or the
    /// whole text when it fits.
    static func ellipsized(_ text: String, width: CGFloat) -> String {
        let font = CodeFont.font(13)
        guard ExactText.width(text, font: font) > width + 1.0 / 64 else {
            return text
        }
        let room = width - ExactText.width("…", font: font)
        var characters = Array(text)
        while !characters.isEmpty && ExactText.width(String(characters), font: font) > room + 1.0 / 64 {
            characters.removeLast()
        }
        return String(characters) + "…"
    }
}

/// The code font of the list (JetBrains Mono, its ligatures on, as the page leaves them there).
enum CodeFont {
    private static var fonts: [CGFloat: NSFont] = [:]

    static func font(_ size: CGFloat) -> NSFont {
        if let cached = fonts[size] {
            return cached
        }
        let font = NSFont(name: "JetBrainsMono-Regular", size: size)
            ?? .monospacedSystemFont(ofSize: size, weight: .regular)
        fonts[size] = font
        return font
    }
}
