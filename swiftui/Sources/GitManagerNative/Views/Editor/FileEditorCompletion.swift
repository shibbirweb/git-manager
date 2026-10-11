// The completion popup in the file editor: shown while the session's completion is open, at the completed text's
// left below its line (above when the window has more room there), following the editor as it scrolls, with its
// shadow under it. The options the popup renders are the 100 around the selected one (rangeAroundSelected).

import AppKit
import NativeCore

extension FileScrollView.Host {
    func updatePopup() {
        guard let session, let open = session.completion.state.open, let content = canvas.content else {
            hidePopup()
            return
        }
        let row = canvas.row(of: open.pos, content)
        let lineTop = canvas.rowTop(row) - 1, lineBottom = canvas.rowTop(row) + 16
        // CodeMirror hides a tooltip whose position is out of the editor's view.
        guard lineBottom > 0, lineTop < bounds.height, let contentView = window?.contentView else {
            hidePopup()
            return
        }
        let range = CompletionCommands.renderedRange(total: open.options.count, selected: open.selected)
        let options = Array(open.options[range])
        let widths = options.map { option -> (label: Double, detail: Double) in
            (PopupTextWidths.width(option.completion.displayLabel ?? option.completion.label),
             option.completion.detail.map(PopupTextWidths.width) ?? 0)
        }
        let markerTop = range.lowerBound > 0, markerBottom = range.upperBound < open.options.count
        var layout = CompletionPopupLayout(rowWidths: widths, markerTop: markerTop, markerBottom: markerBottom)
        let space = convert(contentView.bounds, from: contentView)
        let anchorX = canvas.textX(content) + canvas.x(of: open.pos, row: row, content)
        let placed = CompletionPopupLayout.place(
            width: layout.width, height: layout.height, anchorX: Double(anchorX), lineTop: Double(lineTop),
            lineBottom: Double(lineBottom),
            space: (Double(space.minX), Double(space.minY), Double(space.maxX), Double(space.maxY))
        )
        if placed.room < layout.height {
            layout = CompletionPopupLayout(rowWidths: widths, markerTop: markerTop, markerBottom: markerBottom,
                                           room: placed.room - 2 * CompletionPopupLayout.border)
        }
        EditorCompletion.pageRows = layout.pageRows
        // WebKit puts the popup's layer on whole device pixels.
        let scale = window?.backingScaleFactor ?? 2
        let frame = CGRect(x: (CGFloat(placed.x) * scale).rounded() / scale,
                           y: (CGFloat(placed.y) * scale).rounded() / scale, width: layout.width, height: layout.height)
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        popup.isHidden = false
        popupShadow.isHidden = false
        popup.frame = frame
        popup.onPick = { [weak session] option in
            session?.completion.pick(option)
        }
        let shown = CompletionPopupView.Content(
            options: options, first: range.lowerBound, selected: open.selected, layout: layout, theme: theme,
            markerTop: markerTop, markerBottom: markerBottom
        )
        // Scrolling the editor only moves the popup: its pixels are painted again only when they change.
        if popup.content.map({ !$0.drawsLike(shown) }) ?? true {
            popup.content = shown
        }
        let alpha = DialogBackdrop.parseShadow(theme.raw("--shadow") ?? "").alpha
        let shadow = PopupShadow(box: frame, cornerRadius: 6, alpha: alpha)
        popupShadow.frame = shadow.area
        popupShadow.show(shadow)
        CATransaction.commit()
    }

    func hidePopup() {
        guard !popup.isHidden else {
            return
        }
        popup.isHidden = true
        popupShadow.isHidden = true
        popup.content = nil
    }
}

/// The code font's widths of the popup's labels and details, kept: the popup is placed again at every scroll step.
@MainActor
enum PopupTextWidths {
    private static var widths: [String: Double] = [:]

    static func width(_ text: String) -> Double {
        if let known = widths[text] {
            return known
        }
        if widths.count > 4000 {
            widths.removeAll()
        }
        let width = Double(ExactText.width(text, font: CompletionPopupView.codeFont))
        widths[text] = width
        return width
    }
}
