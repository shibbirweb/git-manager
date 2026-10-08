// gm-measure memory: what a big file costs in each app. A fresh repository holds a generated PHP file of --lines
// lines (4000 by default) with every eighth line changed, so the diff folds nothing. Each app, isolated, opens the
// repository and is sampled four times: idle, with the file's diff open, while scrolling it down and back (the
// current app's scroll_view tool, the native app's scroll action), and after scrolling. Writes
// swiftui/build/measure/<time>-memory/report.md and report.json.

import Foundation
import MeasureKit

enum MemoryBench {
    struct Phase {
        let name: String
        let avgMb: Double
        let maxMb: Double
    }

    struct AppRun {
        let kind: AppKind
        let phases: [Phase]
        let scroll: [String: Any]
    }

    static let fileName = "src/Inventory.php"

    static func run(_ arguments: [String]) async throws -> Int32 {
        var arguments = arguments
        let lines = max(100, Int(option("--lines", in: &arguments) ?? "4000") ?? 4000)
        let sampleS = min(30, max(1, Int(option("--sample", in: &arguments) ?? "5") ?? 5))
        let speed = max(5, Int(option("--speed", in: &arguments) ?? "200") ?? 200)
        let mode = option("--mode", in: &arguments) ?? "light"
        let only = option("--only", in: &arguments).flatMap(AppKind.init(rawValue:))
        let gate = try Display.gate(from: &arguments)
        guard arguments.isEmpty, mode == "light" || mode == "dark" else {
            print(usage)
            return 2
        }
        try await gate.require("before the run starts", record: false)
        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let outDir = (swiftuiDir as NSString).appendingPathComponent("build/measure/\(stamp)-memory")
        try FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
        let workDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-memory-\(stamp)")
        let repoPath = try makeRepo(in: workDir, lines: lines)

        var runs: [AppRun] = []
        for kind in only.map({ [$0] }) ?? AppKind.allCases {
            let appPath = AppLauncher.defaultAppPath(kind, swiftuiDir: swiftuiDir)
            print("\(kind.rawValue): starting \(appPath)")
            let home = (workDir as NSString).appendingPathComponent("\(kind.rawValue)-home")
            let app = try await AppLauncher.launch(
                kind: kind, home: home, folderPath: repoPath, appPath: appPath, mode: mode
            )
            do {
                runs.append(try await phases(app, sampleS: sampleS, speed: speed, gate: gate))
                await app.stop()
            } catch {
                await app.stop()
                throw error
            }
        }
        try write(runs, lines: lines, speed: speed, gate: gate, outDir: outDir)
        return 0
    }

    /// Each phase starts once the display meets the run's HDR requirement (the scroll's frame times and the GPU's
    /// memory depend on it too).
    private static func phases(
        _ app: RunningApp, sampleS: Int, speed: Int, gate: Display.Gate
    ) async throws -> AppRun {
        let name = app.kind.rawValue
        var phases: [Phase] = []
        try await Task.sleep(nanoseconds: 3_000_000_000)
        try await gate.require("before \(name) idle")
        phases.append(try await sample(app, "idle", seconds: sampleS))
        try await showDiff(app)
        try await Task.sleep(nanoseconds: 3_000_000_000)
        try await gate.require("before \(name) diff open")
        phases.append(try await sample(app, "diff open", seconds: sampleS))

        print("\(name): scrolling")
        try await gate.require("before \(name) scrolling")
        WindowCapture.bringToFront(pid: app.pid)
        async let scrolled = scroll(app, speed: speed)
        async let during = sample(app, "scrolling", seconds: 12)
        let (scroll, scrollPhase) = try await (scrolled, during)
        phases.append(scrollPhase)
        try await Task.sleep(nanoseconds: 3_000_000_000)
        try await gate.require("before \(name) after scrolling")
        phases.append(try await sample(app, "after scrolling", seconds: sampleS))
        return AppRun(kind: app.kind, phases: phases, scroll: scroll)
    }

    private static func sample(_ app: RunningApp, _ name: String, seconds: Int) async throws -> Phase {
        let answer = try await app.client.call(
            "sample_memory", ["durationMs": seconds * 1000, "intervalMs": 250], timeout: TimeInterval(seconds + 30)
        )
        let total = answer.structured?["total"] as? [String: Any] ?? [:]
        let phase = Phase(name: name, avgMb: total["avgMb"] as? Double ?? 0, maxMb: total["maxMb"] as? Double ?? 0)
        print("\(app.kind.rawValue): \(name) avg \(format(phase.avgMb)) MB, max \(format(phase.maxMb)) MB")
        return phase
    }

    private static func showDiff(_ app: RunningApp) async throws {
        let shown: ToolAnswer
        if app.kind == .current {
            let state = try await app.client.call("get_app_state").structured ?? [:]
            let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
            shown = try await app.client.call("show_changes_diff", ["repoPath": repoRoot, "filePath": fileName])
        } else {
            shown = try await app.client.call("app", ["action": "show_diff", "filePath": fileName])
        }
        if shown.isError {
            throw ToolError("\(app.kind.rawValue): could not show the diff: \(shown.text)")
        }
    }

    /// The current app scrolls the merge view (its largest scrollable area); both walk at `speed` points a frame.
    static func scroll(_ app: RunningApp, speed: Int) async throws -> [String: Any] {
        let answer: ToolAnswer
        if app.kind == .current {
            answer = try await app.client.call("scroll_view", ["target": "auto", "speed": speed], timeout: 40)
        } else {
            answer = try await app.client.call("app", ["action": "scroll", "speed": speed], timeout: 40)
        }
        if answer.isError {
            throw ToolError("\(app.kind.rawValue): could not scroll: \(answer.text)")
        }
        return answer.structured ?? [:]
    }

    static func format(_ megabytes: Double) -> String {
        String(format: "%.1f", megabytes)
    }
}
