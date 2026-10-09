// gm-measure speed: how fast each app answers, timed from the outside the same way for both (FrameRecorder: a
// ScreenCaptureKit stream of the window, the time of each changed frame in one region).
// - search: a repository of --files small files; Find in Files (Shift+Cmd+F, posted), then the query typed key by key
//   as a person would; the time from the first key to the first change in the results, and from the last key until
//   the results settle. Repeated --repeat times in one launch (the query cleared in between).
// - diff: a --lines line file with every eighth line changed; the time from asking for its diff (each app's control
//   tool) until the editor area settles, colors included. One cold diff per launch, --repeat launches.
// - scroll: in that diff, each app's own scroll walk (down and back at --speed points a frame); the frames that
//   reached the screen and the gaps between them.
// Writes swiftui/build/speed/<time>/report.md.

import AppKit
import Foundation
import MeasureKit

enum Speed {
    struct Options {
        var cases: [String] = ["search", "diff", "scroll"]
        var mode = "light"
        var repeats = 3
        var files = 2000
        var lines = 4000
        var speed = 37
        var only: AppKind?
        /// --frames: keep pictures of the changed frames of one search run.
        var frames = false
        var outDir = ""
    }

    /// One measured value, in milliseconds (or a frame count), with the change times it came from (ms).
    struct Sample {
        let kind: AppKind
        let metric: String
        let value: Double?
        var changes: [Double] = []
    }

    static func run(_ arguments: [String]) async throws -> Int32 {
        var arguments = arguments
        var options = Options()
        if let value = option("--case", in: &arguments), value != "all" {
            options.cases = value.split(separator: ",").map(String.init)
        }
        options.mode = option("--mode", in: &arguments) ?? "light"
        options.repeats = max(1, Int(option("--repeat", in: &arguments) ?? "3") ?? 3)
        options.files = max(10, Int(option("--files", in: &arguments) ?? "2000") ?? 2000)
        options.lines = max(100, Int(option("--lines", in: &arguments) ?? "4000") ?? 4000)
        options.speed = max(1, Int(option("--speed", in: &arguments) ?? "37") ?? 37)
        options.only = option("--only", in: &arguments).flatMap(AppKind.init(rawValue:))
        if let index = arguments.firstIndex(of: "--frames") {
            options.frames = true
            arguments.remove(at: index)
        }
        let known = ["search", "diff", "scroll"]
        guard arguments.isEmpty, options.cases.allSatisfy(known.contains) else {
            print("Usage: gm-measure speed [--case search|diff|scroll|all] [--mode light|dark] [--repeat <n>]")
            print("                        [--files <n>] [--lines <n>] [--speed <points>] [--only current|native]")
            return 2
        }
        guard #available(macOS 14.0, *) else {
            print("gm-measure speed needs macOS 14 (ScreenCaptureKit streams).")
            return 1
        }
        guard WindowCapture.ensureAccess(), AccessibilityPress.allowed else {
            print("gm-measure speed needs Screen Recording and Accessibility for the terminal.")
            return 1
        }
        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let workDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-speed-\(stamp)")
        let outDir = (swiftuiDir as NSString).appendingPathComponent("build/speed/\(stamp)")
        try FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
        options.outDir = outDir
        var samples: [Sample] = []
        let kinds = options.only.map { [$0] } ?? AppKind.allCases
        // "Collapse unchanged" on in the current app's localStorage too, as the native app's diff.json says.
        let prefs = kinds.contains(.current)
            ? try CurrentAppPrefs.apply(appPath: AppLauncher.defaultAppPath(.current, swiftuiDir: swiftuiDir))
            : nil
        defer { prefs?.restore() }
        if options.cases.contains("search") {
            let repoPath = try MemorySearch.makeRepo(in: workDir, files: options.files)
            for kind in kinds {
                samples += try await SpeedCases.search(kind, repoPath: repoPath, workDir: workDir, options: options)
            }
        }
        if options.cases.contains("diff") || options.cases.contains("scroll") {
            let repoPath = try MemoryBench.makeRepo(in: workDir, lines: options.lines)
            for kind in kinds {
                samples += try await SpeedCases.diff(kind, repoPath: repoPath, workDir: workDir, options: options)
            }
        }
        let report = SpeedReport.markdown(samples, options: options, stamp: stamp)
        try report.write(toFile: (outDir as NSString).appendingPathComponent("report.md"), atomically: true,
                         encoding: .utf8)
        print(report)
        print("Saved in \(outDir)")
        return 0
    }
}
