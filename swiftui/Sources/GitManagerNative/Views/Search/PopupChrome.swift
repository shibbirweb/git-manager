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
    /// A shadow WebKit paints into the page's own layer (the context menu), with its profile (BoxShadow.pageProfile).
    var pageLayer = false
    @ViewBuilder let content: () -> Content

    var body: some View {
        let shadow = PopupShadow(box: frame, cornerRadius: cornerRadius, alpha: colorScheme == .dark ? 0.5 : 0.16,
                                 pageLayer: pageLayer)
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
    var pageLayer = false
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
        let sigma = pageLayer ? BoxShadow.pageSigma(blur: PopupShadow.blur, scale: scale)
            : BoxShadow.sigma(blur: PopupShadow.blur, scale: scale)
        var model = BoxShadow(
            box: CGRect(x: shadowBox.minX * scale, y: shadowBox.minY * scale, width: shadowBox.width * scale,
                        height: shadowBox.height * scale),
            radius: Double(cornerRadius * scale), sigma: sigma, alpha: alpha
        )
        model.pageProfile = pageLayer
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
        layer?.magnificationFilter = .nearest
        // A box larger than the blur's reach takes the cached tile, its middle band stretched by Core Animation:
        // a popup that grows with its results no longer draws its whole shadow again (it took 30% of the main
        // thread while Find in Files streamed results).
        // A new tile is drawn off the main thread; the shadow shown until then stays.
        switch ShadowTiles.lookup(for: shadow, scale: scale) {
        case .ready(let tile):
            apply(tile)
        case .building:
            ShadowTiles.build(for: shadow, scale: scale) { [weak self] tile in
                if self?.shown == shadow {
                    self?.apply(tile)
                }
            }
        case .tooSmall:
            layer?.contents = shadow.image(scale: scale)
            layer?.contentsCenter = CGRect(x: 0, y: 0, width: 1, height: 1)
        }
    }

    private func apply(_ tile: ShadowTiles.Tile) {
        layer?.contents = tile.image
        layer?.contentsCenter = tile.center
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if let shadow = shown {
            shown = nil
            show(shadow)
        }
    }
}

/// Shadow tiles: the shadow of a box just big enough that its middle is beyond the blur's reach from every edge,
/// with the same fractions of a point in its place and size as the real box, so stretching its middle band gives the
/// real box's shadow pixel for pixel (a side shorter than that keeps its length). Kept per corner radius, alpha,
/// profile, scale and those fractions; drawn on a background queue (BoxShadow's Gaussian sums take a tenth of a
/// second for one tile).
@MainActor
enum ShadowTiles {
    struct Tile: @unchecked Sendable {
        let image: CGImage
        let center: CGRect
    }

    enum Lookup {
        case ready(Tile)
        case building
        case tooSmall
    }

    private static var cache: [String: Tile] = [:]
    private static var waiting: [String: [(Tile) -> Void]] = [:]
    /// Points of the band in the middle that are the same on every row and column.
    private static let band: CGFloat = 20

    static func lookup(for shadow: PopupShadow, scale: CGFloat) -> Lookup {
        guard let (key, _, _) = template(for: shadow, scale: scale) else {
            return .tooSmall
        }
        return cache[key].map(Lookup.ready) ?? .building
    }

    static func build(for shadow: PopupShadow, scale: CGFloat, then done: @escaping (Tile) -> Void) {
        guard let (key, small, center) = template(for: shadow, scale: scale) else {
            return
        }
        if let tile = cache[key] {
            done(tile)
            return
        }
        if waiting[key] != nil {
            waiting[key]?.append(done)
            return
        }
        waiting[key] = [done]
        Task.detached(priority: .userInitiated) {
            guard let image = small.image(scale: scale) else {
                return
            }
            let tile = Tile(image: image, center: center)
            await MainActor.run {
                cache[key] = tile
                for callback in waiting.removeValue(forKey: key) ?? [] {
                    callback(tile)
                }
            }
        }
    }

    /// Builds the tiles of these popup boxes ahead, so a popup that grows into one shows its shadow at once.
    static func prewarm(boxes: [CGRect], cornerRadius: CGFloat, dark: Bool) {
        let scale = NSScreen.main?.backingScaleFactor ?? 2
        for box in boxes {
            let shadow = PopupShadow(box: box, cornerRadius: cornerRadius, alpha: dark ? 0.5 : 0.16)
            if case .building = lookup(for: shadow, scale: scale) {
                build(for: shadow, scale: scale) { _ in }
            }
        }
    }

    /// The tile's cache key, box and middle band (unit square of its image), or nil when the box is too small to
    /// stretch either way. A side shorter than the reach keeps its real length and is not stretched.
    private static func template(for shadow: PopupShadow, scale: CGFloat) -> (String, PopupShadow, CGRect)? {
        let reach = shadow.area.minX < shadow.box.minX ? shadow.box.minX - shadow.area.minX : 0
        // The middle must be `reach` from the shadow box's edges (offset by offsetY) and past the corners.
        let side = 2 * (reach + shadow.cornerRadius + PopupShadow.offsetY) + band
        let box = shadow.box
        let stretchX = box.width >= side, stretchY = box.height >= side
        guard stretchX || stretchY else {
            return nil
        }
        let fraction = { (value: CGFloat) in value - value.rounded(.down) }
        let width = stretchX ? side.rounded(.up) + fraction(box.width) : box.width
        let height = stretchY ? side.rounded(.up) + fraction(box.height) : box.height
        let small = PopupShadow(box: CGRect(x: box.minX, y: box.minY, width: width, height: height),
                                cornerRadius: shadow.cornerRadius, alpha: shadow.alpha, pageLayer: shadow.pageLayer)
        let area = small.area
        let center = CGRect(x: stretchX ? 0.5 - band / 2 / area.width : 0,
                            y: stretchY ? 0.5 - band / 2 / area.height : 0,
                            width: stretchX ? band / area.width : 1, height: stretchY ? band / area.height : 1)
        let key = "\(shadow.cornerRadius) \(shadow.alpha) \(shadow.pageLayer) \(scale) \(fraction(box.minX)) "
            + "\(fraction(box.minY)) \(stretchX ? "x\(fraction(box.width))" : "w\(box.width)") "
            + "\(stretchY ? "y\(fraction(box.height))" : "h\(box.height)")"
        return (key, small, center)
    }
}
