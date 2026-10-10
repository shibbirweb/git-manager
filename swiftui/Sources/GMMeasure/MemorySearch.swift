// gm-measure memory-search: what Quick Open, the Command Palette and Find in Files cost in each app, on a large
// generated repository (--files files, 4000 by default, in nested folders, each a 120-line PHP class). Each app,
// isolated, is sampled: idle, with the Command Palette open, with Quick Open's file index built (Go to File), with
// Find in Files showing its results for `query` (capped at 2,000 matches, as both apps cap it), and after closing
// it. The current app takes its query from the editor's selection, so it opens one file first. Writes
// swiftui/build/measure/<time>-memory-search/report.md.

import Foundation
import MeasureKit

enum MemorySearch {
    static let query = "reserve"

    static func run(_ arguments: [String]) async throws -> Int32 {
        var arguments = arguments
        let fileCount = max(100, Int(option("--files", in: &arguments) ?? "4000") ?? 4000)
        let sampleS = min(30, max(1, Int(option("--sample", in: &arguments) ?? "5") ?? 5))
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
        let outDir = (swiftuiDir as NSString).appendingPathComponent("build/measure/\(stamp)-memory-search")
        try FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
        let workDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-memory-search-\(stamp)")
        let repoPath = try makeRepo(in: workDir, files: fileCount)

        var lines = ["# Search memory: \(stamp)", "", "\(fileCount) files of 120 lines; Find in Files for "
            + "\"\(query)\". \(gate.markdownLine)", "", "| Phase | Current app | Native app |", "|---|---|---|"]
        var results: [AppKind: [MemoryBench.Phase]] = [:]
        for kind in only.map({ [$0] }) ?? AppKind.allCases {
            let appPath = kind == .current
                ? currentApp ?? AppLauncher.defaultAppPath(.current, swiftuiDir: swiftuiDir)
                : AppLauncher.defaultAppPath(.native, swiftuiDir: swiftuiDir)
            print("\(kind.rawValue): starting \(appPath)")
            let home = (workDir as NSString).appendingPathComponent("\(kind.rawValue)-home")
            let app = try await AppLauncher.launch(kind: kind, home: home, folderPath: repoPath, appPath: appPath,
                                                   mode: mode)
            do {
                results[kind] = try await phases(app, repoPath: repoPath, sampleS: sampleS, gate: gate)
                await app.stop()
            } catch {
                await app.stop()
                throw error
            }
        }
        let names = (results[.current] ?? results[.native] ?? []).map(\.name)
        for (index, name) in names.enumerated() {
            let cell = { (kind: AppKind) -> String in
                guard let phase = results[kind]?[index] else {
                    return "-"
                }
                return "\(MemoryBench.format(phase.avgMb)) MB (peak \(MemoryBench.format(phase.maxMb)))"
            }
            lines.append("| \(name) | \(cell(.current)) | \(cell(.native)) |")
        }
        let report = lines.joined(separator: "\n") + "\n"
        try report.write(toFile: (outDir as NSString).appendingPathComponent("report.md"), atomically: true,
                         encoding: .utf8)
        print(report)
        return 0
    }

    private static func phases(
        _ app: RunningApp, repoPath: String, sampleS: Int, gate: Display.Gate
    ) async throws -> [MemoryBench.Phase] {
        var phases: [MemoryBench.Phase] = []
        let step = { (name: String) async throws in
            try await Task.sleep(nanoseconds: 3_000_000_000)
            try await gate.require("before \(app.kind.rawValue) \(name)")
            phases.append(try await sample(app, name, seconds: sampleS))
        }
        try await step("idle")
        try await open(app, screen: "palette", repoPath: repoPath)
        try await step("Command Palette open")
        try await open(app, screen: "files", repoPath: repoPath)
        try await step("Go to File, index built")
        try await open(app, screen: "search", repoPath: repoPath)
        try await step("Find in Files results")
        try await call(app, app.kind == .native ? "app" : "close_dialog",
                       app.kind == .native ? ["action": "close_dialog"] : [:])
        try await step("after closing")
        return phases
    }

    private static func open(_ app: RunningApp, screen: String, repoPath: String) async throws {
        if app.kind == .native {
            var args: [String: Any] = ["action": "quick_open", "prefix": screen == "palette" ? ">" : ""]
            if screen == "search" {
                args = ["action": "search", "query": query]
            }
            try await call(app, "app", args)
            return
        }
        _ = try? await app.client.call("close_dialog")
        switch screen {
        case "palette":
            try await call(app, "run_menu_command", ["action": "view.commandPalette"])
        case "files":
            try await call(app, "run_menu_command", ["action": "edit.goToFile"])
        default:
            let state = try await app.client.call("get_app_state").structured ?? [:]
            let root = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? repoPath
            let filePath = "\(root)/\(fileName(0))"
            // Line 5 holds "public function reserve0(...)": the caret on "reserve0" selects the word.
            try await call(app, "open_file", ["filePath": filePath, "line": 5, "column": 21])
            try await call(app, "run_menu_command", ["action": "code.selectNextOccurrence"])
            try await call(app, "run_menu_command", ["action": "edit.findInFiles"])
        }
    }

    private static func call(_ app: RunningApp, _ toolName: String, _ args: [String: Any]) async throws {
        let answer = try await app.client.call(toolName, args, timeout: 60)
        if answer.isError {
            throw ToolError("\(app.kind.rawValue): \(toolName) \(args) failed: \(answer.text)")
        }
    }

    private static func sample(_ app: RunningApp, _ name: String, seconds: Int) async throws -> MemoryBench.Phase {
        let answer = try await app.client.call(
            "sample_memory", ["durationMs": seconds * 1000, "intervalMs": 250], timeout: TimeInterval(seconds + 30)
        )
        let total = answer.structured?["total"] as? [String: Any] ?? [:]
        let phase = MemoryBench.Phase(name: name, avgMb: total["avgMb"] as? Double ?? 0,
                                      maxMb: total["maxMb"] as? Double ?? 0)
        print("\(app.kind.rawValue): \(name) avg \(MemoryBench.format(phase.avgMb)) MB")
        return phase
    }

    static func fileName(_ index: Int) -> String {
        "src/module\(index / 100)/group\(index / 10 % 10)/Item\(index).php"
    }

    /// A git repository of `files` small PHP classes, one commit.
    static func makeRepo(in workDir: String, files: Int) throws -> String {
        let repoPath = (workDir as NSString).appendingPathComponent("search")
        for index in 0..<files {
            let filePath = (repoPath as NSString).appendingPathComponent(fileName(index))
            try FileManager.default.createDirectory(
                atPath: (filePath as NSString).deletingLastPathComponent, withIntermediateDirectories: true
            )
            let head = ["<?php", "", "final class Item\(index)", "{",
                        "    public function reserve\(index)(int $count): int", "    {"]
            let body = (0..<110).map { "        $total\($0) = $count * \($0 % 7 + 1); // stock line \($0)" }
            let lines = head + body + ["        return $count;", "    }", "}"]
            let text = lines.joined(separator: "\n") + "\n"
            try text.write(toFile: filePath, atomically: true, encoding: .utf8)
        }
        let git = { (arguments: [String]) throws in
            let result = try AppLauncher.run(
                "/usr/bin/env", ["GIT_CONFIG_GLOBAL=/dev/null", "GIT_CONFIG_NOSYSTEM=1", "git", "-c",
                                 "user.name=gm-measure", "-c", "user.email=gm-measure@example.com"] + arguments,
                in: repoPath
            )
            if result.status != 0 {
                throw ToolError("git \(arguments.joined(separator: " ")): \(result.output)")
            }
        }
        try git(["init", "-q", "-b", "main"])
        try git(["add", "."])
        try git(["commit", "-q", "-m", "Items"])
        print("Repository with \(files) files: \(repoPath)")
        return repoPath
    }
}
