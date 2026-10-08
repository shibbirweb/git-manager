// Where WebKit paints an inline <svg>: RenderSVGRoot translates its content to the box's position rounded to whole
// CSS points (roundedIntPoint, halves up), while text and backgrounds keep their half points at 2x. SwiftUI draws a
// view at its position rounded to the pixel, so an icon laid out on x.5 lands half a point up or left of the page's.
// Checked in a WKWebView harness: boxes at 40.5, 70.25 and 100.75 paint their icon at 41, 70 and 101.

import SwiftUI

extension View {
    /// Moves the view's drawing (not its layout) to the whole point WebKit would paint an <svg> at.
    func svgSnap(biasY: CGFloat = 0) -> some View {
        modifier(SVGSnap(biasY: biasY))
    }

    /// Where the page lays out the icons below this view, against SwiftUI's layout (see SVGBiasKey).
    func svgBias(_ biasY: CGFloat) -> some View {
        environment(\.svgBiasY, biasY)
    }
}

/// The page's layout is not always SwiftUI's to the fraction: what WebKit anchors to the bottom of the window (the
/// status bar, the commit box, the lower activity items) sits a quarter point higher than in SwiftUI, and the
/// welcome column is centered a fraction higher. Text and lines snap to the same pixels either way; an icon's whole
/// point does not, so containers tell their icons the page's offset (measured: every icon there lands on the whole
/// point below the half point SwiftUI lays it out on).
private struct SVGBiasKey: EnvironmentKey {
    static let defaultValue: CGFloat = 0
}

extension EnvironmentValues {
    var svgBiasY: CGFloat {
        get { self[SVGBiasKey.self] }
        set { self[SVGBiasKey.self] = newValue }
    }
}

struct SVGSnap: ViewModifier {
    var biasY: CGFloat = 0

    func body(content: Content) -> some View {
        if #available(macOS 14, *) {
            content.visualEffect { [biasY] effect, proxy in
                effect.offset(SVGSnap.shift(proxy.frame(in: .global).origin, biasY: biasY))
            }
        } else {
            content
        }
    }

    /// From where SwiftUI draws (the origin rounded to the 2x pixel) to where the page draws.
    nonisolated static func shift(_ origin: CGPoint, biasY: CGFloat) -> CGSize {
        CGSize(
            width: whole(origin.x) - pixel(origin.x),
            height: whole(origin.y + biasY) - pixel(origin.y)
        )
    }

    /// LayoutUnit::round: halves go up. A hair of tolerance absorbs floating point positions.
    nonisolated static func whole(_ value: CGFloat) -> CGFloat {
        (value + 0.5 + 1.0 / 128).rounded(.down)
    }

    nonisolated static func pixel(_ value: CGFloat) -> CGFloat {
        (value * 2).rounded() / 2
    }
}
