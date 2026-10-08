// The commit box's small parts: the split button's half-rounded shape, a .btn, and WebKit's own checkbox look.

import SwiftUI

/// A rectangle with 6-point corners on one side only (the split button's halves); UnevenRoundedRectangle needs
/// macOS 14.
struct HalfRoundedRectangle: Shape {
    let roundedSide: HorizontalEdge
    var radius: CGFloat = 6

    func path(in rect: CGRect) -> Path {
        let leading = roundedSide == .leading ? radius : 0
        let trailing = roundedSide == .trailing ? radius : 0
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + leading, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - trailing, y: rect.minY))
        path.addArc(tangent1End: CGPoint(x: rect.maxX, y: rect.minY), tangent2End: CGPoint(x: rect.maxX, y: rect.maxY),
                    radius: trailing)
        path.addArc(tangent1End: CGPoint(x: rect.maxX, y: rect.maxY), tangent2End: CGPoint(x: rect.minX, y: rect.maxY),
                    radius: trailing)
        path.addArc(tangent1End: CGPoint(x: rect.minX, y: rect.maxY), tangent2End: CGPoint(x: rect.minX, y: rect.minY),
                    radius: leading)
        path.addArc(tangent1End: CGPoint(x: rect.minX, y: rect.minY), tangent2End: CGPoint(x: rect.maxX, y: rect.minY),
                    radius: leading)
        path.closeSubpath()
        return path
    }
}

/// A .btn: 28 points tall, 6-point corners, a --border-strong line on --panel; at half opacity while off
/// (.btn:disabled), drawn as the solid colors WebKit blends.
struct BorderedButton<Label: View>: View {
    @Environment(\.theme) private var theme

    var width: CGFloat?
    var height: CGFloat = 28
    var disabled = false
    var action: () -> Void = {}
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: action) {
            label()
                .frame(maxWidth: width == nil ? .infinity : nil)
                .frame(width: width, height: height)
                .background(RoundedRectangle(cornerRadius: 6, style: .circular).fill(theme.color("--panel")))
                .borderRing(line, cornerRadius: 6)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .allowsHitTesting(!disabled)
        .foregroundStyle(disabled ? theme.over("--text", 0.5, on: "--panel") : theme.ink("--text"))
    }

    private var line: Color {
        disabled ? theme.over("--border-strong", 0.5, on: "--panel") : theme.color("--border-strong")
    }
}

/// The look WebKit gives form controls in the current app: not theme tokens, so they are kept here, as measured.
enum WebKitDefaults {
    static let placeholder = "#a9a9a9"
    static let checkboxBorderLight = "#808080"
    static let checkboxBorderDark = "#9a9a9a"
    static let checkboxFillLight = "#ffffff"
    static let checkboxFillDark = "#1e1e1e"
}

/// WebKit's 12-point checkbox: a 1.5-point border with slightly rounded corners and a check mark when on. A disabled
/// one is drawn at half strength (not measured: beta.7 disables it only for the moment a write runs).
struct WebKitCheckbox: View {
    @Environment(\.theme) private var theme

    let checked: Bool
    let dark: Bool
    var disabled = false

    var body: some View {
        let border = Theme.parse(dark ? WebKitDefaults.checkboxBorderDark : WebKitDefaults.checkboxBorderLight)
        let fill = Theme.parse(dark ? WebKitDefaults.checkboxFillDark : WebKitDefaults.checkboxFillLight)
        ZStack {
            RoundedRectangle(cornerRadius: 2.5, style: .circular)
                .fill(checked ? theme.color("--accent") : Color(nsColor: fill ?? .white))
            RoundedRectangle(cornerRadius: 2.5, style: .circular)
                .strokeBorder(checked ? theme.color("--accent") : Color(nsColor: border ?? .gray), lineWidth: 1.5)
            if checked {
                Icon(name: "check", size: 10, strokeWidth: 3)
                    .foregroundStyle(Color.white)
            }
        }
        .frame(width: 12, height: 12)
        .opacity(disabled ? 0.5 : 1)
    }
}
