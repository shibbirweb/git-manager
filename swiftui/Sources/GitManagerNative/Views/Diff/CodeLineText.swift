// One line of code as the current app's editor draws it: JetBrains Mono 13 with ligatures off (app.css sets "liga"
// 0 and "calt" 0), the syntax colors of its spans, and the changed text marked behind it (cm-changedText). Drawn
// with Core Text into the diff canvas, on the baseline WebKit uses for a 16.25-point line in a 16-point row.

import AppKit
import CoreText
import NativeCore

struct CodeFonts {
    let regular: NSFont
    let italic: NSFont
    let bold: NSFont

    static let shared = CodeFonts(size: 13)

    init(size: CGFloat) {
        regular = CodeFonts.font("JetBrainsMono-Regular", size)
        italic = CodeFonts.font("JetBrainsMono-Italic", size)
        bold = CodeFonts.font("JetBrainsMono-Regular_SemiBold", size)
    }

    /// The face without ligatures or contextual alternates, so "=>" stays two signs as on the page.
    private static func font(_ name: String, _ size: CGFloat) -> NSFont {
        let base = NSFont(name: name, size: size) ?? .monospacedSystemFont(ofSize: size, weight: .regular)
        let features: [[NSFontDescriptor.FeatureKey: Any]] = ["liga", "calt"].map { tag in
            [
                NSFontDescriptor.FeatureKey(rawValue: kCTFontOpenTypeFeatureTag as String): tag,
                NSFontDescriptor.FeatureKey(rawValue: kCTFontOpenTypeFeatureValue as String): 0,
            ]
        }
        let descriptor = base.fontDescriptor.addingAttributes([.featureSettings: features])
        return NSFont(descriptor: descriptor, size: size) ?? base
    }
}

enum CodeLineText {
    /// The baseline below a row's top, measured against the page's glyphs.
    static let baseline: CGFloat = 12
    /// One character's width in the code font (7.8 points at 13).
    static let advance: CGFloat = (" " as NSString).size(withAttributes: [.font: CodeFonts.shared.regular]).width

    static func line(_ text: String, spans: [SyntaxSpans.Span], colors: CanvasColors) -> CTLine {
        let fonts = CodeFonts.shared
        let string = NSMutableAttributedString(string: text, attributes: [
            .font: fonts.regular, .foregroundColor: colors.textColor("--text"),
        ])
        let length = (text as NSString).length
        for span in spans where span.to <= length {
            let range = NSRange(location: span.from, length: span.to - span.from)
            if let token = span.style.colorToken {
                string.addAttribute(.foregroundColor, value: colors.textColor(token), range: range)
            }
            if span.style.italic {
                string.addAttribute(.font, value: fonts.italic, range: range)
            } else if span.style.bold {
                string.addAttribute(.font, value: fonts.bold, range: range)
            }
            if span.style.underline {
                string.addAttribute(.underlineStyle, value: NSUnderlineStyle.single.rawValue, range: range)
            }
        }
        return CTLineCreateWithAttributedString(string)
    }

    /// Draws `line` with its left edge at `x` in a row whose top is `rowTop`, in a flipped context.
    static func draw(_ line: CTLine, x: CGFloat, rowTop: CGFloat, in context: CGContext) {
        context.saveGState()
        context.textMatrix = CGAffineTransform(scaleX: 1, y: -1)
        context.textPosition = CGPoint(x: x, y: rowTop + baseline)
        CTLineDraw(line, context)
        context.restoreGState()
    }

    /// The changed text's boxes behind the line: 17 points from a point above the row (the font's content area as
    /// the page lays it out), 2-point corners, edges on whole device pixels. The point above the row lies over the
    /// row before, so it takes `colors.above`; the rest lies over this line's tint.
    /// The canvas pixel columns each changed-word box covers (its edges snapped as drawMarks draws them).
    static func markColumns(_ marks: [Range<Int>], of line: CTLine, x: CGFloat, scale: CGFloat) -> [Range<Int>] {
        marks.map { mark in
            let start = Int(((x + CTLineGetOffsetForStringIndex(line, mark.lowerBound, nil)) * scale).rounded())
            let end = Int(((x + CTLineGetOffsetForStringIndex(line, mark.upperBound, nil)) * scale).rounded())
            return start..<max(start, end)
        }
    }

    static func drawMarks(
        _ marks: [Range<Int>], of line: CTLine, x: CGFloat, rowTop: CGFloat,
        colors: (above: NSColor, onLine: NSColor), scale: CGFloat
    ) {
        let snap = { (value: CGFloat) in (value * scale).rounded() / scale }
        for mark in marks {
            let start = snap(x + CTLineGetOffsetForStringIndex(line, mark.lowerBound, nil))
            let end = snap(x + CTLineGetOffsetForStringIndex(line, mark.upperBound, nil))
            let rect = NSRect(x: start, y: rowTop - 1, width: end - start, height: 17)
            let path = NSBezierPath(roundedRect: rect, xRadius: 2, yRadius: 2)
            for (color, band) in [(colors.above, NSRect(x: start, y: rowTop - 1, width: rect.width, height: 1)),
                                  (colors.onLine, NSRect(x: start, y: rowTop, width: rect.width, height: 16))] {
                NSGraphicsContext.saveGraphicsState()
                band.clip()
                color.setFill()
                path.fill()
                NSGraphicsContext.restoreGraphicsState()
            }
        }
    }
}
