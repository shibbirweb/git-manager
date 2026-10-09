// Text placed as WebKit places it. WebKit gives a text its exact advance width (in 1/64 of a point) and draws its
// glyphs at their exact position (a quarter pixel apart); SwiftUI rounds a text's frame up to the pixel and draws it
// on a whole pixel. So every item after a label lands up to a point further along, and a label after another one
// looks a quarter pixel off. ExactText takes the exact width and moves its glyphs to their exact place: a leading
// space with a kern that cancels it but the fraction (Core Text sets glyphs at fractional positions within a line,
// which a view's offset cannot do). Checked against WebKit in a harness: the same pixels at every quarter pixel.

import AppKit
import SwiftUI

struct ExactText: View {
    let text: String
    var size: CGFloat = 12
    var weight: NSFont.Weight = .regular
    /// Tabular digits (font-variant-numeric: tabular-nums).
    var tabular = false
    /// letter-spacing, which WebKit adds after every character, the last one included.
    var tracking: CGFloat = 0
    /// Another face than the UI font, such as the mono one (size, weight and tabular then do not apply).
    var face: NSFont?

    /// Where the layout puts the text past the pixel SwiftUI draws it on, in points (-0.25 to 0.25).
    @State private var fraction: CGFloat = 0

    var body: some View {
        let font = face ?? PageFont.ui(size, weight: weight, tabular: tabular)
        // letter-spacing would also space the leading space, so tracked text stays on the pixel.
        Text(Self.shifted(text, font: font, by: tracking == 0 ? fraction : 0))
            .font(Font(font))
            .tracking(tracking)
            .lineLimit(1)
            // A negative fraction starts a pixel to the left and kerns the rest of the way.
            .offset(x: fraction < 0 && tracking == 0 ? -0.5 : 0)
            .exactWidth(Self.width(text, font: font, tracking: tracking))
            .modifier(PixelFraction(fraction: $fraction))
    }

    /// The advance width in LayoutUnits (1/64 point).
    static func width(_ text: String, font: NSFont, tracking: CGFloat = 0) -> CGFloat {
        let advance = (text as NSString).size(withAttributes: [.font: font]).width
        return ((advance + tracking * CGFloat(text.count)) * 64).rounded() / 64
    }

    /// `text` cut as text-overflow: ellipsis cuts it in WebKit: whole characters, spaces kept, then the ellipsis.
    static func cut(_ text: String, width maxWidth: CGFloat, font: NSFont) -> String {
        if width(text, font: font) <= maxWidth {
            return text
        }
        var prefix = text
        while !prefix.isEmpty && width(prefix + "\u{2026}", font: font) > maxWidth {
            prefix.removeLast()
        }
        return prefix + "\u{2026}"
    }

    /// The text after a space kerned to `fraction` (or `fraction` + half a point when it is negative).
    static func shifted(_ text: String, font: NSFont, by fraction: CGFloat) -> AttributedString {
        if fraction == 0 {
            return AttributedString(text)
        }
        let space = (" " as NSString).size(withAttributes: [.font: font]).width
        var lead = AttributedString(" ")
        lead.kern = (fraction < 0 ? fraction + 0.5 : fraction) - space
        return lead + AttributedString(text)
    }
}

/// Reports the layout's x past the 2x pixel SwiftUI draws the view on.
private struct PixelFraction: ViewModifier {
    @Binding var fraction: CGFloat

    func body(content: Content) -> some View {
        content.background(GeometryReader { proxy in
            let x = proxy.frame(in: .global).minX
            Color.clear
                .onAppear { update(x) }
                .onChange(of: x) { update($0) }
        })
    }

    private func update(_ x: CGFloat) {
        let value = ((x - SVGSnap.pixel(x)) * 64).rounded() / 64
        if value != fraction {
            fraction = value
        }
    }
}

extension View {
    /// Takes `width` in the layout, as the page does, where SwiftUI would round the text's width up to the pixel.
    /// With less room the text gets what is offered and truncates as before.
    func exactWidth(_ width: CGFloat) -> some View {
        ExactWidthLayout(width: width) {
            self
        }
    }
}

private struct ExactWidthLayout: Layout {
    let width: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let height = subviews.first?.sizeThatFits(.unspecified).height ?? 0
        return CGSize(width: min(width, proposal.width ?? width), height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let text = subviews.first else {
            return
        }
        // Room for the whole text: its own size, a fraction of a point past the frame; else truncated to the frame.
        let fits = bounds.width >= width - 1.0 / 128
        let size = fits ? text.sizeThatFits(.unspecified) : CGSize(width: bounds.width, height: bounds.height)
        text.place(at: CGPoint(x: bounds.minX, y: bounds.midY), anchor: .leading, proposal: ProposedViewSize(size))
    }
}
