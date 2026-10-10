// The terminal's fonts, picked the way the current app's page ends up with them. The family list is the default
// editor font (src/lib/stores/settingsData.ts DEFAULT_EDITOR_FONT, as buildTerminalFontFamily uses it when the
// terminal font is empty). WebKit resolves it twice, differently: a canvas outside the page (xterm's measuring
// canvas and its atlas warm-up) only finds the system's fonts, so the cell size and the warmed-up ASCII come from
// Menlo, while the canvas xterm puts inside the terminal's element also finds fonts the user installed, such as
// JetBrains Mono. Both found by comparing glyphs with a dump of the current app's WebGL canvas.

import CoreText
import Foundation

enum TerminalFonts {
    static let families = ["JetBrains Mono", "Menlo", "Monaco", "Cascadia Mono", "Consolas", "Courier New"]
    /// --term font size and line height defaults (settingsData.ts terminalFontSize, terminalLineHeight).
    static let fontSize: CGFloat = 13
    static let lineHeight: CGFloat = 1.2

    /// The first family with a font, among system fonts only or among every installed font.
    static func base(systemOnly: Bool) -> CTFont {
        for family in families {
            guard let font = font(family: family), !systemOnly || isSystemFont(font) else {
                continue
            }
            return font
        }
        return CTFontCreateWithName("Menlo-Regular" as CFString, fontSize, nil)
    }

    /// Regular, bold, italic and bold italic of `base` at `size`, as the canvas's "bold" and "italic" pick them.
    static func faces(_ base: CTFont, size: CGFloat) -> [CTFont] {
        let regular = CTFontCreateCopyWithAttributes(base, size, nil, nil)
        let traits: [CTFontSymbolicTraits] = [[], .traitBold, .traitItalic, [.traitBold, .traitItalic]]
        return traits.map { trait in
            trait.isEmpty ? regular : (CTFontCreateCopyWithSymbolicTraits(regular, size, nil, trait, trait) ?? regular)
        }
    }

    private static func font(family: String) -> CTFont? {
        let attributes = [kCTFontFamilyNameAttribute: family] as CFDictionary
        let descriptor = CTFontDescriptorCreateWithAttributes(attributes)
        guard let match = CTFontDescriptorCreateMatchingFontDescriptor(descriptor, nil) else {
            return nil
        }
        let font = CTFontCreateWithFontDescriptor(match, fontSize, nil)
        let found = CTFontCopyFamilyName(font) as String
        return found.caseInsensitiveCompare(family) == .orderedSame ? font : nil
    }

    private static func isSystemFont(_ font: CTFont) -> Bool {
        guard let url = CTFontCopyAttribute(font, kCTFontURLAttribute) as? URL else {
            return false
        }
        return url.path.hasPrefix("/System/")
    }
}
