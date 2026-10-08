// Foreground colors for text as WebKit hands them to Core Graphics: the token converted to Display P3 and not rounded
// to bytes (Theme.textColor).

import SwiftUI

extension Theme {
    /// A token as an exact foreground color, such as ink("--text-dim").
    func ink(_ tokenName: String) -> Color {
        Color(nsColor: textColor(tokenName))
    }
}
