// One row of Find in Files (src/lib/search/TextResult.svelte): a file heading its matches (the file icon, the
// semibold name, the folder in 12 points and the count in 11) or a matching line (its number right-aligned in a
// 38-point column in 11.5-point mono and --editor-line-number, then the line in the 13-point code font with each
// match on --diff-inline, 2-point corners). Unlike the editor, the list keeps the code font's ligatures (=> as one
// arrow), as the page sets none there. The line is one text, so its glyphs keep their exact fractional places; the
// marks are drawn under it at their characters' advances, on the 2x pixel as WebKit snaps backgrounds.

import AppKit
import NativeCore
import SwiftUI

struct TextResultRow: View {
    @Environment(\.theme) private var theme

    let row: TextRow
    let selected: Bool
    /// The room the line's text has (.text, flex 1): what does not fit ends in an ellipsis.
    var textWidth: CGFloat = .infinity

    var body: some View {
        switch row {
        case .file(_, _, let name, let folder, let count):
            PopupRowFrame(gap: 6) {
                Icon(name: "file", size: 13)
                    .offset(y: SearchEverywhereView.iconLift)
                ExactText(text: name, size: 13, weight: .semibold)
                    .foregroundStyle(theme.ink("--text"))
                ExactText(text: folder, size: 12)
                    .foregroundStyle(theme.ink("--text-faint"))
                Spacer(minLength: 0)
                ExactText(text: "\(count)", size: 11)
                    .foregroundStyle(theme.ink("--text-faint"))
                    .offset(y: 0.5)
            }
        case .line(_, _, let line, _, let parts):
            PopupRowFrame(selected: selected) {
                ExactText(text: "\(line)", size: 11.5, face: CodeFont.font(11.5))
                    .foregroundStyle(theme.ink("--editor-line-number"))
                    .frame(width: 26, alignment: .trailing)
                    .padding(.leading, 12)
                ExactText(text: Self.ellipsized(parts.map(\.text).joined(), width: textWidth), size: 13,
                          face: CodeFont.font(13))
                    .foregroundStyle(theme.ink("--text"))
                    .background(alignment: .leading) {
                        marks(parts)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .clipped()
            }
        }
    }

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

    private func marks(_ parts: [TextPart]) -> some View {
        let font = CodeFont.font(13)
        var boxes: [CGRect] = []
        var start: CGFloat = 0
        for part in parts {
            let width = ExactText.width(part.text, font: font)
            if part.match {
                let left = (start * 2).rounded() / 2
                let right = ((start + width) * 2).rounded() / 2
                boxes.append(CGRect(x: left, y: 0, width: right - left, height: 17))
            }
            start += width
        }
        let fill = theme.solid("--diff-inline", on: selected ? "--selected" : "--panel")
        return ZStack(alignment: .topLeading) {
            ForEach(Array(boxes.enumerated()), id: \.offset) { _, box in
                RoundedRectangle(cornerRadius: 2, style: .circular)
                    .fill(fill)
                    .frame(width: box.width, height: box.height)
                    .offset(x: box.minX)
            }
        }
        .frame(height: 17, alignment: .topLeading)
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
