// An SVG elliptical arc as cubic curves: the SVG spec's endpoint-to-center conversion (implementation notes
// B.2.4), then one curve per quarter turn or less, the way browsers draw arcs.

import CoreGraphics
import Foundation

enum SVGArc {
    static func add(
        to path: CGMutablePath, from start: CGPoint, to end: CGPoint, radii: CGSize, rotation degrees: CGFloat,
        largeArc: Bool, sweep: Bool
    ) {
        var radiusX = abs(radii.width)
        var radiusY = abs(radii.height)
        if start == end {
            return
        }
        if radiusX == 0 || radiusY == 0 {
            path.addLine(to: end)
            return
        }
        let angle = degrees * .pi / 180
        let cosine = cos(angle)
        let sine = sin(angle)
        // The start point in the ellipse's own frame, centered between the two points.
        let halfX = (start.x - end.x) / 2
        let halfY = (start.y - end.y) / 2
        let primeX = cosine * halfX + sine * halfY
        let primeY = -sine * halfX + cosine * halfY
        // Radii too small to reach the end point grow just enough.
        let scale = (primeX * primeX) / (radiusX * radiusX) + (primeY * primeY) / (radiusY * radiusY)
        if scale > 1 {
            radiusX *= scale.squareRoot()
            radiusY *= scale.squareRoot()
        }
        let numerator = radiusX * radiusX * radiusY * radiusY - radiusX * radiusX * primeY * primeY
            - radiusY * radiusY * primeX * primeX
        let denominator = radiusX * radiusX * primeY * primeY + radiusY * radiusY * primeX * primeX
        var factor = (max(0, numerator) / denominator).squareRoot()
        if largeArc == sweep {
            factor = -factor
        }
        let centerPrimeX = factor * radiusX * primeY / radiusY
        let centerPrimeY = -factor * radiusY * primeX / radiusX
        let center = CGPoint(
            x: cosine * centerPrimeX - sine * centerPrimeY + (start.x + end.x) / 2,
            y: sine * centerPrimeX + cosine * centerPrimeY + (start.y + end.y) / 2
        )
        let startAngle = atan2((primeY - centerPrimeY) / radiusY, (primeX - centerPrimeX) / radiusX)
        let endAngle = atan2((-primeY - centerPrimeY) / radiusY, (-primeX - centerPrimeX) / radiusX)
        var delta = endAngle - startAngle
        if sweep && delta < 0 {
            delta += 2 * .pi
        } else if !sweep && delta > 0 {
            delta -= 2 * .pi
        }
        let segments = max(1, Int((abs(delta) / (.pi / 2)).rounded(.up)))
        let step = delta / CGFloat(segments)
        // Control point distance for a circular arc of `step` radians.
        let handle = 4 / 3 * tan(step / 4)
        let pointAt = { (theta: CGFloat) -> CGPoint in
            let x = radiusX * cos(theta)
            let y = radiusY * sin(theta)
            return CGPoint(x: center.x + cosine * x - sine * y, y: center.y + sine * x + cosine * y)
        }
        let tangentAt = { (theta: CGFloat) -> CGPoint in
            let x = -radiusX * sin(theta)
            let y = radiusY * cos(theta)
            return CGPoint(x: cosine * x - sine * y, y: sine * x + cosine * y)
        }
        var theta = startAngle
        for _ in 0..<segments {
            let next = theta + step
            let from = pointAt(theta)
            let to = pointAt(next)
            let fromTangent = tangentAt(theta)
            let toTangent = tangentAt(next)
            path.addCurve(
                to: to,
                control1: CGPoint(x: from.x + handle * fromTangent.x, y: from.y + handle * fromTangent.y),
                control2: CGPoint(x: to.x - handle * toTangent.x, y: to.y - handle * toTangent.y)
            )
            theta = next
        }
    }
}
