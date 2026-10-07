// gm-measure: drives and measures Git Manager and Git Manager Native from the outside
// (docs/plans/swiftui-experiment.md).
//
//   swift run gm-measure measure [--duration <s>] [--settle <s>] [--only current|native]
//                                [--current-app <path>] [--native-app <path>]
//   swift run gm-measure diff <first.png> <second.png> [--out <diff.png>] [--tolerance <n>]
//   swift run gm-measure smoke [--app <path>]
//   swift run gm-measure tokens [--check]
//   swift run gm-measure reference [--modes light,dark] [--current-app <path>]

import Foundation
import MeasureKit

/// swiftui/, from this file's place in the checkout.
let swiftuiDir = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .path
let repoRoot = (swiftuiDir as NSString).deletingLastPathComponent

let usage = """
    Usage:
      gm-measure measure [--duration <s>] [--settle <s>] [--only current|native] [--current-app <path>] [--native-app <path>]
      gm-measure diff <first.png> <second.png> [--out <diff.png>] [--tolerance <n>]
      gm-measure smoke [--app <path>]
      gm-measure tokens [--check]
      gm-measure reference [--modes light,dark] [--current-app <path>]
    """

var arguments = Array(CommandLine.arguments.dropFirst())
let command = arguments.isEmpty ? "" : arguments.removeFirst()
do {
    switch command {
    case "measure":
        try await Measure.run(arguments)
    case "diff":
        exit(try Diff.run(arguments))
    case "smoke":
        exit(try await Smoke.run(arguments))
    case "tokens":
        exit(try Tokens.run(arguments))
    case "reference":
        exit(try await Reference.run(arguments))
    default:
        print(usage)
        exit(2)
    }
} catch {
    FileHandle.standardError.write(Data("gm-measure: \(error)\n".utf8))
    exit(2)
}

/// The value after `--name`, removed from the arguments.
func option(_ name: String, in arguments: inout [String]) -> String? {
    guard let index = arguments.firstIndex(of: name), index + 1 < arguments.count else {
        return nil
    }
    let value = arguments[index + 1]
    arguments.removeSubrange(index...(index + 1))
    return value
}
