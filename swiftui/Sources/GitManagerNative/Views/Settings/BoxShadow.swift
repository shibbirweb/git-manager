// A CSS box-shadow (0 offset blur, black at an alpha) drawn as WebKit stores it: black at the alpha bytes
// ShadowMask works out, in an image the size of what the shadow reaches, behind the box. Images are kept per size and
// shadow while they are in use (a dialog has a handful).

import AppKit
import NativeCore
import SwiftUI

struct BoxShadowSpec: Hashable {
    var width: CGFloat
    var height: CGFloat
    var radius: CGFloat
    var offsetY: CGFloat
    var blur: CGFloat
    var alpha: Double
}

@MainActor
enum BoxShadowImages {
    private static var cache: [String: (image: CGImage, margin: CGFloat)] = [:]

    /// The shadow's image and how far it reaches past the box on each side, in points.
    static func image(_ spec: BoxShadowSpec, scale: CGFloat) -> (image: CGImage, margin: CGFloat)? {
        let key = "\(spec)@\(scale)"
        if let cached = cache[key] {
            return cached
        }
        let sigma = ShadowMask.sigma(blur: Double(spec.blur), scale: Double(scale))
        let reach = ShadowMask.reach(sigma: sigma) + Int((spec.offsetY * scale).rounded(.up))
        let box = ShadowBox(x: Double(reach), y: Double(reach), width: Double(spec.width * scale),
                            height: Double(spec.height * scale), radius: Double(spec.radius * scale))
        let width = Int((spec.width * scale).rounded()) + 2 * reach
        let height = Int((spec.height * scale).rounded()) + 2 * reach
        let alpha = ShadowMask.alphaBytes(box: box, offsetY: Double(spec.offsetY * scale), sigma: sigma,
                                          alpha: spec.alpha, regionX: 0, regionY: 0, width: width, height: height)
        guard let image = blackImage(alpha: alpha, width: width, height: height) else {
            return nil
        }
        let result = (image, CGFloat(reach) / scale)
        cache[key] = result
        return result
    }

    /// Premultiplied black at each alpha byte, as a layer of WebKit's holds a shadow.
    static func blackImage(alpha: [UInt8], width: Int, height: Int) -> CGImage? {
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        for index in 0..<(width * height) {
            pixels[index * 4 + 3] = alpha[index]
        }
        guard let provider = CGDataProvider(data: Data(pixels) as CFData),
              let space = CGColorSpace(name: CGColorSpace.sRGB) else {
            return nil
        }
        return CGImage(
            width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
            space: space, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent
        )
    }
}

extension View {
    /// The box's CSS shadow behind it.
    func boxShadow(radius: CGFloat, offsetY: CGFloat, blur: CGFloat, alpha: Double) -> some View {
        modifier(BoxShadowModifier(radius: radius, offsetY: offsetY, blur: blur, alpha: alpha))
    }
}

private struct BoxShadowModifier: ViewModifier {
    @Environment(\.displayScale) private var displayScale

    let radius: CGFloat
    let offsetY: CGFloat
    let blur: CGFloat
    let alpha: Double

    func body(content: Content) -> some View {
        content.background(GeometryReader { proxy in
            let spec = BoxShadowSpec(width: proxy.size.width, height: proxy.size.height, radius: radius,
                                     offsetY: offsetY, blur: blur, alpha: alpha)
            if let shadow = BoxShadowImages.image(spec, scale: displayScale) {
                Image(decorative: shadow.image, scale: displayScale)
                    .interpolation(.none)
                    .offset(x: -shadow.margin, y: -shadow.margin)
                    .allowsHitTesting(false)
            }
        })
    }
}
