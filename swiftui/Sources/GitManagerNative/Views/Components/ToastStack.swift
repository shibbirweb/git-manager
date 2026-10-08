// The toasts (src/lib/ui/Toasts.svelte), measured in beta.7 with inspect_elements: 16 points from the window's
// right and bottom edges, 8 apart, at most 420 wide and all as wide as the widest. Each has 8-point corners, a
// 1-point --border-strong line with a 4-point left edge in its kind's color, --panel, and the --shadow.

import NativeCore
import SwiftUI

struct ToastStack: View {
    @ObservedObject var center: ToastCenter

    var body: some View {
        VStack(spacing: 8) {
            ForEach(center.items) { toast in
                ToastView(toast: toast, close: { center.dismiss(toast.id) }, runAction: { center.runAction(toast.id) })
            }
        }
        .frame(maxWidth: 420)
        .fixedSize(horizontal: true, vertical: false)
        .padding([.trailing, .bottom], 16)
    }
}

private struct ToastView: View {
    @Environment(\.theme) private var theme
    @Environment(\.colorScheme) private var colorScheme

    let toast: Toast
    let close: () -> Void
    let runAction: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text(toast.title)
                    .font(PageFont.font(13, weight: .semibold))
                    .foregroundStyle(theme.ink("--text"))
                if let detail = toast.detail {
                    // pre-wrap in a box of at most 160 points that scrolls past that.
                    ClampedHeight(maxHeight: 160) {
                        detailText(detail).hidden()
                        ScrollView {
                            detailText(detail)
                        }
                        .scrollIndicators(.automatic)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let action = toast.action {
                // .btn.small: 24 points tall, 8 points of padding, 12-point text.
                BorderedButton(height: 24, action: runAction) {
                    Text(action.label)
                        .font(.system(size: 12))
                        .padding(.horizontal, 9)
                }
                .fixedSize()
            }
            IconButton(width: 26, height: 22, action: close) {
                Icon(name: "x", size: 14)
            }
        }
        .padding(.top, 10)
        .padding(.bottom, 10)
        .padding(.leading, 12 + 4)
        .padding(.trailing, 8 + 1)
        .background(ToastFrame(edge: theme.color(edgeToken), line: theme.color("--border-strong"),
                               fill: theme.color("--panel")))
        .compositingGroup()
        .shadow(color: .black.opacity(colorScheme == .dark ? 0.5 : 0.16), radius: 14, x: 0, y: 8)
    }

    private func detailText(_ detail: String) -> some View {
        Text(detail)
            .font(.custom("JetBrains Mono", size: 11.5))
            .foregroundStyle(theme.ink("--text-dim"))
            .textSelection(.enabled)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var edgeToken: String {
        switch toast.kind {
        case .success:
            return "--success"
        case .error:
            return "--danger"
        case .warning:
            return "--warning"
        case .info:
            return "--accent"
        }
    }
}

/// As tall as its first view (measured, not drawn) up to `maxHeight`; the second view fills that height. The toasts
/// sit in an overlay that offers any height, so a plain maximum would never make the detail scroll.
private struct ClampedHeight: Layout {
    let maxHeight: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let measured = subviews.first else {
            return .zero
        }
        let size = measured.sizeThatFits(ProposedViewSize(width: proposal.width, height: nil))
        return CGSize(width: proposal.width ?? size.width, height: min(size.height, maxHeight))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for subview in subviews {
            subview.place(at: bounds.origin, proposal: ProposedViewSize(bounds.size))
        }
    }
}

/// The toast's box: the outer 8-point rounded shape in the line color, the left edge in the kind's color (its
/// joins with the top and bottom lines run diagonally, as CSS draws borders), and the inside in --panel. The inner
/// corners are elliptical: 8 minus each side's border width.
private struct ToastFrame: View {
    let edge: Color
    let line: Color
    let fill: Color

    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size
            ZStack {
                RoundedRectangle(cornerRadius: 8, style: .circular).fill(line)
                RoundedRectangle(cornerRadius: 8, style: .circular).fill(edge)
                    .mask(Path { path in
                        path.addLines([
                            .zero, CGPoint(x: 4, y: 1),
                            CGPoint(x: 4, y: size.height - 1), CGPoint(x: 0, y: size.height),
                        ])
                        path.closeSubpath()
                    })
                InnerBox(left: 4, other: 1, radius: 8).fill(fill)
            }
        }
    }
}

/// A rectangle inset by the border widths, with corners of radius minus the neighboring border widths.
private struct InnerBox: Shape {
    let left: CGFloat
    let other: CGFloat
    let radius: CGFloat

    func path(in rect: CGRect) -> Path {
        let box = CGRect(x: left, y: other, width: rect.width - left - other, height: rect.height - other * 2)
        let leftX = radius - left
        let rightX = radius - other
        let cornerY = radius - other
        // Bezier handles of a quarter ellipse.
        let kappa: CGFloat = 0.5523
        var path = Path()
        path.move(to: CGPoint(x: box.minX + leftX, y: box.minY))
        path.addLine(to: CGPoint(x: box.maxX - rightX, y: box.minY))
        path.addCurve(to: CGPoint(x: box.maxX, y: box.minY + cornerY),
                      control1: CGPoint(x: box.maxX - rightX * (1 - kappa), y: box.minY),
                      control2: CGPoint(x: box.maxX, y: box.minY + cornerY * (1 - kappa)))
        path.addLine(to: CGPoint(x: box.maxX, y: box.maxY - cornerY))
        path.addCurve(to: CGPoint(x: box.maxX - rightX, y: box.maxY),
                      control1: CGPoint(x: box.maxX, y: box.maxY - cornerY * (1 - kappa)),
                      control2: CGPoint(x: box.maxX - rightX * (1 - kappa), y: box.maxY))
        path.addLine(to: CGPoint(x: box.minX + leftX, y: box.maxY))
        path.addCurve(to: CGPoint(x: box.minX, y: box.maxY - cornerY),
                      control1: CGPoint(x: box.minX + leftX * (1 - kappa), y: box.maxY),
                      control2: CGPoint(x: box.minX, y: box.maxY - cornerY * (1 - kappa)))
        path.addLine(to: CGPoint(x: box.minX, y: box.minY + cornerY))
        path.addCurve(to: CGPoint(x: box.minX + leftX, y: box.minY),
                      control1: CGPoint(x: box.minX, y: box.minY + cornerY * (1 - kappa)),
                      control2: CGPoint(x: box.minX + leftX * (1 - kappa), y: box.minY))
        path.closeSubpath()
        return path
    }
}
