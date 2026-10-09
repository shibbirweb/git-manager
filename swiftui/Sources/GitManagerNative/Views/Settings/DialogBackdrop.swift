// What a modal dialog puts over the window, as the current app's page has it (measured on the Settings dialog): the
// .overlay is a layer of its own, black at --overlay's alpha in 8 bits (71 light, 115 dark), and the dialog's
// box-shadow lies in another see-through layer above it (black at the bytes BoxShadow works out), both composited by
// macOS over the window, so the pixels under them darken as the page's do. The shadow is kept in four strips around
// the dialog rather than one bitmap the dialog's size, most of which the dialog would cover.

import AppKit
import NativeCore
import SwiftUI

struct DialogBackdrop: NSViewRepresentable {
    /// The dialog's box in the view's points.
    let dialog: CGRect
    let cornerRadius: CGFloat
    /// --overlay's alpha and --shadow's offset, blur and alpha.
    let overlayAlpha: Double
    let shadow: (offsetY: CGFloat, blur: CGFloat, alpha: Double)
    /// The dialog is a child of the overlay on the page (the conflicts list), so its shadow is painted into the
    /// overlay's own layer: dim and shadow blend there in 8 bits and reach the window as one layer.
    var shadowInOverlay = false

    func makeNSView(context: Context) -> DialogBackdropView {
        DialogBackdropView()
    }

    func updateNSView(_ view: DialogBackdropView, context: Context) {
        view.spec = .init(dialog: dialog, cornerRadius: cornerRadius, overlayAlpha: overlayAlpha,
                          offsetY: shadow.offsetY, blur: shadow.blur, shadowAlpha: shadow.alpha,
                          shadowInOverlay: shadowInOverlay)
    }

    /// "0 8px 28px rgba(0, 0, 0, 0.16)" as offset, blur and alpha; the page's --shadow when it does not parse.
    static func parseShadow(_ value: String) -> (offsetY: CGFloat, blur: CGFloat, alpha: Double) {
        let numbers = value.replacingOccurrences(of: "px", with: " ")
            .components(separatedBy: CharacterSet(charactersIn: " ,()")).compactMap(Double.init)
        // 0, 8, 28, then the rgba's 0, 0, 0 and its alpha.
        guard numbers.count >= 7 else {
            return (8, 28, 0.16)
        }
        return (CGFloat(numbers[1]), CGFloat(numbers[2]), numbers[6])
    }
}

final class DialogBackdropView: NSView {
    struct Spec: Equatable {
        var dialog: CGRect
        var cornerRadius: CGFloat
        var overlayAlpha: Double
        var offsetY: CGFloat
        var blur: CGFloat
        var shadowAlpha: Double
        var shadowInOverlay: Bool
    }

    var spec: Spec? {
        didSet {
            if spec != oldValue {
                needsLayout = true
            }
        }
    }

    private let overlay = CALayer()
    private let strips = (0..<4).map { _ in CALayer() }
    private var builtFor: (spec: Spec, scale: CGFloat)?

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        for layer in [overlay] + strips {
            layer.actions = CanvasSurface.noActions
            layer.magnificationFilter = .nearest
            layer.minificationFilter = .nearest
            self.layer?.addSublayer(layer)
        }
        overlay.contentsGravity = .resize
    }

    required init?(coder: NSCoder) {
        nil
    }

    override var isFlipped: Bool {
        true
    }

    /// Clicks go to the SwiftUI views around it.
    override func hitTest(_ point: NSPoint) -> NSView? {
        nil
    }

    override func layout() {
        super.layout()
        guard let spec else {
            return
        }
        let scale = window?.backingScaleFactor ?? 2
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        overlay.frame = bounds
        if builtFor?.spec != spec || builtFor?.scale != scale {
            builtFor = (spec, scale)
            let alpha = UInt8((spec.overlayAlpha * 255).rounded())
            overlay.contents = BoxShadowImages.blackImage(alpha: [alpha], width: 1, height: 1)
            buildStrips(spec, scale: scale)
        }
        CATransaction.commit()
    }

    private func buildStrips(_ spec: Spec, scale: CGFloat) {
        // GM-57's measured mask of the page's shadow (BoxShadow), which fits light and dark; the Gaussian
        // (ShadowMask) only sizes the region and cuts the box out.
        let offset = Int((spec.offsetY * scale).rounded())
        let reach = ShadowMask.reach(sigma: ShadowMask.sigma(blur: Double(spec.blur), scale: Double(scale))) + 10
        // The dialog in device pixels, snapped as WebKit snaps a box.
        let left = Int((spec.dialog.minX * scale).rounded()), top = Int((spec.dialog.minY * scale).rounded())
        let right = Int((spec.dialog.maxX * scale).rounded()), bottom = Int((spec.dialog.maxY * scale).rounded())
        let radius = Int((spec.cornerRadius * scale).rounded(.up))
        let region = (x: left - reach, y: top - reach + min(0, offset), width: right - left + 2 * reach,
                      height: bottom - top + 2 * reach + abs(offset))
        let box = ShadowBox(x: Double(left), y: Double(top), width: Double(right - left),
                            height: Double(bottom - top), radius: Double(spec.cornerRadius * scale))
        let model = BoxShadow(
            box: CGRect(x: Double(left), y: Double(top + offset), width: Double(right - left),
                        height: Double(bottom - top)),
            radius: Double(spec.cornerRadius * scale),
            sigma: BoxShadow.sigma(blur: Double(spec.blur), scale: Double(scale)), alpha: spec.shadowAlpha
        )
        var alpha = model.alphaMap(CGRect(x: region.x, y: region.y, width: region.width, height: region.height))
        for row in 0..<region.height {
            for column in 0..<region.width {
                let cover = box.coverage(column: region.x + column, row: region.y + row)
                if cover > 0 {
                    let index = row * region.width + column
                    alpha[index] = UInt8((Double(alpha[index]) * (1 - cover)).rounded())
                }
            }
        }
        let regionRect = CGRect(x: CGFloat(region.x) / scale, y: CGFloat(region.y) / scale,
                                width: CGFloat(region.width) / scale, height: CGFloat(region.height) / scale)
        if spec.shadowInOverlay {
            // Shadow over the dim in one 8-bit layer; the plain dim stays out of the shadow's area.
            let dim = (spec.overlayAlpha * 255).rounded()
            // The shadow color's exact alpha through the 8-bit mask over the dim, rounded once (measured: the
            // mask times the 8-bit alpha first leaves the dark shadow a step too strong).
            let blurMask = BoxShadow(
                box: CGRect(x: Double(left), y: Double(top + offset), width: Double(right - left),
                            height: Double(bottom - top)),
                radius: Double(spec.cornerRadius * scale),
                sigma: BoxShadow.sigma(blur: Double(spec.blur), scale: Double(scale)), alpha: 1
            ).alphaMap(CGRect(x: region.x, y: region.y, width: region.width, height: region.height))
            for index in alpha.indices {
                let row = index / region.width, column = index % region.width
                let cover = box.coverage(column: region.x + column, row: region.y + row)
                let shadow = Double(blurMask[index]) / 255 * (1 - cover) * spec.shadowAlpha
                alpha[index] = UInt8((255 * shadow + dim * (1 - shadow)).rounded())
            }
            let mask = CAShapeLayer()
            let path = CGMutablePath()
            path.addRect(bounds)
            path.addRect(regionRect)
            mask.path = path
            mask.fillRule = .evenOdd
            overlay.mask = mask
        } else {
            overlay.mask = nil
        }
        // Top and bottom across the whole width, left and right between them; each reaches past the corners' curve.
        let topRows = top - region.y + radius, bottomStart = bottom - region.y - radius
        let sideColumns = left - region.x + radius
        let pieces = [
            (x: 0, y: 0, width: region.width, height: topRows),
            (x: 0, y: bottomStart, width: region.width, height: region.height - bottomStart),
            (x: 0, y: topRows, width: sideColumns, height: bottomStart - topRows),
            (x: region.width - sideColumns, y: topRows, width: sideColumns, height: bottomStart - topRows),
        ]
        for (layer, piece) in zip(strips, pieces) {
            guard piece.width > 0, piece.height > 0 else {
                layer.contents = nil
                continue
            }
            var bytes = [UInt8](repeating: 0, count: piece.width * piece.height)
            for row in 0..<piece.height {
                let source = (piece.y + row) * region.width + piece.x
                bytes.replaceSubrange(row * piece.width..<(row + 1) * piece.width,
                                      with: alpha[source..<(source + piece.width)])
            }
            layer.contents = BoxShadowImages.blackImage(alpha: bytes, width: piece.width, height: piece.height)
            layer.contentsScale = scale
            layer.frame = CGRect(x: CGFloat(region.x + piece.x) / scale, y: CGFloat(region.y + piece.y) / scale,
                                 width: CGFloat(piece.width) / scale, height: CGFloat(piece.height) / scale)
        }
    }
}
