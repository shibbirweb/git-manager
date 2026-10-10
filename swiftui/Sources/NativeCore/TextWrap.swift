// Breaking a paragraph into lines the way WebKit does for plain text in a box: greedy, at spaces, a line takes the
// next word while the whole line (without its trailing space) fits the width; a word wider than the box gets a line
// of its own. Widths come from the caller (the exact advances of the font), so the rule stays testable.

import Foundation

public enum TextWrap {
    /// The lines of `text`, each without its trailing space.
    public static func lines(_ text: String, width: Double, measure: (String) -> Double) -> [String] {
        let words = text.split(separator: " ", omittingEmptySubsequences: true).map(String.init)
        var lines: [String] = []
        var current = ""
        for word in words {
            if current.isEmpty {
                current = word
                continue
            }
            let candidate = current + " " + word
            // WebKit compares layout units (1/64 point), so a line that fits within that rounding still fits.
            if (measure(candidate) * 64).rounded() / 64 <= width + 1e-9 {
                current = candidate
            } else {
                lines.append(current)
                current = word
            }
        }
        if !current.isEmpty {
            lines.append(current)
        }
        return lines
    }
}
