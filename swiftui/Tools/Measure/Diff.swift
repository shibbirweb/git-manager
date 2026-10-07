// gm-measure diff: how many pixels of two screenshots are identical, with an overlay image.
// Exit code 0 when every pixel matches, 1 when some differ.

import Foundation
import MeasureKit

enum Diff {
    static func run(_ arguments: [String]) throws -> Int32 {
        var arguments = arguments
        let out = option("--out", in: &arguments)
        let tolerance = Int(option("--tolerance", in: &arguments) ?? "0") ?? -1
        guard arguments.count == 2, tolerance >= 0 else {
            print(usage)
            return 2
        }
        let first = try RGBAImage.load(path: arguments[0])
        let second = try RGBAImage.load(path: arguments[1])
        let result = diffImages(first, second, tolerance: tolerance)
        if let out {
            try result.overlay.write(path: out)
        }
        print(describe(result, tolerance: tolerance))
        if let out {
            print("Overlay: \(out)")
        }
        return result.differentPixels == 0 && result.sizeMismatch == nil ? 0 : 1
    }

    static func describe(_ result: DiffResult, tolerance: Int) -> String {
        let counts = "\(result.identicalPixels) of \(result.comparedPixels) pixels, tolerance \(tolerance)"
        var lines = ["\(result.identicalPercent)% identical (\(counts))"]
        if let mismatch = result.sizeMismatch {
            lines.append("Sizes differ: \(mismatch); compared the top-left \(result.width)x\(result.height)")
        }
        if let box = result.box {
            let area = "x \(box.x), y \(box.y), \(box.width)x\(box.height)"
            lines.append("Differences inside \(area); largest channel difference \(result.maxChannelDelta)")
        }
        return lines.joined(separator: "\n")
    }
}
