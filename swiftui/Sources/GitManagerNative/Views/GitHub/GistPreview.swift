// Create Gist's .preview: the text in the 11.5-point code font on --editor-bg, line-height 1.45 (16 points as WebKit
// lays it out), 6 by 8 points in, at most 220 tall with the page's classic scrollbars (10 points, a see-through
// round thumb, no track) both ways while it overflows. An NSTextView, so a long file scrolls and selects natively.

import AppKit
import SwiftUI

struct GistPreview: View {
    @Environment(\.theme) private var theme

    let text: String

    var body: some View {
        // A <pre> lays out no line after a final newline; NSTextView would.
        let shown = text.hasSuffix("\n") ? String(text.dropLast()) : text
        GistPreviewText(text: shown, ink: theme.textColor("--text"),
                        thumb: theme.translucent("--text-dim", alpha: 0.35))
            .padding(1)
            .frame(height: min(220, GistPreviewText.height(of: shown)))
            .background(RoundedRectangle(cornerRadius: 6, style: .circular).fill(theme.color("--editor-bg")))
            .borderRing(theme.color("--border"), cornerRadius: 6)
    }
}

private struct GistPreviewText: NSViewRepresentable {
    let text: String
    let ink: NSColor
    let thumb: CGColor

    static let lineHeight: CGFloat = 16
    static let inset = NSSize(width: 8, height: 6)

    /// The box's height for `text`: its lines, the padding and the border.
    static func height(of text: String) -> CGFloat {
        let lines = text.isEmpty ? 1 : text.reduce(1) { $1 == "\n" ? $0 + 1 : $0 }
        return CGFloat(lines) * lineHeight + inset.height * 2 + 2
    }

    final class Coordinator {
        var ink: NSColor?
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scroll = CornerlessScrollView()
        scroll.drawsBackground = false
        scroll.borderType = .noBorder
        scroll.scrollerStyle = .legacy
        scroll.hasVerticalScroller = true
        scroll.hasHorizontalScroller = true
        scroll.autohidesScrollers = true
        scroll.verticalScroller = PageScroller()
        scroll.horizontalScroller = PageScroller()
        // TextKit 1: TextKit 2 drops the fixed line height once the text has a baseline offset (measured).
        let view = NSTextView(usingTextLayoutManager: false)
        view.isEditable = false
        view.isSelectable = true
        view.drawsBackground = false
        view.textContainerInset = Self.inset
        view.textContainer?.lineFragmentPadding = 0
        view.textContainer?.widthTracksTextView = false
        view.textContainer?.containerSize = NSSize(width: CGFloat.greatestFiniteMagnitude,
                                                   height: CGFloat.greatestFiniteMagnitude)
        view.isHorizontallyResizable = true
        view.isVerticallyResizable = true
        view.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        scroll.documentView = view
        return scroll
    }

    func updateNSView(_ scroll: NSScrollView, context: Context) {
        (scroll.verticalScroller as? PageScroller)?.thumb = thumb
        (scroll.horizontalScroller as? PageScroller)?.thumb = thumb
        guard let view = scroll.documentView as? NSTextView,
              view.string != text || context.coordinator.ink != ink else {
            return
        }
        context.coordinator.ink = ink
        let font = CodeFont.font(11.5)
        let paragraph = NSMutableParagraphStyle()
        paragraph.minimumLineHeight = Self.lineHeight
        paragraph.maximumLineHeight = Self.lineHeight
        // tab-size: 4.
        paragraph.defaultTabInterval = 4 * (" " as NSString).size(withAttributes: [.font: font]).width
        paragraph.tabStops = []
        // AppKit puts a line's extra height above the text; CSS splits it above and below.
        let natural = NSLayoutManager().defaultLineHeight(for: font)
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font, .foregroundColor: ink, .paragraphStyle: paragraph,
            .baselineOffset: (Self.lineHeight - natural) / 2,
        ]
        view.defaultParagraphStyle = paragraph
        view.typingAttributes = attributes
        view.textStorage?.setAttributedString(NSAttributedString(string: text, attributes: attributes))
        view.sizeToFit()
    }
}

/// ::-webkit-scrollbar as app.css styles it: 10 points, no track, the thumb a 6-point round bar 2 points in.
private final class PageScroller: NSScroller {
    var thumb: CGColor = .clear {
        didSet {
            needsDisplay = true
        }
    }

    override class var isCompatibleWithOverlayScrollers: Bool {
        false
    }

    override class func scrollerWidth(for controlSize: NSControl.ControlSize, scrollerStyle: NSScroller.Style)
        -> CGFloat {
        10
    }

    override func draw(_ dirtyRect: NSRect) {
        // The thumb as WebKit places it: its share of the track in whole points, moved along by the scroll.
        let vertical = bounds.height > bounds.width
        let track = vertical ? bounds.height : bounds.width
        let length = max(20, (track * knobProportion).rounded())
        let start = ((track - length) * doubleValue).rounded()
        let whole = vertical
            ? CGRect(x: 0, y: start, width: bounds.width, height: length)
            : CGRect(x: start, y: 0, width: length, height: bounds.height)
        let knob = whole.insetBy(dx: 2, dy: 2)
        guard knobProportion < 1, knob.width > 0, knob.height > 0,
              let context = NSGraphicsContext.current?.cgContext else {
            return
        }
        context.setFillColor(thumb)
        context.addPath(CGPath(roundedRect: knob, cornerWidth: 3, cornerHeight: 3, transform: nil))
        context.fillPath()
    }
}

/// No corner square where the two scrollbars meet: WebKit leaves it see-through.
private final class CornerlessScrollView: NSScrollView {
    override func draw(_ dirtyRect: NSRect) {}

    // AppKit adds a corner view of its own, sized for its 15-point scrollers.
    override func tile() {
        super.tile()
        for subview in subviews where !(subview is NSClipView) && !(subview is NSScroller) {
            subview.isHidden = true
        }
    }
}
