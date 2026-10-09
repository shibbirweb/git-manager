// gm-measure measure --screen merge and --screen conflicts, on the conflict demo (scripts/make-conflict-repo.sh: a
// repository stopped in a merge with every kind of conflict).
//   merge      both apps started as git mergetool on Measure.mergeFile's four files: the merge tool alone. The
//              current app's merge tool over its window cannot be opened from outside (no control tool does, and
//              posting a click needs Accessibility access), while git mergetool shows the same MergeEditor.svelte.
//              The current app runs no control server then, so its memory is read from outside (ExternalMemory).
//   conflicts  both apps on the conflict demo with the conflicts list open: the current app by its Git menu's
//              Resolve Conflicts (run_menu_command git.resolveConflicts), the native app by `app open_conflicts`.

import Foundation
import MeasureKit

extension Measure {
    static let mergeFile = "src/app.ts"

    /// --walk with the native app: memory while its panes scroll down and back (all three, kept together), and
    /// after. The current app as git mergetool has no control server, so it cannot be scrolled from outside.
    static func mergeWalk(
        _ app: MergetoolApp, client: McpClient, opened: Double, options: Options, outDir: String
    ) async throws {
        WindowCapture.bringToFront(pid: app.pid)
        async let walked = client.call("app", ["action": "scroll", "speed": options.walkSpeed, "rounds": 1],
                                       timeout: 60)
        let scrolling = await ExternalMemory.measure(pid: app.pid, durationS: 4)
        let walk = try await walked.structured ?? [:]
        try await Task.sleep(nanoseconds: 2_000_000_000)
        let after = await ExternalMemory.measure(pid: app.pid, durationS: Double(options.durationS))
        let phases: [String: Any] = [
            "openMb": opened, "scrollingMb": scrolling.avgMb, "scrollingPeakMb": scrolling.maxMb,
            "afterMb": after.avgMb, "walk": walk,
        ]
        print("\(app.kind.rawValue): merge memory open \(opened) MB, scrolling \(scrolling.avgMb) MB (peak "
            + "\(scrolling.maxMb)), after \(after.avgMb) MB; frames \(walk["frameMs"] ?? "?")")
        let data = try JSONSerialization.data(withJSONObject: phases, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: URL(fileURLWithPath: (outDir as NSString).appendingPathComponent("merge-memory.json")))
    }

    static func mergeStep(_ screen: String) -> String {
        screen == "merge"
            ? "start as git mergetool on \(mergeFile) of the conflict demo"
            : "open the conflict demo and its conflicts list"
    }

    /// Builds the conflict demo in `workDir`/conflict and returns the repository.
    static func buildConflictDemo(in workDir: String) throws -> String {
        let repoPath = (workDir as NSString).appendingPathComponent("conflict")
        print("Building the conflict demo in \(repoPath) ...")
        let script = (repoRoot as NSString).appendingPathComponent("scripts/make-conflict-repo.sh")
        let made = try AppLauncher.run("/bin/bash", [script, repoPath])
        if made.status != 0 {
            throw ToolError("The conflict demo did not build:\n\(made.output)")
        }
        return repoPath
    }

    static func runMerge(
        _ options: Options, only: AppKind?, appPaths: [AppKind: String?], workDir: String, outDir: String,
        stamp: String
    ) async throws {
        let repoPath = try buildConflictDemo(in: workDir)
        // A fixed folder: the title bar shows MERGED's path, so every run shows the same one.
        let folder = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-measure-mergetool")
        try? FileManager.default.removeItem(atPath: folder)
        let files = try MergetoolFileSet.extract(repoPath: repoPath, filePath: options.mergeFile, into: folder)
        var reports: [MeasureReport.App] = []
        for kind in only.map({ [$0] }) ?? AppKind.allCases {
            let appPath = (appPaths[kind] ?? nil) ?? AppLauncher.defaultAppPath(kind, swiftuiDir: swiftuiDir)
            print("\(kind.rawValue): starting \(appPath)")
            let home = (workDir as NSString).appendingPathComponent("\(kind.rawValue)-home")
            if options.screen == "merge" {
                let app = try await AppLauncher.launchMergetool(
                    kind: kind, home: home, appPath: appPath, mode: options.mode, files: files
                )
                do {
                    reports.append(try await mergeSteps(app, appPath: appPath, outDir: outDir, options: options))
                    await app.stop()
                } catch {
                    await app.stop()
                    throw error
                }
            } else {
                let app = try await AppLauncher.launch(
                    kind: kind, home: home, folderPath: repoPath, appPath: appPath, mode: options.mode
                )
                do {
                    try await openConflicts(app)
                    let tool = MergetoolApp(kind: kind, pid: app.pid, client: app.client, readyMs: app.readyMs)
                    reports.append(try await mergeSteps(tool, appPath: appPath, outDir: outDir, options: options))
                    await app.stop()
                } catch {
                    await app.stop()
                    throw error
                }
            }
        }
        try MeasureReport.write(reports, stamp: stamp, options: options, outDir: outDir)
    }

    /// Opens the conflicts list and waits until it shows.
    static func openConflicts(_ app: RunningApp) async throws {
        if app.kind == .native {
            let opened = try await app.client.call("app", ["action": "open_conflicts"])
            if opened.isError {
                throw ToolError("native: could not open the conflicts list: \(opened.text)")
            }
            return
        }
        let opened = try await app.client.call("run_menu_command", ["action": "git.resolveConflicts"])
        if opened.isError {
            throw ToolError("current: could not open the conflicts list: \(opened.text)")
        }
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline {
            let found = try await app.client.call("inspect_elements", ["selector": ".row.item", "limit": 50])
            if ((found.structured ?? [:])["count"] as? Int ?? 0) > 0 {
                return
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        throw ToolError("current: the conflicts list did not show its files within 10 s")
    }

    /// Settles, captures the window as `measure` does, and samples memory: through the control server when the app
    /// runs one, else from outside.
    static func mergeSteps(
        _ app: MergetoolApp, appPath: String, outDir: String, options: Options
    ) async throws -> MeasureReport.App {
        let kind = app.kind
        let info = try await app.client?.call("get_app_info").structured ?? [:]
        try await Task.sleep(nanoseconds: UInt64(options.settleS) * 1_000_000_000)
        let display = try await options.gate.require("before the \(kind.rawValue) screenshot")
        var screenshotPath: String?
        var screenshotSize: String?
        do {
            WindowCapture.bringToFront(pid: app.pid)
            let png = try WindowCapture.capture(pid: app.pid)
            let path = (outDir as NSString).appendingPathComponent("\(kind.rawValue).png")
            try png.write(to: URL(fileURLWithPath: path))
            let image = try RGBAImage.decode(pngData: png)
            screenshotPath = path
            screenshotSize = "\(image.width)x\(image.height)"
        } catch {
            print("\(kind.rawValue): no screenshot (\(error))")
        }
        if app.kind == .native, let client = app.client,
            let state = try await client.call("app", ["action": "get_state"]).structured {
            // What the native app shows at the capture: the chunks and each pane's scroll, for reading a diff.
            let data = try JSONSerialization.data(withJSONObject: state, options: [.prettyPrinted, .sortedKeys])
            try data.write(to: URL(fileURLWithPath: (outDir as NSString).appendingPathComponent("native-state.json")))
        }
        print("\(kind.rawValue): sampling memory for \(options.durationS) s")
        let measured = await ExternalMemory.measure(pid: app.pid, durationS: Double(options.durationS))
        if options.walkSpeed > 0, let client = app.client {
            try await mergeWalk(app, client: client, opened: measured.avgMb, options: options, outDir: outDir)
        }
        let processes = measured.last.processes.map {
            (label: $0.name, avgMb: Double($0.bytes) / 1_048_576, maxMb: Double($0.bytes) / 1_048_576)
        }
        return MeasureReport.App(
            kind: kind, appPath: appPath,
            name: info["name"] as? String ?? (kind == .current ? "Git Manager" : "Git Manager Native"),
            version: (info["version"] ?? info["appVersion"]).map { "\($0)" } ?? "?",
            serverMs: 0, readyMs: app.readyMs, screenshotPath: screenshotPath, screenshotSize: screenshotSize,
            headroom: display?.headroom, avgMb: measured.avgMb, minMb: measured.minMb, maxMb: measured.maxMb,
            approximate: false, processes: processes
        )
    }
}
