// A box painted the way WebKit paints a background at a fractional place: its edges rounded to whole device pixels,
// while the text inside keeps its exact place. SwiftUI would blend the fractional edges instead.

import SwiftUI

extension View {
    /// A rounded box behind the view, snapped to device pixels, with an optional shadow (CSS box-shadow 0 y blur).
    func snappedBox(_ fill: Color, cornerRadius: CGFloat, border: Color? = nil,
                    shadow: (offsetY: CGFloat, blur: CGFloat, alpha: Double)? = nil) -> some View {
        background(SnappedBox(fill: fill, cornerRadius: cornerRadius, border: border, shadow: shadow))
    }
}

private struct SnappedBox: View {
    @Environment(\.displayScale) private var displayScale

    let fill: Color
    let cornerRadius: CGFloat
    let border: Color?
    let shadow: (offsetY: CGFloat, blur: CGFloat, alpha: Double)?

    var body: some View {
        GeometryReader { proxy in
            let frame = proxy.frame(in: .global)
            let snap = { (value: CGFloat) in (value * displayScale).rounded() / displayScale }
            let left = snap(frame.minX) - frame.minX, top = snap(frame.minY) - frame.minY
            let width = snap(frame.maxX) - snap(frame.minX), height = snap(frame.maxY) - snap(frame.minY)
            ZStack {
                if let shadow {
                    Color.clear
                        .boxShadow(radius: cornerRadius, offsetY: shadow.offsetY, blur: shadow.blur,
                                   alpha: shadow.alpha)
                }
                RoundedRectangle(cornerRadius: cornerRadius, style: .circular).fill(fill)
                if let border {
                    BorderRing(cornerRadius: cornerRadius).fill(border, style: FillStyle(eoFill: true))
                }
            }
            .frame(width: width, height: height)
            .offset(x: left, y: top)
        }
    }
}
