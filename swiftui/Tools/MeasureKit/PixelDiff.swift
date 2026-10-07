// Compares two screenshots pixel by pixel: the share of identical pixels, where the differences
// are, and an overlay image (the first screenshot faded, every differing pixel red).

public struct PixelBox: Equatable {
    public let x: Int
    public let y: Int
    public let width: Int
    public let height: Int

    public init(x: Int, y: Int, width: Int, height: Int) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }
}

public struct DiffResult {
    public let width: Int
    public let height: Int
    /// Set when the sizes differ; only the overlapping top-left area is compared.
    public let sizeMismatch: String?
    public let comparedPixels: Int
    public let identicalPixels: Int
    /// Pixels whose largest channel difference is above the tolerance.
    public let differentPixels: Int
    /// Rounded down to two decimals, so 100 means every pixel matched.
    public let identicalPercent: Double
    /// Largest channel difference seen (0 to 255).
    public let maxChannelDelta: Int
    /// The smallest box holding every differing pixel; nil when none differ.
    public let box: PixelBox?
    public let overlay: RGBAImage
}

/// `tolerance` is the largest channel difference still counted as identical (0 = exact).
public func diffImages(_ first: RGBAImage, _ second: RGBAImage, tolerance: Int = 0) -> DiffResult {
    let width = min(first.width, second.width)
    let height = min(first.height, second.height)
    let sizeMismatch = first.width != second.width || first.height != second.height
        ? "\(first.width)x\(first.height) vs \(second.width)x\(second.height)"
        : nil
    var overlay = [UInt8](repeating: 0, count: width * height * 4)
    var identical = 0
    var maxDelta = 0
    var left = width
    var top = height
    var right = -1
    var bottom = -1
    for y in 0..<height {
        for x in 0..<width {
            let at = (y * first.width + x) * 4
            let other = (y * second.width + x) * 4
            let out = (y * width + x) * 4
            var delta = 0
            for channel in 0..<4 {
                delta = max(delta, abs(Int(first.pixels[at + channel]) - Int(second.pixels[other + channel])))
            }
            maxDelta = max(maxDelta, delta)
            if delta <= tolerance {
                identical += 1
                for channel in 0..<3 {
                    overlay[out + channel] = UInt8(255 - (255 - Int(first.pixels[at + channel])) / 4)
                }
            } else {
                overlay[out] = 230
                overlay[out + 1] = 30
                overlay[out + 2] = 30
                left = min(left, x)
                top = min(top, y)
                right = max(right, x)
                bottom = max(bottom, y)
            }
            overlay[out + 3] = 255
        }
    }
    let compared = width * height
    let percent = compared == 0 ? 0 : (Double(identical) / Double(compared) * 10_000).rounded(.down) / 100
    return DiffResult(
        width: width,
        height: height,
        sizeMismatch: sizeMismatch,
        comparedPixels: compared,
        identicalPixels: identical,
        differentPixels: compared - identical,
        identicalPercent: percent,
        maxChannelDelta: maxDelta,
        box: right < 0 ? nil : PixelBox(x: left, y: top, width: right - left + 1, height: bottom - top + 1),
        overlay: RGBAImage(width: width, height: height, pixels: overlay)
    )
}
