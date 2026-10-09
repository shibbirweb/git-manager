// A scrolling area with the page's scrollbar (src/app.css: ::-webkit-scrollbar 10 points wide, the thumb
// color-mix(--text-dim 35%, transparent) with a 2-point transparent border and round ends). The scrollbar takes its
// 10 points from the content, as WebKit's classic scrollbars do, and the thumb is its own see-through image over the
// track, as WebKit puts it in a layer of its own. WebKit sizes the thumb in whole points.

import AppKit
import SwiftUI

struct SettingsScroll<Content: View>: View {
    @Environment(\.theme) private var theme
    @Environment(\.displayScale) private var displayScale

    /// Changes when the content is replaced (another section): the scroll goes back to the top.
    let resetKey: String
    /// The dialog's own rows report their scroll in get_state (SettingsStore.scrollMetrics).
    var reportsMetrics = false
    @ViewBuilder let content: () -> Content

    @State private var offset: CGFloat = 0
    @State private var contentHeight: CGFloat = 0

    var body: some View {
        GeometryReader { proxy in
            let viewport = proxy.size.height
            HStack(spacing: 0) {
                ScrollViewReader { reader in
                    ScrollView(.vertical, showsIndicators: false) {
                        content()
                            .id("top-\(resetKey)")
                            // A preference set in a scroll view's content did not reach the views around it (measured:
                            // always the default), so the content's frame is read where it is.
                            .background(GeometryReader { inner in
                                let frame = inner.frame(in: .named("settings-scroll"))
                                Color.clear
                                    .onAppear { follow(frame, viewport: viewport) }
                                    .onChange(of: frame) { follow($0, viewport: viewport) }
                            })
                    }
                    .coordinateSpace(name: "settings-scroll")
                    .onChange(of: resetKey) { key in
                        reader.scrollTo("top-\(key)", anchor: .top)
                    }
                }
                thumbTrack(viewport: viewport)
            }
        }
    }

    private func follow(_ frame: CGRect, viewport: CGFloat) {
        offset = -frame.minY
        contentHeight = frame.height
        if reportsMetrics {
            SettingsStore.shared.scrollMetrics = [offset, contentHeight, viewport]
        }
    }

    @ViewBuilder
    private func thumbTrack(viewport: CGFloat) -> some View {
        ZStack(alignment: .top) {
            Color.clear
            if contentHeight > viewport + 0.5 {
                let length = (viewport * viewport / contentHeight).rounded()
                let travel = max(0, contentHeight - viewport)
                let top = travel > 0 ? (viewport - length) * min(1, max(0, offset / travel)) : 0
                if let image = thumbImage(length: length) {
                    Image(decorative: image, scale: displayScale)
                        .interpolation(.none)
                        .offset(y: (top * displayScale).rounded() / displayScale)
                }
            }
        }
        .frame(width: 10)
    }

    private func thumbImage(length: CGFloat) -> CGImage? {
        let width = Int(10 * displayScale), height = Int((length * displayScale).rounded())
        guard height > 0, let space = CGColorSpace(name: CGColorSpace.displayP3), let context = CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: space,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return nil
        }
        context.scaleBy(x: displayScale, y: displayScale)
        let rect = CGRect(x: 2, y: 2, width: 6, height: length - 4)
        context.setFillColor(theme.translucent("--text-dim", alpha: 0.35))
        context.addPath(CGPath(roundedRect: rect, cornerWidth: 3, cornerHeight: 3, transform: nil))
        context.fillPath()
        return context.makeImage()
    }
}
