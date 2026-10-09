// gm-measure: drives and measures Git Manager and Git Manager Native from the outside
// (docs/plans/swiftui-experiment.md).
//
//   swift run gm-measure measure [--mode light|dark] [--theme <id>] [--collapse on|off]
//                                [--screen changes|diff|staged|file|log|settings|terminal|quickopen|palette|search|
//                                 merge|conflicts|edit|fold|blame|workspace|folders|cleanrepos|norepo|foldermenu|
//                                 repomenu|branchmenu|foldermenurecent|welcome|welcomerecent|welcomecustomize|
//                                 welcomelearn|welcomeclone|closefolder|workspacefile]
//                                [--file <path>]
//                                [--walk <points>] [--duration <s>] [--settle <s>] [--only current|native]
//                                [--current-app <path>] [--native-app <path>] [--hdr off|any] [--hdr-wait <s>]
//   swift run gm-measure memory [--lines <n>] [--sample <s>] [--speed <points>] [--mode light|dark]
//                               [--screen diff|file] [--only current|native] [--current-app <path>]
//                               [--native-app <path>] [--hdr off|any] [--hdr-wait <s>]
//   swift run gm-measure memory --screen log [--commits <n>] [--current-app <path>] (and the options above)
//   swift run gm-measure memory --scenario terminal [--lines <n>] [--sample <s>] [--current-app <path>] [...]
//   swift run gm-measure memory-search [--files <n>] [--sample <s>] [--mode light|dark] [--only current|native]
//                                      [--current-app <path>] [--hdr off|any] [--hdr-wait <s>]
//   swift run gm-measure diff <first.png> <second.png> [--out <diff.png>] [--tolerance <n>]
//   swift run gm-measure smoke [--app <path>]
//   swift run gm-measure tokens [--check]
//   swift run gm-measure icons [--check]
//   swift run gm-measure commands [--check]
//   swift run gm-measure reference [--modes light,dark] [--screens changes,log,diff,file] [--current-app <path>]
//                                  [--hdr off|any] [--hdr-wait <s>]
//   swift run gm-measure parity [--scenarios a,b] [--modes light,dark] [--settle <s>] [--sample <s>]
//                               [--current-app <path>] [--native-app <path>] [--record] [--hdr off|any]
//                               [--hdr-wait <s>]
//   swift run gm-measure parity list | summary [--check]
//   swift run gm-measure display [--hdr off|any] [--json]
//
// --hdr off (the default) waits before each capture until the display has no HDR headroom (1.0), up to --hdr-wait
// seconds (30), then stops; --hdr any only records the state. Reports give the headroom of every capture.

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
      gm-measure measure [--mode light|dark] [--theme <id>]
                         [--screen changes|diff|staged|file|log|settings|terminal|quickopen|palette|search|
                          merge|conflicts|edit|fold|blame|workspace|folders|cleanrepos|norepo|foldermenu|
                          repomenu|branchmenu|foldermenurecent|welcome|welcomerecent|welcomecustomize|
                          welcomelearn|welcomeclone|closefolder|workspacefile]
                         [--file <path>]
                         [--collapse on|off]
                         [--walk <points>] [--duration <s>] [--settle <s>] [--only current|native]
                         [--current-app <path>] [--native-app <path>] [--hdr off|any] [--hdr-wait <s>]
      gm-measure memory [--lines <n>] [--sample <s>] [--speed <points>] [--mode light|dark] [--screen diff|file|log]
                        [--only current|native] [--current-app <path>] [--native-app <path>] [--commits <n>]
                        [--hdr off|any] [--hdr-wait <s>]
      gm-measure memory --screen log [--commits <n>] [--current-app <path>] (and the options above)
      gm-measure memory --scenario terminal [--lines <n>] [--sample <s>] [--mode light|dark] [--current-app <path>]
      gm-measure memory-search [--files <n>] [--sample <s>] [--mode light|dark] [--only current|native]
                               [--current-app <path>] [--hdr off|any] [--hdr-wait <s>]
      gm-measure speed [--case search|diff|scroll|all] [--mode light|dark] [--repeat <n>] [--files <n>]
                       [--lines <n>] [--speed <points>] [--only current|native]
      gm-measure diff <first.png> <second.png> [--out <diff.png>] [--tolerance <n>]
      gm-measure smoke [--app <path>]
      gm-measure tokens [--check]
      gm-measure icons [--check]
      gm-measure commands [--check]
      gm-measure reference [--modes light,dark] [--screens changes,log,diff,file] [--current-app <path>]
                           [--hdr off|any] [--hdr-wait <s>]
      gm-measure parity [--scenarios a,b] [--modes light,dark] [--settle <s>] [--sample <s>]
                        [--current-app <path>] [--native-app <path>] [--record] [--hdr off|any] [--hdr-wait <s>]
      gm-measure parity list | summary [--check]
      gm-measure display [--hdr off|any] [--json]

    --hdr off (the default) needs HDR headroom 1.0 before each capture (waits up to --hdr-wait, 30 s); any records it.
    """

var arguments = Array(CommandLine.arguments.dropFirst())
let command = arguments.isEmpty ? "" : arguments.removeFirst()
do {
    switch command {
    case "measure":
        try await Measure.run(arguments)
    case "memory":
        exit(try await MemoryBench.run(arguments))
    case "diff":
        exit(try Diff.run(arguments))
    case "smoke":
        exit(try await Smoke.run(arguments))
    case "tokens":
        exit(try Tokens.run(arguments))
    case "icons":
        exit(try Icons.run(arguments))
    case "commands":
        exit(try Commands.run(arguments))
    case "memory-search":
        exit(try await MemorySearch.run(arguments))
    case "speed":
        exit(try await Speed.run(arguments))
    case "reference":
        exit(try await Reference.run(arguments))
    case "parity":
        exit(try await Parity.run(arguments))
    case "display":
        exit(try Display.run(arguments))
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
