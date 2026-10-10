// The UI font at a CSS weight, as WebKit picks it for -apple-system: the system font's variable weight axis set to the
// CSS number. NSFont's .semibold is a lighter instance than wght 600, so semibold labels came out with thinner stems
// (1.5% less ink). Checked in a WKWebView harness: wght 600 gives the page's pixels; regular is the same either way.

import AppKit
import SwiftUI

enum PageFont {
    /// font-weight for a weight name: .medium 500, .semibold 600, .bold 700; anything else regular.
    static func cssWeight(_ weight: NSFont.Weight) -> Int {
        switch weight {
        case .medium:
            return 500
        case .semibold:
            return 600
        case .bold:
            return 700
        default:
            return 400
        }
    }

    static func ui(_ size: CGFloat, weight: NSFont.Weight = .regular, tabular: Bool = false) -> NSFont {
        let base = tabular
            ? NSFont.monospacedDigitSystemFont(ofSize: size, weight: .regular)
            : NSFont.systemFont(ofSize: size)
        let css = cssWeight(weight)
        if css == 400 {
            return base
        }
        let wght = NSNumber(value: 0x7767_6874)
        let descriptor = base.fontDescriptor.addingAttributes([.variation: [wght: NSNumber(value: css)]])
        return NSFont(descriptor: descriptor, size: size) ?? .systemFont(ofSize: size, weight: weight)
    }

    /// The same font for SwiftUI text.
    static func font(_ size: CGFloat, weight: NSFont.Weight = .regular) -> Font {
        Font(ui(size, weight: weight))
    }
}
