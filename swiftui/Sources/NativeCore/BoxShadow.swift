// A CSS box-shadow (no spread) as the current app's popups show it (0 8px 28px, 16% black in light and 50% in
// dark): an 8-bit blur mask of the box, then the shadow color's 8-bit alpha times the mask, rounded, in a layer
// that macOS composites over the window. The blur is close to a Gaussian of 27.6 pixels at 2x (CSS asks for 28)
// whose edge sits 0.2 pixels out, but not exactly: the mask along an edge is a table measured from the current
// app's popups (the values that explain both the light shadow over white and the dark one over --editor-bg), and
// the Gaussian goes on past it. A box larger than the blur is separable: a pixel takes its column's value times its
// row's, less the part the rounded corners cut off.

import CoreGraphics
import Foundation

public struct BoxShadow: Sendable {
    /// The shadow's box in pixels (the border box moved by the shadow's offset, on whole pixels), its corner radius.
    public let box: CGRect
    public let radius: Double
    /// The Gaussian's deviation in pixels.
    public let sigma: Double
    /// The shadow color's alpha in 8 bits (0.16 is 41).
    public let alpha8: Int

    /// The blur deviation for a CSS blur radius in points at `scale` (28 points at 2x: 27.6 pixels).
    public static func sigma(blur: Double, scale: Double) -> Double {
        blur * scale * 27.6 / 56
    }

    /// The edge sits this many pixels outside the box (measured).
    static let edgeShift = 0.2
    /// The measured mask of a 28-point blur at 2x, from 16 pixels inside the edge (index 0) to 69 outside. The last
    /// three are 1, not 2: the popups' 8-bit alpha cannot tell them apart, the conflicts dialog's dark shadow (blended
    /// over the dim at the exact alpha) can.
    static let measuredEdge: [Int] = [
        182, 178, 176, 171, 169, 166, 163, 158, 156, 152, 148, 144, 141, 137, 133, 130, 126, 122, 119, 115, 112, 108,
        104, 101, 97, 94, 90, 87, 84, 80, 77, 74, 71, 68, 65, 62, 59, 56, 53, 51, 48, 46, 43, 41, 39, 37, 35, 33, 31,
        29, 27, 26, 24, 22, 21, 20, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 9, 8, 7, 7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3,
        3, 2, 2, 1, 1, 1,
    ]
    static let measuredStart = -16

    public init(box: CGRect, radius: Double, sigma: Double, alpha: Double) {
        self.box = box
        self.radius = radius
        self.sigma = sigma
        alpha8 = Int((alpha * 255).rounded())
    }

    /// How far the shadow reaches past its box, in pixels: beyond it every pixel is 0.
    public var reach: Double {
        (sigma * 3.2).rounded(.up)
    }

    /// The stored alpha (0...255) of the pixel (x, y).
    public func alpha(x: Int, y: Int) -> Int {
        let value = axis(x, Int(box.minX), Int(box.maxX)) * axis(y, Int(box.minY), Int(box.maxY))
            - corners(Double(x) + 0.5, Double(y) + 0.5)
        return stored(value)
    }

    /// The stored alpha of every pixel of `area` (pixels), row by row.
    public func alphaMap(_ area: CGRect) -> [UInt8] {
        let left = Int(area.minX), top = Int(area.minY), width = Int(area.width), height = Int(area.height)
        let columns = (0..<width).map { axis(left + $0, Int(box.minX), Int(box.maxX)) }
        let rows = (0..<height).map { axis(top + $0, Int(box.minY), Int(box.maxY)) }
        let near = radius + reach
        var map = [UInt8](repeating: 0, count: max(0, width * height))
        for row in 0..<height {
            let y = Double(top + row) + 0.5
            let nearRow = abs(y - box.minY) < near || abs(y - box.maxY) < near
            for column in 0..<width {
                let x = Double(left + column) + 0.5
                var value = columns[column] * rows[row]
                if nearRow && radius > 0 && (abs(x - box.minX) < near || abs(x - box.maxX) < near) {
                    value -= corners(x, y)
                }
                map[row * width + column] = UInt8(stored(value))
            }
        }
        return map
    }

    private func stored(_ value: Double) -> Int {
        let mask8 = Int((max(0, min(1, value)) * 255).rounded())
        return (mask8 * alpha8 + 127) / 255
    }

    /// The mask along one axis at pixel `position` for a box from `low` to `high` (pixel edges): by the nearer edge,
    /// from the measured table where it holds, else the Gaussian.
    func axis(_ position: Int, _ low: Int, _ high: Int) -> Double {
        let outside = position >= high ? position - high : (position < low ? low - 1 - position : nil)
        let inside = min(position - low, high - 1 - position)
        let distance = outside ?? -1 - inside
        let measured = abs(sigma - 27.6) < 0.001
        let index = distance - BoxShadow.measuredStart
        if measured && index >= 0 && index < BoxShadow.measuredEdge.count {
            return Double(BoxShadow.measuredEdge[index]) / 255
        }
        return 0.5 * erfc((Double(distance) + 0.5 + BoxShadow.edgeShift) / (sigma * 2.0.squareRoot()))
    }

    /// The Gaussian weight of the four corner pieces the rounding cuts off, seen from (x, y).
    func corners(_ x: Double, _ y: Double) -> Double {
        let grown = box.insetBy(dx: -BoxShadow.edgeShift, dy: -BoxShadow.edgeShift)
        let corner = min(radius, Double(min(grown.width, grown.height)) / 2)
        guard corner > 0 else {
            return 0
        }
        var total = 0.0
        for (cornerX, cornerY, signX, signY) in [
            (grown.minX, grown.minY, 1.0, 1.0), (grown.maxX, grown.minY, -1.0, 1.0),
            (grown.minX, grown.maxY, 1.0, -1.0), (grown.maxX, grown.maxY, -1.0, -1.0),
        ] {
            total += cornerCut(x: x, y: y, cornerX: cornerX, cornerY: cornerY, signX: signX, signY: signY,
                               corner: corner)
        }
        return total
    }

    /// The Gaussian weight of [from, to] seen from `point`.
    func span(_ point: Double, _ from: Double, _ to: Double) -> Double {
        let scale = sigma * 2.0.squareRoot()
        return 0.5 * (erf((to - point) / scale) - erf((from - point) / scale))
    }

    /// The weight of the part of a corner's square outside its quarter circle.
    func cornerCut(
        x: Double, y: Double, cornerX: Double, cornerY: Double, signX: Double, signY: Double, corner: Double
    ) -> Double {
        let steps = 24
        let step = corner / Double(steps)
        let norm = 1 / (sigma * (2 * Double.pi).squareRoot())
        var total = 0.0
        for index in 0..<steps {
            // u: distance into the corner square from its outer edge, along x.
            let u = (Double(index) + 0.5) * step
            let rest = corner - u
            // Below `cut` (from the outer edge, along y) the square is outside the circle.
            let cut = corner - (corner * corner - rest * rest).squareRoot()
            let distance = x - (cornerX + signX * u)
            let weightX = exp(-distance * distance / (2 * sigma * sigma)) * norm * step
            let toY = cornerY + signY * cut
            total += weightX * span(y, min(cornerY, toY), max(cornerY, toY))
        }
        return total
    }
}
