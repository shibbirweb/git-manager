// The page's .input (app.css): 28 points tall, 8 in, a --border-strong ring on --panel; focused, an --accent ring
// with 2 points of --accent at 25% around it. An empty focused field shows WebKit's caret at the start, and an empty
// field its placeholder. Used by the Clone dialog and Settings > GitHub.

import AppKit
import SwiftUI

struct PageInput: View {
    @Environment(\.theme) private var theme

    @Binding var text: String
    let focused: Bool
    var mono = false
    /// The code font with its ligatures on, as a plain .mono input shows "..." (the editor turns them off).
    var ligatures = false
    var placeholder = ""
    /// Takes the keyboard when it appears.
    var autofocus = false
    /// A password field: the characters show as dots.
    var secure = false
    var onFocus: () -> Void = {}
    /// Return in the field.
    var onSubmit: (() -> Void)?
    /// .number-input's 12 points (the MCP port).
    var fontSize: CGFloat = 13

    var body: some View {
        let font = mono ? (ligatures ? CodeFont.font(fontSize) : CodeFonts(size: fontSize).regular)
            : PageFont.ui(fontSize)
        ZStack(alignment: .leading) {
            if text.isEmpty && !placeholder.isEmpty {
                ExactText(text: placeholder, face: font)
                    .foregroundStyle(Color(nsColor: Theme.parse(WebKitDefaults.placeholder) ?? .gray))
            }
            if text.isEmpty && focused {
                theme.ink("--text").frame(width: 2, height: 15.29)
            }
            SearchInput(text: $text, textColor: theme.textColor("--text"), caretColor: theme.textColor("--text"),
                        font: font, autofocus: autofocus, onFocus: onFocus, secure: secure, onSubmit: onSubmit)
                .frame(height: 26)
        }
        // 8 points of padding inside the 1-point border (padding(1) below).
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity)
        .frame(height: 26)
        .background(RoundedRectangle(cornerRadius: 5, style: .circular).fill(theme.color("--panel")))
        .padding(1)
        .borderRing(theme.color(focused ? "--accent" : "--border-strong"), cornerRadius: 6)
        .background {
            if focused {
                RoundedRectangle(cornerRadius: 8, style: .circular)
                    .fill(theme.over("--accent", 0.25, on: "--panel"))
                    .padding(-2)
            }
        }
    }
}
