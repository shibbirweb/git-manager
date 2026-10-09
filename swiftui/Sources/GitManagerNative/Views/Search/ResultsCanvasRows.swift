// One row of the results canvas (ResultsCanvas.swift), placed as the SwiftUI rows were (ResultRowLayout):
// a file heading its matches (the icon, the semibold name, the folder, the count) or a matching line (its number,
// the line in the code font over its matches' boxes). Texts sit at their exact fractional places, as ExactText put
// them, and are centered in the row as WebKit centers them (baseline).

import AppKit
import NativeCore

extension ResultsCanvas {
    func drawRow(
        _ row: TextRow, selected: Bool, top: CGFloat, content: Content, colors: CanvasColors, context: CGContext,
        scale: CGFloat, origin: CGPoint
    ) {
        let left = Self.paddingSide
        let right = rowsRight
        switch row {
        case .file(_, _, let name, let folder, let count):
            let nameFont = PageFont.ui(13, weight: .semibold)
            let folderFont = PageFont.ui(12)
            let countFont = PageFont.ui(11)
            let countText = "\(count)"
            let folderWidth = ExactText.width(folder, font: folderFont)
            let layout = ResultRowLayout.file(
                left: Double(left), right: Double(right), nameWidth: Double(ExactText.width(name, font: nameFont)),
                folderWidth: Double(folderWidth), countWidth: Double(ExactText.width(countText, font: countFont))
            )
            drawIcon(x: CGFloat(layout.icon), rowTop: top, origin: origin, colors: colors, context: context,
                     scale: scale)
            drawText(name, font: nameFont, token: "--text", x: CGFloat(layout.name), rowTop: top, colors: colors,
                     context: context, scale: scale)
            let room = CGFloat(layout.folderRoom)
            let shown = room < folderWidth ? ExactText.cut(folder, width: room, font: folderFont) : folder
            drawText(shown, font: folderFont, token: "--text-faint", x: CGFloat(layout.folder), rowTop: top,
                     colors: colors, context: context, scale: scale)
            drawText(countText, font: countFont, token: "--text-faint", x: CGFloat(layout.count), rowTop: top,
                     colors: colors, context: context, scale: scale)
        case .line(_, _, let number, _, let parts):
            let numberFont = CodeFont.font(11.5)
            let codeFont = CodeFont.font(13)
            let numberText = "\(number)"
            let layout = ResultRowLayout.line(left: Double(left),
                                              numberWidth: Double(ExactText.width(numberText, font: numberFont)))
            drawText(numberText, font: numberFont, token: "--editor-line-number", x: CGFloat(layout.number),
                     rowTop: top, colors: colors, context: context, scale: scale)
            let textX = CGFloat(layout.text)
            let clip = CGRect(x: textX, y: top, width: max(0, right - CGFloat(ResultRowLayout.padding) - textX),
                              height: CGFloat(ResultRowLayout.rowHeight))
            drawMarks(parts, x: textX, rowTop: top, font: codeFont, colors: colors, scale: scale, clip: clip)
            let text = ResultText.ellipsized(parts.map(\.text).joined(), width: content.textWidth)
            drawText(text, font: codeFont, token: "--text", x: textX, rowTop: top, colors: colors, context: context,
                     scale: scale, clip: clip)
        }
    }

    /// One text with its first glyph at `x`, its line box centered in the row at `rowTop`.
    private func drawText(
        _ text: String, font: NSFont, token: String, x: CGFloat, rowTop: CGFloat, colors: CanvasColors,
        context: CGContext, scale: CGFloat, clip: CGRect? = nil
    ) {
        guard !text.isEmpty else {
            return
        }
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [
            .font: font, .foregroundColor: colors.textColor(token),
        ]))
        let baseline = Self.baseline(font: font, rowTop: rowTop)
        // GlyphCompositor inks from 4 points above its row top to 20 below: a row top 14 points above the baseline
        // holds 13-point text.
        glyphs.draw(line, x: x, rowTop: baseline - 14, clip: clip ?? bounds, into: context, scale: scale,
                    layer: true, baseline: baseline)
    }

    /// The baseline of `font`'s text centered in the 26-point row at `rowTop` as WebKit centers it: its ascent and
    /// descent rounded to whole points, the box they make centered, the baseline the rounded ascent below its top.
    static func baseline(font: NSFont, rowTop: CGFloat) -> CGFloat {
        let ascent = font.ascender.rounded()
        let descent = (-font.descender).rounded()
        return rowTop + (CGFloat(ResultRowLayout.rowHeight) - ascent - descent) / 2 + ascent
    }

    /// The matches' boxes under a line (cm-changedText's look in the list): 17 points tall, centered on the row,
    /// 2-point corners, edges on the 2x pixel, --diff-inline stored as the page stores a translucent fill in its
    /// see-through layer (CanvasColors.layerFill: the converted bytes times the 8-bit alpha). Over the selection's
    /// layer, and under the text, they come out a step off in one channel (as SwiftUI's boxes did there).
    private func drawMarks(
        _ parts: [TextPart], x: CGFloat, rowTop: CGFloat, font: NSFont, colors: CanvasColors, scale: CGFloat,
        clip: CGRect
    ) {
        let fill = colors.layerFill("--diff-inline")
        guard fill[3] > 0 else {
            return
        }
        let color = fill.prefix(3).map { $0 * 255 / fill[3] }
        let pixelClip = CGRect(x: clip.minX * scale, y: clip.minY * scale, width: clip.width * scale,
                               height: clip.height * scale)
        var start: CGFloat = 0
        for part in parts {
            let width = ExactText.width(part.text, font: font)
            if part.match {
                let left = ((x + start) * scale).rounded()
                let right = ((x + start + width) * scale).rounded()
                let rect = CGRect(x: left, y: (rowTop + 4.5) * scale, width: right - left, height: 17 * scale)
                let path = CGPath(roundedRect: rect, cornerWidth: 2 * scale, cornerHeight: 2 * scale, transform: nil)
                surface.blend(color, alpha: fill[3] / 255, path: path, clip: pixelClip)
            }
            start += width
        }
    }

    /// The 13-point file icon, its origin on the whole point of the window as the page draws SVGs.
    private func drawIcon(
        x: CGFloat, rowTop: CGFloat, origin: CGPoint, colors: CanvasColors, context: CGContext, scale: CGFloat
    ) {
        let size = CGFloat(ResultRowLayout.iconSize)
        let left = SVGSnap.whole(origin.x + x) - origin.x
        let top = SVGSnap.whole(origin.y + rowTop + (CGFloat(ResultRowLayout.rowHeight) - size) / 2
                                + SearchEverywhereView.iconLift) - origin.y
        context.saveGState()
        context.translateBy(x: 0, y: CGFloat(context.height))
        context.scaleBy(x: scale, y: -scale)
        context.translateBy(x: left, y: top)
        context.scaleBy(x: size / 24, y: size / 24)
        context.setStrokeColor(colors.nsColor("--text-dim").cgColor)
        context.setLineWidth(2)
        context.setLineCap(.round)
        context.setLineJoin(.round)
        for path in IconPaths.paths("file") {
            context.addPath(path)
            context.strokePath()
        }
        context.restoreGState()
    }
}
