// The frame of the search popups (.popup in QuickOpen.svelte and FileSearch.svelte): --panel with a 1-point
// --border-strong ring, rounded corners, and box-shadow: var(--shadow), 0 8px 28px at 16% black (50% in dark). The
// shadow is its own see-through layer under the popup, black at the alpha BoxShadow works out, so macOS composites
// it over the window as it composites the page's layers.

import AppKit
import NativeCore
import SwiftUI

/// The popup box at `frame` (points, in the window's content below the title bar) with its shadow.
struct PopupFrame<Content: View>: View {
    @Environment(\.theme) private var theme
    @Environment(\.colorScheme) private var colorScheme

    let frame: CGRect
    let cornerRadius: CGFloat
    @ViewBuilder let content: () -> Content

    var body: some View {
        let shadow = PopupShadow(box: frame, cornerRadius: cornerRadius, alpha: colorScheme == .dark ? 0.5 : 0.16)
        ZStack(alignment: .topLeading) {
            PopupShadowView(shadow: shadow)
                .frame(width: shadow.area.width, height: shadow.area.height)
                .offset(x: shadow.area.minX, y: shadow.area.minY)
            VStack(spacing: 0) {
                content()
            }
            .frame(width: frame.width - 2, height: frame.height - 2, alignment: .top)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius - 1, style: .circular))
            .padding(1)
            .background(RoundedRectangle(cornerRadius: cornerRadius, style: .circular).fill(theme.color("--panel")))
            .borderRing(theme.color("--border-strong"), cornerRadius: cornerRadius)
            .offset(x: frame.minX, y: frame.minY)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/// What the shadow layer shows: the popup's box, its corners and the shadow color's alpha.
struct PopupShadow: Equatable {
    let box: CGRect
    let cornerRadius: CGFloat
    let alpha: Double
    static let offsetY: CGFloat = 8
    static let blur: Double = 28

    /// The layer's frame in points: the shadow's box grown by its reach, on whole points.
    var area: CGRect {
        let reach = CGFloat(BoxShadow.sigma(blur: PopupShadow.blur, scale: 2) * 3.2 / 2).rounded(.up) + 1
        return box.offsetBy(dx: 0, dy: PopupShadow.offsetY).insetBy(dx: -reach, dy: -reach).integral
    }

    /// The layer's pixels at `scale`: black at the shadow's alpha outside the popup's rounded box, clear inside.
    func image(scale: CGFloat) -> CGImage? {
        let area = area
        let pixels = CGRect(x: area.minX * scale, y: area.minY * scale, width: area.width * scale,
                            height: area.height * scale)
        let shadowBox = box.offsetBy(dx: 0, dy: PopupShadow.offsetY)
        let model = BoxShadow(
            box: CGRect(x: shadowBox.minX * scale, y: shadowBox.minY * scale, width: shadowBox.width * scale,
                        height: shadowBox.height * scale),
            radius: Double(cornerRadius * scale), sigma: BoxShadow.sigma(blur: PopupShadow.blur, scale: scale),
            alpha: alpha
        )
        let map = model.alphaMap(pixels)
        let width = Int(pixels.width), height = Int(pixels.height)
        let inside = CGPath(roundedRect: CGRect(x: box.minX * scale, y: box.minY * scale, width: box.width * scale,
                                                height: box.height * scale),
                            cornerWidth: cornerRadius * scale, cornerHeight: cornerRadius * scale, transform: nil)
        var bytes = [UInt8](repeating: 0, count: width * height * 4)
        for row in 0..<height {
            for column in 0..<width {
                let center = CGPoint(x: pixels.minX + CGFloat(column) + 0.5, y: pixels.minY + CGFloat(row) + 0.5)
                if inside.contains(center) {
                    continue
                }
                // BGRA, premultiplied: black keeps its color bytes at 0.
                bytes[(row * width + column) * 4 + 3] = map[row * width + column]
            }
        }
        guard let provider = CGDataProvider(data: Data(bytes) as CFData),
              let space = CGColorSpace(name: CGColorSpace.sRGB) else {
            return nil
        }
        return CGImage(
            width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
            space: space,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedFirst.rawValue
                | CGBitmapInfo.byteOrder32Little.rawValue),
            provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent
        )
    }
}

/// The shadow's layer; worked out again only when the popup's box or the appearance changes.
struct PopupShadowView: NSViewRepresentable {
    let shadow: PopupShadow

    func makeNSView(context: Context) -> ShadowLayerView {
        ShadowLayerView()
    }

    func updateNSView(_ view: ShadowLayerView, context: Context) {
        view.show(shadow)
    }
}

final class ShadowLayerView: NSView {
    private var shown: PopupShadow?

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.actions = CanvasSurface.noActions
    }

    required init?(coder: NSCoder) {
        nil
    }

    // Clicks pass through to the backdrop under it.
    override func hitTest(_ point: NSPoint) -> NSView? {
        nil
    }

    func show(_ shadow: PopupShadow) {
        let scale = window?.backingScaleFactor ?? 2
        guard shown != shadow || layer?.contents == nil else {
            return
        }
        shown = shadow
        layer?.contentsScale = scale
        layer?.contentsGravity = .resize
        layer?.contents = shadow.image(scale: scale)
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if let shadow = shown {
            shown = nil
            show(shadow)
        }
    }
}
