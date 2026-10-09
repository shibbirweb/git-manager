// One parity scenario in one color mode: both apps, one after the other, start isolated on the scenario's folder,
// follow its run spec, settle, and are captured by gm-measure itself and sampled for memory. Every failure is kept
// in the outcome (and so in the report) instead of stopping the run, so a capture that fails on CI says so; only a
// display in the wrong HDR state stops the run, since every later capture would wait for it the same way.

import Foundation
import MeasureKit

enum ParityRun {
    struct Options {
        var settleS = 3
        var sampleS = 5
        var appPaths: [AppKind: String] = [:]
        /// --hdr and --hdr-wait: the display state each capture needs.
        var gate = Display.Gate(requirement: .off, waitS: 30)
    }

    /// What one app left behind: its version and memory, its screenshot, or why not.
    private struct AppResult {
        var version: String?
        var memoryMb: Double?
        var screenshotPath: String?
        var headroom: Double?
    }

    /// The outcome, and the gate's error when the display was not in the run's HDR state (the run then stops).
    static func run(
        _ scenario: ParityScenario, mode: String, demoDir: String, workDir: String, outDir: String, options: Options
    ) async -> (outcome: ParityOutcome, gateError: DisplayGateError?) {
        var outcome = ParityOutcome(scenario: scenario.id, mode: mode)
        let name = "\(scenario.id)-\(mode)"
        let shotDir = (outDir as NSString).appendingPathComponent(name)
        try? FileManager.default.createDirectory(atPath: shotDir, withIntermediateDirectories: true)
        var shots: [AppKind: String] = [:]
        for kind in AppKind.allCases {
            var result = AppResult()
            var gateError: DisplayGateError?
            do {
                try await runApp(kind, scenario, mode: mode, demoDir: demoDir, workDir: workDir, shotDir: shotDir,
                                 options: options, result: &result)
            } catch let error as DisplayGateError {
                gateError = error
            } catch {
                outcome.problems.append("\(kind.rawValue): \(error)")
            }
            if let headroom = result.headroom {
                outcome.headroom = max(outcome.headroom ?? headroom, headroom)
            }
            if kind == .current {
                outcome.currentVersion = result.version
                outcome.currentMb = result.memoryMb
            } else {
                outcome.nativeVersion = result.version
                outcome.nativeMb = result.memoryMb
            }
            if let path = result.screenshotPath {
                shots[kind] = path
                outcome.files.append("\(name)/\(kind.rawValue).png")
            }
            if let gateError {
                outcome.problems.append("\(kind.rawValue): \(gateError)")
                return (outcome, gateError)
            }
        }
        guard let current = shots[.current], let native = shots[.native] else {
            outcome.problems.append("not compared: a screenshot is missing")
            return (outcome, nil)
        }
        do {
            let first = try RGBAImage.load(path: current)
            let second = try RGBAImage.load(path: native)
            let content = diffImages(first, second, fromRow: WindowCapture.titleBarRows)
            let window = diffImages(first, second)
            try content.overlay.write(path: (shotDir as NSString).appendingPathComponent("diff.png"))
            outcome.files.append("\(name)/diff.png")
            outcome.contentPercent = content.identicalPercent
            outcome.windowPercent = window.identicalPercent
            outcome.differentPixels = content.differentPixels
            outcome.sizeMismatch = content.sizeMismatch
        } catch {
            outcome.problems.append("not compared: \(error)")
        }
        return (outcome, nil)
    }

    private static func runApp(
        _ kind: AppKind, _ scenario: ParityScenario, mode: String, demoDir: String, workDir: String,
        shotDir: String, options: Options, result: inout AppResult
    ) async throws {
        let spec = scenario.run ?? ParityRunSpec()
        let appPath = options.appPaths[kind] ?? AppLauncher.defaultAppPath(kind, swiftuiDir: swiftuiDir)
        // No folder: both apps start on the welcome screen.
        let folderPath = scenario.folder.map { (demoDir as NSString).appendingPathComponent($0) } ?? ""
        let home = (workDir as NSString).appendingPathComponent("\(scenario.id)-\(mode)-\(kind.rawValue)")
        print("\(scenario.id) \(mode) \(kind.rawValue): starting \(appPath)")
        if let filePath = spec.mergetool {
            let shot = try await ParityMergetool.run(
                kind, filePath: filePath, repoPath: folderPath, home: home, appPath: appPath, mode: mode,
                shotPath: (shotDir as NSString).appendingPathComponent("\(kind.rawValue).png"),
                settleS: options.settleS, sampleS: options.sampleS, gate: options.gate,
                moment: "before the \(kind.rawValue) screenshot of \(scenario.id) (\(mode))"
            )
            (result.version, result.memoryMb) = (shot.version, shot.memoryMb)
            (result.screenshotPath, result.headroom) = (shot.screenshotPath, shot.headroom)
            return
        }
        var storage = spec.currentStorage ?? [:]
        if let collapse = spec.collapseUnchanged {
            storage.merge(CurrentAppPrefs.scenario(collapse: collapse)) { _, collapseValue in collapseValue }
        }
        let prefs = kind == .current ? try CurrentAppPrefs.apply(appPath: appPath, values: storage) : nil
        defer { prefs?.restore() }
        if kind == .native, let collapse = spec.collapseUnchanged {
            try Measure.writeNativeDiffPrefs(home: home, collapse: collapse)
        }
        let appSettings = (spec.appSettings ?? [:]).mapValues(\.any)
        if kind == .native {
            try Measure.writeNativeSettings(home: home, values: appSettings)
        }
        if spec.showTerminal == true {
            try MeasureTerminal.writeShellProfile(home: home)
        }
        let app = try await AppLauncher.launch(
            kind: kind,
            home: home,
            folderPath: folderPath,
            appPath: appPath,
            settings: (spec.currentSettings ?? [:]).mapValues(\.any).merging(appSettings) { _, both in both },
            mode: mode,
            nativeArguments: spec.nativeArguments ?? [],
            extraFolders: (spec.extraFolders ?? []).map { (demoDir as NSString).appendingPathComponent($0) }
        )
        do {
            let info = try await app.client.call("get_app_info").structured ?? [:]
            result.version = (info["version"] ?? info["appVersion"]).map { "\($0)" }
            try await follow(spec, in: app)
            try await Task.sleep(nanoseconds: UInt64(options.settleS) * 1_000_000_000)
            let moment = "before the \(kind.rawValue) screenshot of \(scenario.id) (\(mode))"
            result.headroom = try await options.gate.require(moment)?.headroom
            var captureError: Error?
            do {
                WindowCapture.bringToFront(pid: app.pid)
                let png = try WindowCapture.capture(pid: app.pid)
                let path = (shotDir as NSString).appendingPathComponent("\(kind.rawValue).png")
                try png.write(to: URL(fileURLWithPath: path))
                result.screenshotPath = path
            } catch {
                print("\(scenario.id) \(mode) \(kind.rawValue): no screenshot (\(error))")
                captureError = error
            }
            // Memory is still worth having when the capture fails.
            await sample(app, seconds: options.sampleS, into: &result)
            if let filePaths = spec.stageFiles, !filePaths.isEmpty {
                try await Measure.unstageFiles(app, filePaths)
            }
            if let captureError {
                throw ToolError("capture failed: \(captureError)")
            }
        } catch {
            await app.stop()
            throw error
        }
        await app.stop()
    }

    /// The run spec's steps: stage files, open a diff (checking "Collapse unchanged" in both apps when the spec
    /// sets it), open a file, then check what the current app must show.
    private static func follow(_ spec: ParityRunSpec, in app: RunningApp) async throws {
        if let filePaths = spec.stageFiles, !filePaths.isEmpty {
            try await Measure.stageFiles(app, filePaths)
        }
        if spec.openConflicts == true {
            try await Measure.openConflicts(app)
        }
        if let filePath = spec.showDiff {
            try await Measure.showDiff(
                app, filePath: filePath, staged: spec.staged ?? false, collapse: spec.collapseUnchanged
            )
        }
        if let filePath = spec.openFile {
            try await Measure.openFile(app, filePath: filePath)
        }
        if let revision = spec.logCommit {
            try await Measure.showLog(app, revision: revision)
        }
        if let section = spec.openSettings {
            try await Measure.openSettings(app, section: section)
        }
        if spec.showTerminal == true {
            try await MeasureTerminal.show(app)
        }
        if let screen = spec.searchScreen {
            try await Measure.showSearchScreen(app, screen: screen)
        }
        if let screen = spec.editScreen {
            try await Measure.showEditScreen(app, screen: screen)
        }
        if app.kind == .current {
            for expectation in spec.expectCurrent ?? [] {
                try await expect(expectation, in: app)
            }
        }
    }

    /// Waits up to 5 seconds for the element to show (or to be gone).
    private static func expect(_ expectation: ParityExpectation, in app: RunningApp) async throws {
        let deadline = Date().addingTimeInterval(5)
        while true {
            let found = try await app.client.call("inspect_elements", ["selector": expectation.selector, "limit": 1])
            let present = ((found.structured ?? [:])["count"] as? Int ?? 0) > 0
            if present == expectation.present {
                return
            }
            if Date() > deadline {
                let wanted = expectation.present ? "shown" : "gone"
                throw ToolError("expected \(expectation.selector) to be \(wanted) (a setting did not take)")
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
    }

    private static func sample(_ app: RunningApp, seconds: Int, into result: inout AppResult) async {
        guard seconds > 0 else {
            return
        }
        let sample = try? await app.client.call(
            "sample_memory", ["durationMs": seconds * 1000, "intervalMs": 500], timeout: TimeInterval(seconds + 30)
        )
        let total = (sample?.structured ?? [:])["total"] as? [String: Any]
        result.memoryMb = total?["avgMb"] as? Double
    }
}
