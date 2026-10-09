// Small controls shared by the header, the activity bars and the status bar, sized like the current app's CSS
// (.icon-btn, .pill, .divider, the status bar's .item) as the layout snapshots in swiftui/Reference record them.

import SwiftUI

/// A borderless button with an icon: 28 x 28 with 6-point corners in the header (.icon-btn).
struct IconButton<Label: View>: View {
    @Environment(\.theme) private var theme

    var width: CGFloat = 28
    var height: CGFloat = 28
    var cornerRadius: CGFloat = 6
    var disabled = false
    /// The surface under the button, for its disabled look.
    var surface = "--panel"
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: action) {
            label()
                .frame(width: width, height: height)
                .contentShape(RoundedRectangle(cornerRadius: cornerRadius, style: .circular))
        }
        .buttonStyle(.plain)
        // The current app's .icon-btn:disabled is 40% opacity, drawn as the solid color WebKit blends from it.
        // SwiftUI's .disabled() would dim the button once more, so clicks are blocked without it.
        .allowsHitTesting(!disabled)
        .foregroundStyle(disabled ? theme.over("--text", 0.4, on: surface) : theme.ink("--text"))
    }
}

/// The header's folder and branch buttons (.pill): 28 points tall, 8 points of padding, 6 between the parts.
struct PillButton<Label: View>: View {
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                label()
            }
            .padding(.horizontal, 8)
            .frame(height: 28)
            .contentShape(RoundedRectangle(cornerRadius: 6, style: .circular))
        }
        .buttonStyle(.plain)
    }
}

/// The header's 1 x 18 separator, with 4 points of space on each side (.divider).
struct HeaderDivider: View {
    @Environment(\.theme) private var theme

    var body: some View {
        theme.color("--border-strong")
            .frame(width: 1, height: 18)
            .padding(.horizontal, 4)
    }
}

/// Centers its content in the space offered as WebKit lays out a centered flex column: horizontally rounded down to
/// whole points (220.5 becomes 220), vertically the free space rounded down to whole points, then halved, so a column
/// can sit on a half point (measured with and without the terminal panel); SwiftUI would keep any fraction.
struct WholePointCenter: ViewModifier {
    func body(content: Content) -> some View {
        WholePointCenterLayout {
            content
        }
    }
}

private struct WholePointCenterLayout: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        proposal.replacingUnspecifiedDimensions()
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            let origin = CGPoint(
                x: bounds.minX + ((bounds.width - size.width) / 2).rounded(.down),
                y: bounds.minY + (bounds.height - size.height).rounded(.down) / 2
            )
            subview.place(at: origin, proposal: ProposedViewSize(size))
        }
    }
}

/// A CSS border as WebKit paints a rounded one: the ring between the box and the box inset by the border width,
/// filled, with circular corners. A stroked border comes out a step lighter along its straight edges.
struct BorderRing: Shape {
    var cornerRadius: CGFloat
    var width: CGFloat = 1

    func path(in rect: CGRect) -> Path {
        var path = Path(roundedRect: rect, cornerRadius: cornerRadius, style: .circular)
        let inner = rect.insetBy(dx: width, dy: width)
        path.addPath(Path(roundedRect: inner, cornerRadius: max(0, cornerRadius - width), style: .circular))
        return path
    }
}

extension View {
    /// The border of a box with `cornerRadius` corners, in `color`, drawn over it.
    func borderRing(_ color: Color, cornerRadius: CGFloat, width: CGFloat = 1) -> some View {
        overlay(BorderRing(cornerRadius: cornerRadius, width: width).fill(color, style: FillStyle(eoFill: true)))
    }
}
