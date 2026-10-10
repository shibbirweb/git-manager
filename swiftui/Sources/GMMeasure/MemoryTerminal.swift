// gm-measure memory --scenario terminal: what the integrated terminal costs in each app. Each app starts isolated on
// the docs demo with gm-measure's shell profile (MeasureTerminal.swift) and is sampled four times: idle with the
// panel closed, with the terminal open at its prompt, while the shell prints --lines lines (a loop that keeps
// printing for a few seconds, through each app's send_terminal_text), and after. Writes
// swiftui/build/measure/<time>-terminal-memory/report.md.

import Foundation
import MeasureKit

enum MemoryTerminal {
    static func run(_ arguments: [String]) async throws -> Int32 {
        var arguments = arguments
        let lines = max(100, Int(option("--lines", in: &arguments) ?? "4000") ?? 4000)
        let sampleS = min(30, max(1, Int(option("--sample", in: &arguments) ?? "5") ?? 5))
        let mode = option("--mode", in: &arguments) ?? "light"
        let only = option("--only", in: &arguments).flatMap(AppKind.init(rawValue:))
        let appPaths: [AppKind: String?] = [
            .current: option("--current-app", in: &arguments),
            .native: option("--native-app", in: &arguments),
        ]
        let gate = try Display.gate(from: &arguments)
        guard arguments.isEmpty, mode == "light" || mode == "dark" else {
            print(usage)
            return 2
        }
        try await gate.require("before the run starts", record: false)
        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let outDir = (swiftuiDir as NSString).appendingPathComponent("build/measure/\(stamp)-terminal-memory")
        try FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
        let workDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-terminal-memory-\(stamp)")
        let folderPath = try Measure.buildDemo(in: workDir)

        var report = "# Terminal memory, \(stamp)\n\n\(lines) lines printed; MB average (peak).\n\n"
        report += "| App | Idle, panel closed | Terminal open | Printing | After |\n|---|---|---|---|---|\n"
        for kind in only.map({ [$0] }) ?? AppKind.allCases {
            let appPath = (appPaths[kind] ?? nil) ?? AppLauncher.defaultAppPath(kind, swiftuiDir: swiftuiDir)
            print("\(kind.rawValue): starting \(appPath)")
            let home = (workDir as NSString).appendingPathComponent("\(kind.rawValue)-home")
            try MeasureTerminal.writeShellProfile(home: home)
            let app = try await AppLauncher.launch(
                kind: kind, home: home, folderPath: folderPath, appPath: appPath,
                settings: ["mcpTools": ["send_terminal_text": true]], mode: mode
            )
            do {
                let phases = try await phases(app, lines: lines, sampleS: sampleS, gate: gate)
                let cells = phases.map { "\(MemoryBench.format($0.avgMb)) (\(MemoryBench.format($0.maxMb)))" }
                report += "| \(kind.rawValue) | " + cells.joined(separator: " | ") + " |\n"
                await app.stop()
            } catch {
                await app.stop()
                throw error
            }
        }
        let path = (outDir as NSString).appendingPathComponent("report.md")
        try report.write(toFile: path, atomically: true, encoding: .utf8)
        print(report)
        print("Wrote \(path)")
        return 0
    }

    private static func phases(
        _ app: RunningApp, lines: Int, sampleS: Int, gate: Display.Gate
    ) async throws -> [MemoryBench.Phase] {
        let name = app.kind.rawValue
        var phases: [MemoryBench.Phase] = []
        try await Task.sleep(nanoseconds: 3_000_000_000)
        try await gate.require("before \(name) idle")
        phases.append(try await MemoryBench.sample(app, "idle", seconds: sampleS))
        try await MeasureTerminal.show(app)
        try await Task.sleep(nanoseconds: 3_000_000_000)
        phases.append(try await MemoryBench.sample(app, "terminal open", seconds: sampleS))
        WindowCapture.bringToFront(pid: app.pid)
        // About a millisecond a line, so the output keeps coming for the whole sample.
        let loop = "for i in $(seq 1 \(lines)); do echo \"line $i: the quick brown fox jumps over the lazy dog\"; "
            + "sleep 0.001; done"
        try await send(app, loop)
        phases.append(try await MemoryBench.sample(app, "printing", seconds: sampleS))
        try await Task.sleep(nanoseconds: 3_000_000_000)
        phases.append(try await MemoryBench.sample(app, "after", seconds: sampleS))
        return phases
    }

    private static func send(_ app: RunningApp, _ text: String) async throws {
        let answer: ToolAnswer
        if app.kind == .native {
            answer = try await app.client.call("app", ["action": "send_terminal_text", "text": text])
        } else {
            let list = try await app.client.call("list_terminals").structured ?? [:]
            let key = (list["terminals"] as? [[String: Any]])?.first?["key"] as? Int ?? 1
            answer = try await app.client.call("send_terminal_text", ["terminalKey": key, "text": text])
        }
        if answer.isError {
            throw ToolError("\(app.kind.rawValue): could not type into the terminal: \(answer.text)")
        }
    }
}
