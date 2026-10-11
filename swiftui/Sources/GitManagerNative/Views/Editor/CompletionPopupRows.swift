// The completion popup's list (CompletionPopupView.swift): each row's background when selected, its letter badge
// (features.ts BADGES: f m p c v n i t e c in a circle of the type's token at 18%, none for keywords and words), the
// label in the code font with the typed letters in --accent at weight 600, the detail in --text-faint; "···" above
// or below a list cut to 100 options, and the page's scrollbar when the list scrolls.

import AppKit
import NativeCore

extension CompletionPopupView {
    /// Badge letter and color token by completion type.
    static let badges: [String: (letter: String, token: String)] = [
        "function": ("f", "--warning"), "method": ("m", "--warning"), "property": ("p", "--warning"),
        "class": ("c", "--accent"), "variable": ("v", "--accent"), "namespace": ("n", "--accent"),
        "interface": ("i", "--success"), "type": ("t", "--success"), "enum": ("e", "--success"),
        "constant": ("c", "--danger"),
    ]
    /// The label's baseline below the row's top, and the badge's top.
    static let labelBaseline: CGFloat = 15
    static let badgeTop: CGFloat = 5.1

    static let codeFont = CodeFont.font(13)
    static let matchedFont = NSFont(name: "JetBrainsMono-Regular_SemiBold", size: 13) ?? codeFont
    static let badgeFont = PageFont.ui(9.36, weight: .semibold)

    func drawList(_ content: Content, context: CGContext, colors: CanvasColors, scale: CGFloat) {
        let layout = content.layout
        let border = CGFloat(CompletionPopupLayout.border)
        let listClip = CGRect(x: border, y: border, width: CGFloat(layout.listWidth),
                              height: CGFloat(layout.listHeight))
        let rowWidth = CGFloat(layout.rowWidth)
        for (index, option) in content.options.enumerated() {
            let top = border + CGFloat(layout.rowTop(index) - scrollTop)
            let rowHeight = CGFloat(CompletionPopupLayout.rowHeight)
            guard top + rowHeight > listClip.minY, top < listClip.maxY else {
                continue
            }
            let selected = content.first + index == content.selected
            let background = selected ? "--selected" : "--panel"
            if selected, let rect = selectedRect(content) {
                // See-through over the selection's layer.
                context.clear(CGRect(x: rect.minX * scale, y: rect.minY * scale, width: rect.width * scale,
                                     height: rect.height * scale))
            }
            let clip = CGRect(x: border, y: max(top, listClip.minY),
                              width: rowWidth - CGFloat(CompletionPopupLayout.rowRight),
                              height: min(top + rowHeight, listClip.maxY) - max(top, listClip.minY))
            drawBadge(option.completion.type, rowTop: top, background: background, clip: clip, colors: colors,
                      context: context, scale: scale)
            drawLabel(option, rowTop: top, clip: clip, onLayer: selected, colors: colors, context: context,
                      scale: scale)
        }
        if content.markerTop {
            drawMarker(top: border + CGFloat(CompletionPopupLayout.listPadding - scrollTop), content: content,
                       clip: listClip, colors: colors, context: context, scale: scale)
        }
        if content.markerBottom {
            let top = border + CGFloat(layout.rowTop(content.options.count) - scrollTop)
            drawMarker(top: top, content: content, clip: listClip, colors: colors, context: context, scale: scale)
        }
        drawScrollbar(layout, colors: colors, context: context, scale: scale)
    }

    private func drawBadge(_ type: String?, rowTop: CGFloat, background: String, clip: CGRect, colors: CanvasColors,
                           context: CGContext, scale: CGFloat) {
        guard let type, let badge = type.split(separator: " ").lazy.compactMap({ Self.badges[String($0)] }).first,
              let tint = colors.theme.cssColor(badge.token), let under = colors.theme.cssColor(background) else {
            return
        }
        let size = CGFloat(CompletionPopupLayout.badge)
        let box = CGRect(x: 1 + CGFloat(CompletionPopupLayout.rowLeft), y: rowTop + Self.badgeTop, width: size,
                         height: size)
        context.saveGState()
        context.clip(to: CGRect(x: clip.minX * scale, y: clip.minY * scale, width: clip.width * scale,
                                height: clip.height * scale))
        context.setFillColor(tint.over(under, opacity: 0.18).cgColor)
        context.fillEllipse(in: CGRect(x: box.minX * scale, y: box.minY * scale, width: size * scale,
                                       height: size * scale))
        context.restoreGState()
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: badge.letter, attributes: [
            .font: Self.badgeFont, .foregroundColor: colors.textColor(badge.token),
        ]))
        let width = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        // The letter's line box (line-height 12.636) centered in the circle, measured a point above where its
        // rounded ascent and descent put it.
        let ascent = Self.badgeFont.ascender.rounded(), descent = (-Self.badgeFont.descender).rounded()
        let baseline = box.minY + (12.636 - ascent - descent) / 2 + ascent - 1
        glyphs.draw(line, x: box.minX + (size - width) / 2, rowTop: baseline - 14, clip: clip, into: context,
                    scale: scale, baseline: baseline)
    }

    /// The selected row's box in the popup, inside the list, or nil when it is scrolled out.
    func selectedRect(_ content: Content) -> CGRect? {
        let index = content.selected - content.first
        guard content.options.indices.contains(index) else {
            return nil
        }
        let layout = content.layout
        let border = CGFloat(CompletionPopupLayout.border)
        let list = CGRect(x: border, y: border, width: CGFloat(layout.listWidth), height: CGFloat(layout.listHeight))
        let row = CGRect(x: border, y: border + CGFloat(layout.rowTop(index) - scrollTop),
                         width: CGFloat(layout.rowWidth), height: CGFloat(CompletionPopupLayout.rowHeight))
        let shown = row.intersection(list)
        return shown.isNull || shown.isEmpty ? nil : shown
    }

    private func drawLabel(_ option: CompletionOption, rowTop: CGFloat, clip: CGRect, onLayer: Bool,
                           colors: CanvasColors, context: CGContext, scale: CGFloat) {
        let completion = option.completion
        let label = completion.displayLabel ?? completion.label
        let text = NSMutableAttributedString(string: label, attributes: [
            .font: Self.codeFont, .foregroundColor: colors.textColor("--text"),
        ])
        let length = (label as NSString).length
        for pair in stride(from: 0, to: option.match.count - 1, by: 2) {
            let from = min(option.match[pair], length), to = min(option.match[pair + 1], length)
            if from < to {
                text.addAttributes([.font: Self.matchedFont, .foregroundColor: colors.textColor("--accent")],
                                   range: NSRange(location: from, length: to - from))
            }
        }
        let x = 1 + CGFloat(CompletionPopupLayout.rowLeft + CompletionPopupLayout.badge
            + CompletionPopupLayout.badgeGap)
        let baseline = rowTop + Self.labelBaseline
        let line = CTLineCreateWithAttributedString(text)
        glyphs.draw(line, x: x, rowTop: baseline - 14, clip: clip, into: context, scale: scale, layer: onLayer,
                    baseline: baseline)
        guard let detail = completion.detail, !detail.isEmpty else {
            return
        }
        let detailX = x + CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
            + CGFloat(CompletionPopupLayout.detailGap)
        let detailLine = CTLineCreateWithAttributedString(NSAttributedString(string: detail, attributes: [
            .font: Self.codeFont, .foregroundColor: colors.textColor("--text-faint"),
        ]))
        glyphs.draw(detailLine, x: detailX, rowTop: baseline - 14, clip: clip, into: context, scale: scale,
                    layer: onLayer, baseline: baseline)
    }

    /// The "···" line of a list cut short, centered, at half opacity.
    private func drawMarker(top: CGFloat, content: Content, clip: CGRect, colors: CanvasColors, context: CGContext,
                            scale: CGFloat) {
        guard let text = colors.theme.cssColor("--text"), let panel = colors.theme.cssColor("--panel") else {
            return
        }
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: "···", attributes: [
            .font: Self.codeFont, .foregroundColor: text.over(panel, opacity: 0.5),
        ]))
        let width = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        let baseline = top + 13
        glyphs.draw(line, x: 1 + (CGFloat(content.layout.rowWidth) - width) / 2, rowTop: baseline - 14,
                    clip: clip, into: context, scale: scale, baseline: baseline)
    }

    private func drawScrollbar(_ layout: CompletionPopupLayout, colors: CanvasColors, context: CGContext,
                               scale: CGFloat) {
        guard let thumb = EditorGeometry.thumb(track: layout.listHeight, visible: layout.listHeight,
                                               total: layout.contentHeight, offset: scrollTop),
              let dim = colors.theme.cssColor("--text-dim"), let panel = colors.theme.cssColor("--panel") else {
            return
        }
        let x = 1 + CGFloat(layout.listWidth - CompletionPopupLayout.scrollbar) + 2
        let rect = CGRect(x: x, y: 1 + CGFloat(thumb.start) + 2, width: 6, height: CGFloat(thumb.length) - 4)
        context.setFillColor(dim.over(panel, opacity: 0.35).cgColor)
        context.addPath(CGPath(roundedRect: CGRect(x: rect.minX * scale, y: rect.minY * scale,
                                                   width: rect.width * scale, height: rect.height * scale),
                               cornerWidth: 3 * scale, cornerHeight: 3 * scale, transform: nil))
        context.fillPath()
    }

    private func fill(_ rect: CGRect, color: NSColor, context: CGContext, scale: CGFloat) {
        context.setFillColor(color.cgColor)
        context.fill(CGRect(x: rect.minX * scale, y: rect.minY * scale, width: rect.width * scale,
                            height: rect.height * scale))
    }
}
