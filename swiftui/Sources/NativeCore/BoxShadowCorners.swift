// BoxShadow.corners for every pixel of an area at once. Each corner's 24 steps are a weight along x (one per column)
// times a Gaussian span along y (one per row), so they are worked out once per column and row, and a pixel takes 96
// products where it took 96 exp and 192 erf calls: the Go to Line prompt's backdrop took 0.9 s on the main thread.
// The same products added in the same order, so every value is the same as corners(x, y) gives.

import Foundation

extension BoxShadow {
    struct CornerTable {
        static let steps = 24
        private let width: Int
        /// Per corner: the weights along x, column by column, and the spans along y, row by row, `steps` each.
        private var weights: [[Double]] = []
        private var spans: [[Double]] = []
        private let empty: Bool

        init(_ shadow: BoxShadow, left: Int, top: Int, width: Int, height: Int) {
            self.width = width
            let sigma = shadow.sigma
            let grown = shadow.box.insetBy(dx: -shadow.edgeShiftUsed, dy: -shadow.edgeShiftUsed)
            let corner = min(shadow.radius, Double(min(grown.width, grown.height)) / 2)
            empty = corner <= 0
            guard !empty else {
                return
            }
            let steps = Self.steps
            let step = corner / Double(steps)
            let norm = 1 / (sigma * (2 * Double.pi).squareRoot())
            for (cornerX, cornerY, signX, signY) in [
                (grown.minX, grown.minY, 1.0, 1.0), (grown.maxX, grown.minY, -1.0, 1.0),
                (grown.minX, grown.maxY, 1.0, -1.0), (grown.maxX, grown.maxY, -1.0, -1.0),
            ] {
                var alongX = [Double](repeating: 0, count: width * steps)
                var alongY = [Double](repeating: 0, count: height * steps)
                for index in 0..<steps {
                    let u = (Double(index) + 0.5) * step
                    let rest = corner - u
                    let cut = corner - (corner * corner - rest * rest).squareRoot()
                    for column in 0..<width {
                        let distance = Double(left + column) + 0.5 - (cornerX + signX * u)
                        let weight = exp(-distance * distance / (2 * sigma * sigma)) * norm * step
                        alongX[column * steps + index] = weight
                    }
                    let toY = cornerY + signY * cut
                    for row in 0..<height {
                        alongY[row * steps + index] = shadow.span(Double(top + row) + 0.5, min(cornerY, toY),
                                                                  max(cornerY, toY))
                    }
                }
                weights.append(alongX)
                spans.append(alongY)
            }
        }

        func corners(column: Int, row: Int) -> Double {
            guard !empty else {
                return 0
            }
            let steps = Self.steps
            var total = 0.0
            for piece in 0..<4 {
                var cut = 0.0
                let alongX = weights[piece], alongY = spans[piece]
                let x = column * steps, y = row * steps
                for index in 0..<steps {
                    cut += alongX[x + index] * alongY[y + index]
                }
                total += cut
            }
            return total
        }
    }
}
