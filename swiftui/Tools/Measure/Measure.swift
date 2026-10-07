// gm-measure measure: the side-by-side scenario. Both apps, one after the other, do the same steps
// on a fresh copy of the docs demo (scripts/make-docs-demo.sh): start isolated on acme/storefront,
// wait until its status is on screen, settle, screenshot, sample memory, quit. Steps the native
// app cannot do yet (open files, scroll, diffs) join the scenario for both apps as it learns them.
// Writes swiftui/build/measure/<time>/report.md, report.json, both screenshots and their diff.

import Foundation
import MeasureKit

enum Measure {
    struct AppReport {
        let kind: AppKind
        let appPath: String
        let name: String
        let version: String
        let serverMs: Int
        let readyMs: Int
        let screenshotPath: String?
        let screenshotSize: String?
        let avgMb: Double
        let minMb: Double
        let maxMb: Double
        let approximate: Bool
        /// Label without the pid, then average and peak MB.
        let processes: [(label: String, avgMb: Double, maxMb: Double)]
    }

    static func run(_ arguments: [String]) async throws {
        var arguments = arguments
        let durationS = min(60, max(1, Int(option("--duration", in: &arguments) ?? "20") ?? 20))
        let settleS = max(0, Int(option("--settle", in: &arguments) ?? "5") ?? 5)
        let only = option("--only", in: &arguments).flatMap(AppKind.init(rawValue:))
        let currentApp = option("--current-app", in: &arguments)
        let nativeApp = option("--native-app", in: &arguments)
        guard arguments.isEmpty else {
            print(usage)
            exit(2)
        }
        if !WindowCapture.ensureAccess() {
            print("Screenshots need Screen Recording permission for the app running gm-measure; measuring memory without them.")
        }

        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let outDir = (swiftuiDir as NSString).appendingPathComponent("build/measure/\(stamp)")
        try FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
        let workDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-measure-\(stamp)")
        let demoDir = (workDir as NSString).appendingPathComponent("demo")
        print("Building the demo in \(demoDir) ...")
        let demo = try AppLauncher.run("/bin/bash", [(repoRoot as NSString).appendingPathComponent("scripts/make-docs-demo.sh"), demoDir])
        if demo.status != 0 {
            throw ToolError("The demo did not build:\n\(demo.output)")
        }
        let folderPath = (demoDir as NSString).appendingPathComponent("acme/storefront")

        var reports: [AppReport] = []
        for kind in only.map({ [$0] }) ?? AppKind.allCases {
            let appPath = (kind == .current ? currentApp : nativeApp) ?? AppLauncher.defaultAppPath(kind, swiftuiDir: swiftuiDir)
            reports.append(try await measure(kind, appPath: appPath, workDir: workDir, folderPath: folderPath, outDir: outDir, durationS: durationS, settleS: settleS))
        }

        var diffLine = "Pixel diff: needs both screenshots."
        var diffJSON: [String: Any] = [:]
        if let current = reports.first(where: { $0.kind == .current })?.screenshotPath,
           let native = reports.first(where: { $0.kind == .native })?.screenshotPath {
            let result = diffImages(try RGBAImage.load(path: current), try RGBAImage.load(path: native))
            try result.overlay.write(path: (outDir as NSString).appendingPathComponent("diff.png"))
            diffLine = "Pixel diff: \(Diff.describe(result, tolerance: 0)). Overlay: diff.png."
            diffJSON = ["identicalPercent": result.identicalPercent, "sizeMismatch": result.sizeMismatch ?? NSNull(), "differentPixels": result.differentPixels]
        }

        let markdown = render(reports, stamp: stamp, durationS: durationS, settleS: settleS, diffLine: diffLine)
        try markdown.write(toFile: (outDir as NSString).appendingPathComponent("report.md"), atomically: true, encoding: .utf8)
        let json: [String: Any] = [
            "stamp": stamp,
            "durationS": durationS,
            "settleS": settleS,
            "apps": reports.map { report in
                [
                    "kind": report.kind.rawValue,
                    "appPath": report.appPath,
                    "name": report.name,
                    "version": report.version,
                    "serverMs": report.serverMs,
                    "readyMs": report.readyMs,
                    "screenshotSize": report.screenshotSize ?? NSNull(),
                    "avgMb": report.avgMb,
                    "minMb": report.minMb,
                    "maxMb": report.maxMb,
                    "approximate": report.approximate,
                    "processes": Dictionary(uniqueKeysWithValues: report.processes.map { ($0.label, ["avgMb": $0.avgMb, "maxMb": $0.maxMb]) }),
                ] as [String: Any]
            },
            "pixelDiff": diffJSON,
        ]
        let jsonData = try JSONSerialization.data(withJSONObject: json, options: [.prettyPrinted, .sortedKeys])
        try jsonData.write(to: URL(fileURLWithPath: (outDir as NSString).appendingPathComponent("report.json")))
        print("\n\(markdown)\nSaved in \(outDir)")
    }

    static func measure(
        _ kind: AppKind,
        appPath: String,
        workDir: String,
        folderPath: String,
        outDir: String,
        durationS: Int,
        settleS: Int
    ) async throws -> AppReport {
        print("\(kind.rawValue): starting \(appPath)")
        let home = (workDir as NSString).appendingPathComponent("\(kind.rawValue)-home")
        let app = try await AppLauncher.launch(kind: kind, home: home, folderPath: folderPath, appPath: appPath)
        do {
            let report = try await steps(app, appPath: appPath, outDir: outDir, durationS: durationS, settleS: settleS)
            await app.stop()
            return report
        } catch {
            await app.stop()
            throw error
        }
    }

    private static func steps(_ app: RunningApp, appPath: String, outDir: String, durationS: Int, settleS: Int) async throws -> AppReport {
        let kind = app.kind
        let info = try await app.client.call("get_app_info").structured ?? [:]
        try await Task.sleep(nanoseconds: UInt64(settleS) * 1_000_000_000)

        var screenshotPath: String?
        var screenshotSize: String?
        // gm-measure captures both windows itself, the same way, so the pixel diff compares like with like.
        do {
            let png = try WindowCapture.capture(pid: app.pid)
            let path = (outDir as NSString).appendingPathComponent("\(kind.rawValue).png")
            try png.write(to: URL(fileURLWithPath: path))
            let image = try RGBAImage.decode(pngData: png)
            screenshotPath = path
            screenshotSize = "\(image.width)x\(image.height)"
        } catch {
            print("\(kind.rawValue): no screenshot (\(error))")
        }

        print("\(kind.rawValue): sampling memory for \(durationS) s")
        let sample = try await app.client.call("sample_memory", ["durationMs": durationS * 1000, "intervalMs": 500], timeout: TimeInterval(durationS + 30))
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
        return AppReport(
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

    static func render(_ apps: [AppReport], stamp: String, durationS: Int, settleS: Int, diffLine: String) -> String {
        func row(_ title: String, _ value: (AppReport) -> String) -> String {
            "| \(title) | " + apps.map(value).joined(separator: " | ") + " |"
        }
        var lines = [
            "# Side by side: \(stamp)",
            "",
            "Scenario: open demo/acme/storefront, wait until its status is on screen, settle \(settleS) s, screenshot, sample memory for \(durationS) s (every 0.5 s).",
            "",
            "| | " + apps.map { "\($0.name) \($0.version)" }.joined(separator: " | ") + " |",
            "|---|" + apps.map { _ in "---" }.joined(separator: "|") + "|",
            row("Server answers") { "\($0.serverMs) ms" },
            row("Status on screen") { "\($0.readyMs) ms" },
            row("Memory, average") { "\($0.avgMb) MB" },
            row("Memory, min to peak") { "\($0.minMb) to \($0.maxMb) MB" },
            row("Measured exactly") { $0.approximate ? "no (helpers matched by start time)" : "yes" },
            row("Screenshot") { $0.screenshotSize ?? "none" },
            "",
            "Memory by process (average / peak):",
            "",
        ]
        for app in apps {
            lines.append("- \(app.name): " + app.processes.map { "\($0.label) \($0.avgMb) / \($0.maxMb) MB" }.joined(separator: ", "))
        }
        lines.append(contentsOf: ["", diffLine, ""])
        return lines.joined(separator: "\n")
    }
}
