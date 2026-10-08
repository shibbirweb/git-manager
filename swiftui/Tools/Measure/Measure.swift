// gm-measure measure: the side-by-side scenario. Both apps, one after the other, do the same steps on a fresh
// copy of the docs demo (scripts/make-docs-demo.sh): start isolated on acme/storefront, wait until its status is
// on screen, settle, screenshot, sample memory, quit. Steps the native app cannot do yet (open files, scroll,
// diffs) join the scenario for both apps as it learns them. Writes swiftui/build/measure/<time>/report.md,
// report.json, both screenshots and their pixel diff (MeasureReport.swift).

import Foundation
import MeasureKit

enum Measure {
    struct Options {
        var durationS = 20
        var settleS = 5
        var mode = "light"
        /// "changes" (the folder as it opens) or "diff" (the diff of Reference.diffFile).
        var screen = "changes"
    }

    static func run(_ arguments: [String]) async throws {
        var arguments = arguments
        var options = Options()
        options.durationS = min(60, max(1, Int(option("--duration", in: &arguments) ?? "20") ?? 20))
        options.settleS = max(0, Int(option("--settle", in: &arguments) ?? "5") ?? 5)
        options.mode = option("--mode", in: &arguments) ?? "light"
        options.screen = option("--screen", in: &arguments) ?? "changes"
        let only = option("--only", in: &arguments).flatMap(AppKind.init(rawValue:))
        let appPaths: [AppKind: String?] = [
            .current: option("--current-app", in: &arguments),
            .native: option("--native-app", in: &arguments),
        ]
        let validScreen = options.screen == "changes" || options.screen == "diff"
        guard arguments.isEmpty, options.mode == "light" || options.mode == "dark", validScreen else {
            print(usage)
            exit(2)
        }
        if !WindowCapture.ensureAccess() {
            print("Screenshots need Screen Recording permission (\(Reference.permissionHint)); measuring without.")
        }

        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let outDir = (swiftuiDir as NSString).appendingPathComponent("build/measure/\(stamp)")
        try FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
        let workDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-measure-\(stamp)")
        let folderPath = try buildDemo(in: workDir)

        var reports: [MeasureReport.App] = []
        for kind in only.map({ [$0] }) ?? AppKind.allCases {
            let appPath = (appPaths[kind] ?? nil) ?? AppLauncher.defaultAppPath(kind, swiftuiDir: swiftuiDir)
            reports.append(try await measure(
                kind, appPath: appPath, workDir: workDir, folderPath: folderPath, outDir: outDir, options: options
            ))
        }
        try MeasureReport.write(reports, stamp: stamp, options: options, outDir: outDir)
    }

    /// Builds the docs demo in `workDir`/demo and returns its acme/storefront repository.
    static func buildDemo(in workDir: String) throws -> String {
        let demoDir = (workDir as NSString).appendingPathComponent("demo")
        print("Building the demo in \(demoDir) ...")
        let script = (repoRoot as NSString).appendingPathComponent("scripts/make-docs-demo.sh")
        let demo = try AppLauncher.run("/bin/bash", [script, demoDir])
        if demo.status != 0 {
            throw ToolError("The demo did not build:\n\(demo.output)")
        }
        return (demoDir as NSString).appendingPathComponent("acme/storefront")
    }

    static func measure(
        _ kind: AppKind, appPath: String, workDir: String, folderPath: String, outDir: String, options: Options
    ) async throws -> MeasureReport.App {
        print("\(kind.rawValue): starting \(appPath)")
        let home = (workDir as NSString).appendingPathComponent("\(kind.rawValue)-home")
        let prefs = kind == .current ? try CurrentAppPrefs.apply(appPath: appPath) : nil
        defer { prefs?.restore() }
        let app = try await AppLauncher.launch(
            kind: kind, home: home, folderPath: folderPath, appPath: appPath, mode: options.mode
        )
        do {
            let report = try await steps(app, appPath: appPath, outDir: outDir, options: options)
            await app.stop()
            return report
        } catch {
            await app.stop()
            throw error
        }
    }

    private static func steps(
        _ app: RunningApp, appPath: String, outDir: String, options: Options
    ) async throws -> MeasureReport.App {
        let kind = app.kind
        let info = try await app.client.call("get_app_info").structured ?? [:]
        if options.screen == "diff" {
            try await showDiff(app)
        }
        try await Task.sleep(nanoseconds: UInt64(options.settleS) * 1_000_000_000)

        var screenshotPath: String?
        var screenshotSize: String?
        // gm-measure captures both windows itself, the same way, so the pixel diff compares like with like.
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

        print("\(kind.rawValue): sampling memory for \(options.durationS) s")
        let sample = try await app.client.call(
            "sample_memory",
            ["durationMs": options.durationS * 1000, "intervalMs": 500],
            timeout: TimeInterval(options.durationS + 30)
        )
        let memory = sample.structured ?? [:]
        let total = memory["total"] as? [String: Any] ?? [:]
        let processes = (memory["processes"] as? [String: [String: Any]] ?? [:])
            .map { label, stats in
                (
                    label: label.replacingOccurrences(of: #" \(\d+\)$"#, with: "", options: .regularExpression),
                    avgMb: stats["avgMb"] as? Double ?? 0,
                    maxMb: stats["maxMb"] as? Double ?? 0
                )
            }
            .sorted { $0.avgMb > $1.avgMb }
        return MeasureReport.App(
            kind: kind,
            appPath: appPath,
            name: info["name"] as? String ?? (kind == .current ? "Git Manager" : "Git Manager Native"),
            version: (info["version"] ?? info["appVersion"]).map { "\($0)" } ?? "?",
            serverMs: app.serverMs,
            readyMs: app.readyMs,
            screenshotPath: screenshotPath,
            screenshotSize: screenshotSize,
            avgMb: total["avgMb"] as? Double ?? 0,
            minMb: total["minMb"] as? Double ?? 0,
            maxMb: total["maxMb"] as? Double ?? 0,
            approximate: memory["approximate"] as? Bool ?? true,
            processes: processes
        )
    }

    /// Opens the diff of Reference.diffFile: the current app by its own tool, the native app by its `app` tool.
    private static func showDiff(_ app: RunningApp) async throws {
        let shown: ToolAnswer
        if app.kind == .current {
            // The current app knows the repository by its real path (/private/var/..., not /var/...).
            let state = try await app.client.call("get_app_state").structured ?? [:]
            let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
            shown = try await app.client.call(
                "show_changes_diff", ["repoPath": repoRoot, "filePath": Reference.diffFile]
            )
        } else {
            shown = try await app.client.call("app", ["action": "show_diff", "filePath": Reference.diffFile])
        }
        if shown.isError {
            throw ToolError("\(app.kind.rawValue): could not show the diff: \(shown.text)")
        }
        if app.kind == .current {
            try await requireCollapsedUnchanged(app)
        }
    }

    /// The native diff always folds unchanged lines; CurrentAppPrefs sets the same for the current app. If that did
    /// not take (the app moved its storage), the run stops instead of comparing different layouts.
    private static func requireCollapsedUnchanged(_ app: RunningApp) async throws {
        let selector = "button.toggle.active[title=\"Collapse unchanged fragments\"]"
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            let found = try await app.client.call("inspect_elements", ["selector": selector, "limit": 1])
            if ((found.structured ?? [:])["count"] as? Int ?? 0) > 0 {
                return
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        throw ToolError(
            "current: \"Collapse unchanged\" is off although the run turned it on in the app's localStorage "
                + "(CurrentAppPrefs.swift): check where the app keeps it now."
        )
    }
}
