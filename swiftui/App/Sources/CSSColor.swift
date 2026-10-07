// A CSS color from the themes (#rgb, #rrggbb, #rrggbbaa, rgb(), rgba()) and the exact pixels the current app's web
// view gives it. WebKit converts sRGB to the display's Display P3 with exact math and rounds to 8 bits; macOS's own
// conversion rounds some near-grays one step off (#25272a as #262729). So the conversion is done here, and the
// rounded result goes to macOS as Display P3, which it shows unchanged.

import AppKit

struct CSSColor: Equatable {
    /// sRGB channels, 0 to 255, as written in the CSS.
    let red: Double
    let green: Double
    let blue: Double
    /// 0 to 1.
    let alpha: Double

    static func parse(_ text: String) -> CSSColor? {
        let value = text.trimmingCharacters(in: .whitespaces).lowercased()
        if value.hasPrefix("#") {
            var hex = String(value.dropFirst())
            if hex.count == 3 {
                hex = hex.map { "\($0)\($0)" }.joined()
            }
            guard hex.count == 6 || hex.count == 8, let number = UInt64(hex, radix: 16) else {
                return nil
            }
            let shift: UInt64 = hex.count == 8 ? 8 : 0
            let channel = { (position: UInt64) in Double((number >> (position + shift)) & 0xff) }
            let alpha = hex.count == 8 ? Double(number & 0xff) / 255 : 1
            return CSSColor(red: channel(16), green: channel(8), blue: channel(0), alpha: alpha)
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
        return CSSColor(red: parts[0], green: parts[1], blue: parts[2], alpha: parts.count >= 4 ? parts[3] : 1)
    }

    /// CSS color-mix(in srgb, self weight%, other): the sRGB channels mixed as numbers, before any conversion.
    func mixed(_ weight: Double, with other: CSSColor) -> CSSColor {
        let blend = { (left: Double, right: Double) in left * weight + right * (1 - weight) }
        return CSSColor(
            red: blend(red, other.red), green: blend(green, other.green), blue: blend(blue, other.blue),
            alpha: blend(alpha, other.alpha)
        )
    }

    /// The pixels the web view paints: converted to Display P3 here, rounded to 8 bits, shown unchanged.
    var displayP3: NSColor {
        CSSColor.p3Color(p3Bytes, alpha: alpha)
    }

    /// The converted channels as the web view stores them: Display P3, rounded to 0...255.
    var p3Bytes: [Double] {
        CSSColor.toDisplayP3([red, green, blue]).map { ($0 * 255).rounded() }
    }

    /// This color at `opacity` over `background`, as WebKit blends: each converted 8-bit channel mixed and rounded
    /// (12% of #3574f0 over #f2f3f5 is #dde4f3). Drawn as a solid color, since macOS's own compositing lands one step
    /// off.
    func over(_ background: CSSColor, opacity: Double) -> NSColor {
        let blended = zip(p3Bytes, background.p3Bytes).map { (opacity * $0 + (1 - opacity) * $1).rounded() }
        return CSSColor.p3Color(blended, alpha: 1)
    }

    private static func p3Color(_ bytes: [Double], alpha: Double) -> NSColor {
        NSColor(
            displayP3Red: CGFloat(bytes[0] / 255), green: CGFloat(bytes[1] / 255), blue: CGFloat(bytes[2] / 255),
            alpha: CGFloat(alpha)
        )
    }

    /// As macOS converts a plain sRGB color itself: for what macOS draws in the current app (its title bar).
    var systemSRGB: NSColor {
        NSColor(
            srgbRed: CGFloat(red / 255), green: CGFloat(green / 255), blue: CGFloat(blue / 255), alpha: CGFloat(alpha)
        )
    }

    /// sRGB 0...255 to encoded Display P3 0...1: both use the sRGB transfer curve and the D65 white point; only the
    /// primaries differ (matrices from the CSS Color 4 spec).
    private static func toDisplayP3(_ channels: [Double]) -> [Double] {
        let linear = channels.map { value -> Double in
            let encoded = value / 255
            return encoded <= 0.04045 ? encoded / 12.92 : pow((encoded + 0.055) / 1.055, 2.4)
        }
        let srgbToXYZ = [
            [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
            [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
            [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
        ]
        let xyzToP3 = [
            [2.493496911941425, -0.9313836179191239, -0.40271078445071684],
            [-0.8294889695615747, 1.7626640603183463, 0.023624685841943577],
            [0.03584583024378447, -0.07617238926804182, 0.9568845240076872],
        ]
        let multiply = { (matrix: [[Double]], vector: [Double]) in
            matrix.map { row in zip(row, vector).map { $0 * $1 }.reduce(0, +) }
        }
        return multiply(xyzToP3, multiply(srgbToXYZ, linear)).map { value in
            let clamped = min(1, max(0, value))
            return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * pow(clamped, 1 / 2.4) - 0.055
        }
    }
}
