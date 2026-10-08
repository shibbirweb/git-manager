// One parity scenario in one color mode: both apps, one after the other, start isolated on the scenario's folder,
// follow its run spec, settle, and are captured by gm-measure itself and sampled for memory. Every failure is kept
// in the outcome (and so in the report) instead of stopping the run, so a capture that fails on CI says so.

import Foundation
import MeasureKit

enum ParityRun {
    struct Options {
        var settleS = 3
        var sampleS = 5
        var appPaths: [AppKind: String] = [:]
    }

    /// What one app left behind: its version and memory, its screenshot, or why not.
    private struct AppResult {
        var version: String?
        var memoryMb: Double?
        var screenshotPath: String?
    }

    static func run(
        _ scenario: ParityScenario, mode: String, demoDir: String, workDir: String, outDir: String, options: Options
    ) async -> ParityOutcome {
        var outcome = ParityOutcome(scenario: scenario.id, mode: mode)
        let name = "\(scenario.id)-\(mode)"
        let shotDir = (outDir as NSString).appendingPathComponent(name)
        try? FileManager.default.createDirectory(atPath: shotDir, withIntermediateDirectories: true)
        var shots: [AppKind: String] = [:]
        for kind in AppKind.allCases {
            var result = AppResult()
            do {
                try await runApp(kind, scenario, mode: mode, demoDir: demoDir, workDir: workDir, shotDir: shotDir,
                                 options: options, result: &result)
            } catch {
                outcome.problems.append("\(kind.rawValue): \(error)")
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
        }
        guard let current = shots[.current], let native = shots[.native] else {
            outcome.problems.append("not compared: a screenshot is missing")
            return outcome
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
        return outcome
    }

    private static func runApp(
        _ kind: AppKind, _ scenario: ParityScenario, mode: String, demoDir: String, workDir: String,
        shotDir: String, options: Options, result: inout AppResult
    ) async throws {
        let spec = scenario.run ?? ParityRunSpec()
        let appPath = options.appPaths[kind] ?? AppLauncher.defaultAppPath(kind, swiftuiDir: swiftuiDir)
        let folderPath = (demoDir as NSString).appendingPathComponent(scenario.folder ?? "")
        let home = (workDir as NSString).appendingPathComponent("\(scenario.id)-\(mode)-\(kind.rawValue)")
        print("\(scenario.id) \(mode) \(kind.rawValue): starting \(appPath)")
        let prefs = kind == .current
            ? try CurrentAppPrefs.apply(appPath: appPath, values: spec.currentStorage ?? [:])
            : nil
        defer { prefs?.restore() }
        let app = try await AppLauncher.launch(
            kind: kind,
            home: home,
            folderPath: folderPath,
            appPath: appPath,
            settings: (spec.currentSettings ?? [:]).mapValues(\.any),
            mode: mode,
            nativeArguments: spec.nativeArguments ?? []
        )
        do {
            let info = try await app.client.call("get_app_info").structured ?? [:]
            result.version = (info["version"] ?? info["appVersion"]).map { "\($0)" }
            try await follow(spec, in: app)
            try await Task.sleep(nanoseconds: UInt64(options.settleS) * 1_000_000_000)
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
            if let captureError {
                throw ToolError("capture failed: \(captureError)")
            }
        } catch {
            await app.stop()
            throw error
        }
        await app.stop()
    }

    /// The run spec's steps: open a diff, then check what the current app must show.
    private static func follow(_ spec: ParityRunSpec, in app: RunningApp) async throws {
        if let filePath = spec.showDiff {
            let staged = spec.staged ?? false
            let shown: ToolAnswer
            if app.kind == .current {
                // The current app knows the repository by its real path (/private/var/..., not /var/...).
                let state = try await app.client.call("get_app_state").structured ?? [:]
                let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
                shown = try await app.client.call(
                    "show_changes_diff", ["repoPath": repoRoot, "filePath": filePath, "staged": staged]
                )
            } else {
                shown = try await app.client.call(
                    "app", ["action": "show_diff", "filePath": filePath, "staged": staged]
                )
            }
            if shown.isError {
                throw ToolError("could not show the diff of \(filePath): \(shown.text)")
            }
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
