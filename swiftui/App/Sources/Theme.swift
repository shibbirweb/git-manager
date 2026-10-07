// The current app's colors in SwiftUI: a theme's CSS tokens (Generated/Themes.swift) turned into colors that
// paint the same pixels as the current app's web view (see color(red:green:blue:alpha:)).

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
        Theme.parse(tokens[tokenName] ?? "") ?? .clear
    }

    /// CSS color-mix(in srgb, first weight%, second): the channels mixed as numbers, like the browser does.
    func mix(_ first: String, _ weight: Double, _ second: String) -> Color {
        guard let one = Theme.parse(tokens[first] ?? ""), let two = Theme.parse(tokens[second] ?? "") else {
            return .clear
        }
        let channel = { (left: CGFloat, right: CGFloat) in left * weight + right * (1 - weight) }
        let mixed = NSColor(
            displayP3Red: channel(one.redComponent, two.redComponent),
            green: channel(one.greenComponent, two.greenComponent),
            blue: channel(one.blueComponent, two.blueComponent),
            alpha: channel(one.alphaComponent, two.alphaComponent)
        )
        return Color(nsColor: mixed)
    }

    /// The token as a color-managed sRGB color, for what macOS itself draws in the current app: its title bar
    /// comes from the window's sRGB background and is converted (#1e1f22 shows as #1e1f21), unlike the web view.
    func systemColor(_ tokenName: String) -> Color {
        guard let color = Theme.parse(tokens[tokenName] ?? "")?.usingColorSpace(.displayP3) else {
            return .clear
        }
        let srgb = NSColor(
            srgbRed: color.redComponent, green: color.greenComponent, blue: color.blueComponent,
            alpha: color.alphaComponent
        )
        return Color(nsColor: srgb)
    }

    /// #rgb, #rrggbb, #rrggbbaa or rgb()/rgba(), as CSS writes them.
    static func parse(_ text: String) -> NSColor? {
        let value = text.trimmingCharacters(in: .whitespaces).lowercased()
        if value.hasPrefix("#") {
            var hex = String(value.dropFirst())
            if hex.count == 3 {
                hex = hex.map { "\($0)\($0)" }.joined()
            }
            guard hex.count == 6 || hex.count == 8, let number = UInt64(hex, radix: 16) else {
                return nil
            }
            let hasAlpha = hex.count == 8
            let red = hasAlpha ? (number >> 24) & 0xff : (number >> 16) & 0xff
            let green = hasAlpha ? (number >> 16) & 0xff : (number >> 8) & 0xff
            let blue = hasAlpha ? (number >> 8) & 0xff : number & 0xff
            let alpha = hasAlpha ? number & 0xff : 255
            return color(red: Double(red), green: Double(green), blue: Double(blue), alpha: Double(alpha) / 255)
        }
        guard value.hasPrefix("rgb"), let open = value.firstIndex(of: "("), let close = value.lastIndex(of: ")") else {
            return nil
        }
        let parts = value[value.index(after: open)..<close]
            .split(whereSeparator: { $0 == "," || $0 == " " || $0 == "/" })
            .compactMap { Double($0) }
        guard parts.count >= 3 else {
            return nil
        }
        let alpha = parts.count >= 4 ? parts[3] : 1
        return color(red: parts[0], green: parts[1], blue: parts[2], alpha: alpha)
    }

    /// 0 to 255 channels, taken as Display P3 values. The current app's web view hands CSS colors to the display
    /// unconverted (its screenshots, tagged Display P3, hold the CSS numbers themselves), while an sRGB NSColor
    /// is converted and lands one step off on some colors (#25272a as #262729). Same numbers, same pixels.
    private static func color(red: Double, green: Double, blue: Double, alpha: Double) -> NSColor {
        NSColor(
            displayP3Red: CGFloat(red / 255), green: CGFloat(green / 255), blue: CGFloat(blue / 255),
            alpha: CGFloat(alpha)
        )
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
