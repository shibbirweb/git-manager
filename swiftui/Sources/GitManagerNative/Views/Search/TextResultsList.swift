// Find in Files' results as one drawn view (ResultsCanvas) with the list's thumb over it (PopupScrollThumb), in
// place of PopupList's view per row: the same rows, selection, clicks and wheel scrolling.

import AppKit
import NativeCore
import SwiftUI

struct TextResultsList: View {
    let rows: [TextRow]
    let selected: Int
    let height: CGFloat
    let textWidth: CGFloat
    @Binding var scrollTop: Double
    let activate: (Int) -> Void

    private var contentHeight: CGFloat {
        ResultsCanvas.paddingTop + CGFloat(rows.count) * PopupMetrics.rowHeight + 4
    }

    var body: some View {
        let overflows = contentHeight > height + 0.5
        ResultsCanvasView(rows: rows, selected: selected, scrollTop: scrollTop, overflows: overflows,
                          textWidth: textWidth, activate: activate) { delta in
            let limit = max(0, Double(contentHeight - height))
            scrollTop = min(limit, max(0, scrollTop - delta))
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .overlay(alignment: .topTrailing) {
            if overflows {
                PopupScrollThumb(height: height, contentHeight: contentHeight, scrollTop: scrollTop)
            }
        }
    }
}

private struct ResultsCanvasView: NSViewRepresentable {
    @Environment(\.theme) private var theme

    let rows: [TextRow]
    let selected: Int
    let scrollTop: Double
    let overflows: Bool
    let textWidth: CGFloat
    let activate: (Int) -> Void
    let scroll: (Double) -> Void

    func makeNSView(context: Context) -> ResultsCanvas {
        ResultsCanvas()
    }

    func updateNSView(_ canvas: ResultsCanvas, context: Context) {
        canvas.onActivate = activate
        canvas.onScroll = scroll
        canvas.content = ResultsCanvas.Content(
            rows: rows, selected: selected, scrollTop: scrollTop, theme: theme, overflows: overflows,
            textWidth: textWidth
        )
    }
}
