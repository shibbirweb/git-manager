// gm-measure memory --screen log: what a long history costs in each app's Log. A fresh repository holds --commits
// commits (3000 by default) on main, with a three-commit branch merged back every 40 commits, so the graph has lanes.
// Each app, isolated, opens it and is sampled: idle, with the Log open (the newest commit and its diff selected),
// while the list scrolls down and back (the current app's scroll_view on the Log, the native app's scroll action),
// and after. Writes swiftui/build/measure/<time>-memory-log/report.md and report.json.

import Foundation
import MeasureKit

extension MemoryBench {
    static func runLog(_ arguments: [String]) async throws -> Int32 {
        var arguments = arguments
        let commits = max(100, Int(option("--commits", in: &arguments) ?? "3000") ?? 3000)
        let sampleS = min(30, max(1, Int(option("--sample", in: &arguments) ?? "5") ?? 5))
        let speed = max(5, Int(option("--speed", in: &arguments) ?? "200") ?? 200)
        let mode = option("--mode", in: &arguments) ?? "light"
        let only = option("--only", in: &arguments).flatMap(AppKind.init(rawValue:))
        let currentApp = option("--current-app", in: &arguments)
        let gate = try Display.gate(from: &arguments)
        guard arguments.isEmpty, mode == "light" || mode == "dark" else {
            print(usage)
            return 2
        }
        try await gate.require("before the run starts", record: false)
        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let outDir = (swiftuiDir as NSString).appendingPathComponent("build/measure/\(stamp)-memory-log")
        try FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
        let workDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-memory-log-\(stamp)")
        let repoPath = try makeHistory(in: workDir, commits: commits)

        var runs: [AppRun] = []
        for kind in only.map({ [$0] }) ?? AppKind.allCases {
            let appPath = (kind == .current ? currentApp : nil)
                ?? AppLauncher.defaultAppPath(kind, swiftuiDir: swiftuiDir)
            print("\(kind.rawValue): starting \(appPath)")
            let home = (workDir as NSString).appendingPathComponent("\(kind.rawValue)-home")
            let app = try await AppLauncher.launch(
                kind: kind, home: home, folderPath: repoPath, appPath: appPath, mode: mode
            )
            do {
                runs.append(try await logPhases(app, sampleS: sampleS, speed: speed, gate: gate))
                await app.stop()
            } catch {
                await app.stop()
                throw error
            }
        }
        try writeLog(runs, commits: commits, speed: speed, gate: gate, outDir: outDir)
        return 0
    }

    private static func logPhases(
        _ app: RunningApp, sampleS: Int, speed: Int, gate: Display.Gate
    ) async throws -> AppRun {
        let name = app.kind.rawValue
        var phases: [Phase] = []
        try await Task.sleep(nanoseconds: 3_000_000_000)
        try await gate.require("before \(name) idle")
        phases.append(try await sample(app, "idle", seconds: sampleS))
        try await Measure.showLog(app)
        try await Task.sleep(nanoseconds: 3_000_000_000)
        try await gate.require("before \(name) log open")
        phases.append(try await sample(app, "log open", seconds: sampleS))

        print("\(name): scrolling the Log")
        try await gate.require("before \(name) scrolling")
        WindowCapture.bringToFront(pid: app.pid)
        async let scrolled = scrollLog(app, speed: speed)
        async let during = sample(app, "scrolling", seconds: 12)
        let (scroll, scrollPhase) = try await (scrolled, during)
        phases.append(scrollPhase)
        try await Task.sleep(nanoseconds: 3_000_000_000)
        try await gate.require("before \(name) after scrolling")
        phases.append(try await sample(app, "after scrolling", seconds: sampleS))
        return AppRun(kind: app.kind, phases: phases, scroll: scroll)
    }

    private static func scrollLog(_ app: RunningApp, speed: Int) async throws -> [String: Any] {
        let answer: ToolAnswer
        if app.kind == .current {
            answer = try await app.client.call("scroll_view", ["target": "log", "speed": speed], timeout: 40)
        } else {
            answer = try await app.client.call("app", ["action": "scroll", "speed": speed], timeout: 40)
        }
        if answer.isError {
            throw ToolError("\(app.kind.rawValue): could not scroll the Log: \(answer.text)")
        }
        return answer.structured ?? [:]
    }

    /// `commits` commits written with git fast-import (seconds, not minutes): main changes log.txt in each, and every
    /// 40th commit merges a three-commit branch started 4 commits earlier.
    static func makeHistory(in workDir: String, commits: Int) throws -> String {
        let repoPath = (workDir as NSString).appendingPathComponent("history")
        try FileManager.default.createDirectory(atPath: repoPath, withIntermediateDirectories: true)
        var stream = ""
        var mark = 0
        var time = 1_700_000_000
        func commit(_ ref: String, message: String, from: Int?, merge: Int? = nil) -> Int {
            mark += 1
            time += 600
            let text = "\(message)\n"
            stream += "commit \(ref)\nmark :\(mark)\n"
            stream += "author Log Bench <bench@example.com> \(time) +0000\n"
            stream += "committer Log Bench <bench@example.com> \(time) +0000\n"
            stream += "data \(message.utf8.count)\n\(message)\n"
            if let from {
                stream += "from :\(from)\n"
            }
            if let merge {
                stream += "merge :\(merge)\n"
            }
            stream += "M 644 inline log.txt\ndata \(text.utf8.count)\n\(text)\n"
            return mark
        }
        var main: Int?
        var history: [Int] = []
        var made = 0
        while made < commits {
            if made % 40 == 39, history.count > 4 {
                var topic = history[history.count - 4]
                for step in 1...3 {
                    topic = commit("refs/heads/topic", message: "Topic work \(made) step \(step)", from: topic)
                }
                main = commit("refs/heads/main", message: "Merge topic \(made)", from: main, merge: topic)
                made += 4
            } else {
                main = commit("refs/heads/main", message: "Change \(made + 1) of the bench history", from: main)
                made += 1
            }
            history.append(main ?? 0)
        }
        let streamPath = (workDir as NSString).appendingPathComponent("history.fi")
        try stream.write(toFile: streamPath, atomically: true, encoding: .utf8)
        let script = "git init -q -b main && git fast-import --quiet < '\(streamPath)' && git checkout -q main"
        let result = try AppLauncher.run(
            "/usr/bin/env", ["GIT_CONFIG_GLOBAL=/dev/null", "GIT_CONFIG_NOSYSTEM=1", "/bin/sh", "-c", script],
            in: repoPath
        )
        if result.status != 0 {
            throw ToolError("The bench history did not build: \(result.output)")
        }
        print("Repository with \(made) commits: \(repoPath)")
        return repoPath
    }

    private static func writeLog(
        _ runs: [AppRun], commits: Int, speed: Int, gate: Display.Gate, outDir: String
    ) throws {
        var text = "# Memory with a long history\n\n"
        text += "A history of \(commits) commits with a merged branch every 40, shown in the Log (the newest commit "
        text += "and its diff selected) and scrolled down and back at \(speed) points a frame. Memory as Activity "
        text += "Monitor counts it, all processes of the app; deltas against idle.\n\n"
        text += gate.markdownLine + "\n\n"
        text += "| App | Phase | Average MB | Peak MB | Average vs idle |\n| --- | --- | --- | --- | --- |\n"
        var json: [[String: Any]] = []
        for run in runs {
            let idle = run.phases.first?.avgMb ?? 0
            for phase in run.phases {
                let delta = phase.avgMb - idle
                text += "| \(run.kind.rawValue) | \(phase.name) | \(format(phase.avgMb)) | \(format(phase.maxMb)) | "
                text += "\(delta >= 0 ? "+" : "")\(format(delta)) |\n"
            }
            json.append([
                "app": run.kind.rawValue,
                "phases": run.phases.map { ["name": $0.name, "avgMb": $0.avgMb, "maxMb": $0.maxMb] },
                "scroll": run.scroll,
            ])
        }
        try text.write(toFile: (outDir as NSString).appendingPathComponent("report.md"), atomically: true,
                       encoding: .utf8)
        let report: [String: Any] = ["commits": commits, "speed": speed, "apps": json, "display": gate.json]
        let data = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: URL(fileURLWithPath: (outDir as NSString).appendingPathComponent("report.json")))
        print(text)
        print("Saved in \(outDir)")
    }
}
