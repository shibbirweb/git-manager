// A CSS box-shadow (x 0, y offset, blur radius, black at some alpha) as the alpha bytes of the layer WebKit paints it
// in. Fitted to the current app's Settings dialog (0 8px 28px, light and dark) pixel by pixel: the shape's coverage
// blurred by a Gaussian of 0.4964 times the blur radius (27.8 device pixels for 28 at 2x, cut at 2.88 sigma), times
// the shadow's alpha, rounded to a byte, and cut out under the box itself (WebKit clips the box out of its shadow).
// A box of Core Graphics' own shadow came out a step lighter in its outer half.

import Accelerate
import Foundation

public struct ShadowBox: Equatable, Sendable {
    /// The box in device pixels, y down.
    public var x: Double, y: Double, width: Double, height: Double
    public var radius: Double

    public init(x: Double, y: Double, width: Double, height: Double, radius: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.radius = radius
    }

    /// How much of the pixel at (column, row) the rounded box covers, 0...1 (8 x 8 samples near a corner).
    public func coverage(column: Int, row: Int) -> Double {
        let left = Double(column), top = Double(row)
        if left + 1 <= x || left >= x + width || top + 1 <= y || top >= y + height {
            return 0
        }
        let nearCorner = (left < x + radius || left + 1 > x + width - radius)
            && (top < y + radius || top + 1 > y + height - radius)
        if !nearCorner {
            let horizontal = min(left + 1, x + width) - max(left, x)
            let vertical = min(top + 1, y + height) - max(top, y)
            return horizontal * vertical
        }
        var inside = 0
        for sampleY in 0..<8 {
            for sampleX in 0..<8 {
                if contains(left + (Double(sampleX) + 0.5) / 8, top + (Double(sampleY) + 0.5) / 8) {
                    inside += 1
                }
            }
        }
        return Double(inside) / 64
    }

    private func contains(_ pointX: Double, _ pointY: Double) -> Bool {
        if pointX < x || pointX > x + width || pointY < y || pointY > y + height {
            return false
        }
        let cornerX = min(max(pointX, x + radius), x + width - radius)
        let cornerY = min(max(pointY, y + radius), y + height - radius)
        let dx = pointX - cornerX, dy = pointY - cornerY
        return dx * dx + dy * dy <= radius * radius
    }
}

public enum ShadowMask {
    /// The Gaussian's sigma in device pixels for a CSS blur radius at `scale`. A stronger shadow shows more of
    /// WebKit's tail, so the fit widens with its alpha: 0.4964 at the light dialog's 0.16, 0.5063 at the dark one's
    /// 0.5 (each measured against the current app), straight between them and held past them.
    public static func sigma(blur: Double, scale: Double, alpha: Double = 0.16) -> Double {
        let share = min(1, max(0, (alpha - 0.16) / (0.5 - 0.16)))
        return blur * scale * (0.4964 + share * (0.5063 - 0.4964))
    }

    /// How far the shadow reaches past its box, in device pixels.
    public static func reach(sigma: Double) -> Int {
        Int((sigma * 2.88).rounded())
    }

    /// The shadow layer's alpha bytes over `region` (device pixels: origin and size), row by row: `box` moved down
    /// by `offsetY`, blurred, times `alpha`, and nothing under `box` itself.
    public static func alphaBytes(
        box: ShadowBox, offsetY: Double, sigma: Double, alpha: Double,
        regionX: Int, regionY: Int, width: Int, height: Int
    ) -> [UInt8] {
        guard width > 0, height > 0 else {
            return []
        }
        let reach = reach(sigma: sigma)
        let kernel = (-reach...reach).map { Float(exp(-Double($0 * $0) / (2 * sigma * sigma))) }
        let total = kernel.reduce(0, +)
        let weights = kernel.map { $0 / total }
        var shifted = box
        shifted.y += offsetY
        // Horizontal pass, row by row: rows with the same coverage (all those between the corners) share one result.
        var rows = [Float](repeating: 0, count: width * height)
        var previous: [Float] = []
        var previousBlur: [Float] = []
        for row in 0..<height {
            let line = (0..<width).map { Float(shifted.coverage(column: regionX + $0, row: regionY + row)) }
            if line != previous {
                previous = line
                previousBlur = blur(line, weights: weights, reach: reach)
            }
            rows.replaceSubrange(row * width..<(row + 1) * width, with: previousBlur)
        }
        // Vertical pass on the transposed rows.
        var columns = [Float](repeating: 0, count: width * height)
        vDSP_mtrans(rows, 1, &columns, 1, vDSP_Length(width), vDSP_Length(height))
        var blurred = [Float](repeating: 0, count: width * height)
        previous = []
        for column in 0..<width {
            let line = Array(columns[column * height..<(column + 1) * height])
            if line != previous {
                previous = line
                previousBlur = blur(line, weights: weights, reach: reach)
            }
            blurred.replaceSubrange(column * height..<(column + 1) * height, with: previousBlur)
        }
        var bytes = [UInt8](repeating: 0, count: width * height)
        for row in 0..<height {
            for column in 0..<width {
                let mask = Double(blurred[column * height + row])
                let outside = 1 - box.coverage(column: regionX + column, row: regionY + row)
                let value = (alpha * 255 * mask * outside).rounded()
                bytes[row * width + column] = UInt8(min(255, max(0, value)))
            }
        }
        return bytes
    }

    /// One line blurred with the symmetric kernel, zeros past its ends.
    static func blur(_ line: [Float], weights: [Float], reach: Int) -> [Float] {
        if line.allSatisfy({ $0 == 0 }) {
            return line
        }
        let padded = [Float](repeating: 0, count: reach) + line + [Float](repeating: 0, count: reach)
        var result = [Float](repeating: 0, count: line.count)
        vDSP_conv(padded, 1, weights, 1, &result, 1, vDSP_Length(line.count), vDSP_Length(weights.count))
        return result
    }
}
