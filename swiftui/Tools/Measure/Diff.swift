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
        let result = diffImages(try RGBAImage.load(path: arguments[0]), try RGBAImage.load(path: arguments[1]), tolerance: tolerance)
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
        var lines = ["\(result.identicalPercent)% identical (\(result.identicalPixels) of \(result.comparedPixels) pixels, tolerance \(tolerance))"]
        if let mismatch = result.sizeMismatch {
            lines.append("Sizes differ: \(mismatch); compared the top-left \(result.width)x\(result.height)")
        }
        if let box = result.box {
            lines.append("Differences inside x \(box.x), y \(box.y), \(box.width)x\(box.height); largest channel difference \(result.maxChannelDelta)")
        }
        return lines.joined(separator: "\n")
    }
}
