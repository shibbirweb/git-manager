// The popups' result list (.list and .canvas): rows of one height, only the visible ones built (popupRows.ts
// visibleRange), scrolled by the wheel, with the page's thin scrollbar (app.css ::-webkit-scrollbar: a 10-point
// track that takes its room from the rows, the thumb 2 points in, --text-dim at 35%, round, as long as the visible
// share of the content in whole points).

import AppKit
import NativeCore
import SwiftUI

struct PopupList<Row: View>: View {
    @Environment(\.theme) private var theme

    let count: Int
    let height: CGFloat
    var paddingTop: CGFloat = 4
    var paddingSide: CGFloat = 4
    var paddingBottom: CGFloat = 4
    @Binding var scrollTop: Double
    @ViewBuilder let row: (Int) -> Row

    private var contentHeight: CGFloat {
        paddingTop + CGFloat(count) * PopupMetrics.rowHeight + paddingBottom
    }

    private var overflows: Bool {
        contentHeight > height + 0.5
    }

    var body: some View {
        let range = PopupRows.visibleRange(
            scrollTop: scrollTop, viewportHeight: Double(height), rowHeight: Double(PopupMetrics.rowHeight),
            count: count
        )
        ZStack(alignment: .topLeading) {
            ForEach(Array(range), id: \.self) { index in
                row(index)
                    .frame(height: PopupMetrics.rowHeight)
                    .offset(y: paddingTop + CGFloat(index) * PopupMetrics.rowHeight - CGFloat(scrollTop))
            }
            .padding(.leading, paddingSide)
            .padding(.trailing, paddingSide + (overflows ? 10 : 0))
            if overflows {
                thumb
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .frame(height: height, alignment: .topLeading)
        .clipped()
        .overlay(WheelCatcher { delta in
            let limit = max(0, Double(contentHeight - height))
            scrollTop = min(limit, max(0, scrollTop - delta))
        })
    }

    private var thumb: some View {
        PopupScrollThumb(height: height, contentHeight: contentHeight, scrollTop: scrollTop)
    }
}

/// The vertical thumb at the right edge of a popup's list.
struct PopupScrollThumb: View {
    @Environment(\.theme) private var theme

    let height: CGFloat
    let contentHeight: CGFloat
    let scrollTop: Double

    var body: some View {
        let length = (height * height / contentHeight).rounded()
        let travel = height - length
        let limit = max(1, Double(contentHeight - height))
        let top = (travel * CGFloat(scrollTop / limit)).rounded()
        HStack {
            Spacer(minLength: 0)
            Capsule(style: .circular)
                .fill(theme.over("--text-dim", 0.35, on: "--panel"))
                .frame(width: 6, height: max(0, length - 4))
                .padding(2)
                .offset(y: top)
        }
        .frame(height: height, alignment: .top)
    }
}

/// Hands scroll wheel and trackpad deltas (points, down positive as content moves up) to `onScroll`.
struct WheelCatcher: NSViewRepresentable {
    let onScroll: (Double) -> Void

    func makeNSView(context: Context) -> WheelView {
        WheelView()
    }

    func updateNSView(_ view: WheelView, context: Context) {
        view.onScroll = onScroll
    }

    final class WheelView: NSView {
        var onScroll: ((Double) -> Void)?

        override func scrollWheel(with event: NSEvent) {
            let delta = event.hasPreciseScrollingDeltas ? event.scrollingDeltaY : event.scrollingDeltaY * 16
            onScroll?(Double(delta))
        }

        // Clicks go to the rows below; only the wheel stops here.
        override func hitTest(_ point: NSPoint) -> NSView? {
            NSApp.currentEvent?.type == .scrollWheel ? super.hitTest(point) : nil
        }
    }
}
