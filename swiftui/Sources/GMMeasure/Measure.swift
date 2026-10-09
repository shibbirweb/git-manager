// gm-measure measure: the side-by-side scenario. Both apps, one after the other, do the same steps on a fresh
// copy of the docs demo (scripts/make-docs-demo.sh): start isolated on acme/storefront, wait until its status is
// on screen, settle, screenshot, sample memory, quit. Steps the native app cannot do yet (open files, scroll,
// diffs) join the scenario for both apps as it learns them. Writes swiftui/build/measure/<time>/report.md,
// report.json, both screenshots and their pixel diff (MeasureReport.swift).

import AppKit
import Foundation
import MeasureKit

enum Measure {
    struct Options {
        var durationS = 20
        var settleS = 5
        var mode = "light"
        /// "changes" (the folder as it opens), "diff" (the diff of Reference.diffFile), "staged" (the Changes
        /// screen after staging Reference.diffFile), "file" (Measure.shownFile in an editor tab)
        /// "log" (the Log with its newest commit selected), "terminal" (the terminal panel, MeasureTerminal.swift),
        /// "merge" (git mergetool on Measure.mergeFile), "conflicts" (the conflict demo's conflicts list) or
        /// "edit" and "fold" (MeasureEdit.swift), "blame" (the file with the blame gutter on in both apps' settings),
        /// "workspace" (the whole acme folder: storefront and payments-api, MeasureWorkspace.swift), "folders" (acme
        /// and design-system), "cleanrepos" (folders with two clean repositories), "norepo" (a plain folder),
        /// "foldermenu", "repomenu" and "branchmenu" (the workspace with a header menu open), "welcome" (no folder) and
        /// "welcomerecent" (no folder, with recent projects), "welcomecustomize" and "welcomelearn" (its pages),
        /// "welcomeclone" (its Clone dialog), "workspacefile" (acme and design-system from a workspace file) and
        /// "closefolder" (storefront closed again).
        var screen = "changes"
        /// "Collapse unchanged" in both apps' diffs (--collapse on|off).
        var collapse = true
        /// Points a frame of a scroll walk down and back before the screenshot (--walk), 0 for none: what the
        /// screen shows after scrolling should not change.
        var walkSpeed = 0
        /// --theme: the color theme of the run's mode in both apps (a theme id such as monokai-charcoal).
        var colorTheme: String?
        /// --file: the conflicted file of --screen merge (src/app.ts by default).
        var mergeFile = Measure.mergeFile
        /// --hdr and --hdr-wait: the display state each capture needs.
        var gate = Display.Gate(requirement: .off, waitS: 30)
        /// More workspace folders opened with the first (--screen folders).
        var extraFolders: [String] = []
        /// state.json values both apps start with (--screen welcomerecent: recent projects).
        var startState: [String: Any] = [:]
        /// A workspace file both apps open (--screen workspacefile).
        var workspaceFile: String?
    }

    static func run(_ arguments: [String]) async throws {
        var arguments = arguments
        var options = Options()
        options.durationS = min(60, max(1, Int(option("--duration", in: &arguments) ?? "20") ?? 20))
        options.settleS = max(0, Int(option("--settle", in: &arguments) ?? "5") ?? 5)
        options.mode = option("--mode", in: &arguments) ?? "light"
        options.screen = option("--screen", in: &arguments) ?? "changes"
        let collapse = option("--collapse", in: &arguments) ?? "on"
        options.collapse = collapse == "on"
        options.walkSpeed = max(0, Int(option("--walk", in: &arguments) ?? "0") ?? 0)
        options.colorTheme = option("--theme", in: &arguments)
        options.mergeFile = option("--file", in: &arguments) ?? Measure.mergeFile
        options.gate = try Display.gate(from: &arguments)
        let only = option("--only", in: &arguments).flatMap(AppKind.init(rawValue:))
        let appPaths: [AppKind: String?] = [
            .current: option("--current-app", in: &arguments),
            .native: option("--native-app", in: &arguments),
        ]
        let validScreen = (["changes", "diff", "staged", "file", "blame", "log", "settings", "terminal", "merge",
                             "conflicts"]
            + searchScreens + workspaceScreens + welcomeScreens + closeScreens + editScreens).contains(options.screen)
        let validCollapse = collapse == "on" || collapse == "off"
        guard arguments.isEmpty, options.mode == "light" || options.mode == "dark", validScreen, validCollapse else {
            print(usage)
            exit(2)
        }
        if !WindowCapture.ensureAccess() {
            print("Screenshots need Screen Recording permission (\(Reference.permissionHint)); measuring without.")
        }
        try await options.gate.require("before the run starts", record: false)

        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let outDir = (swiftuiDir as NSString).appendingPathComponent("build/measure/\(stamp)")
        try FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
        let workDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-measure-\(stamp)")
        if options.screen == "merge" || options.screen == "conflicts" {
            try await runMerge(options, only: only, appPaths: appPaths, workDir: workDir, outDir: outDir, stamp: stamp)
            return
        }
        let demoRepo = try buildDemo(in: workDir)
        let folderPath = try screenFolder(options.screen, demoRepo: demoRepo)
        options.extraFolders = extraFolders(options.screen, demoRepo: demoRepo)
        options.startState = startState(options.screen, demoRepo: demoRepo)
        options.workspaceFile = try workspaceFile(options.screen, demoRepo: demoRepo)

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
        let prefs = kind == .current ? try CurrentAppPrefs.apply(appPath: appPath, collapse: options.collapse) : nil
        defer { prefs?.restore() }
        if kind == .native {
            try writeNativeDiffPrefs(home: home, collapse: options.collapse)
        }
        var themeSettings = colorThemeSettings(mode: options.mode, themeID: options.colorTheme)
        if options.screen == "blame" {
            // The file bar's Blame button is this setting in both apps.
            themeSettings["blameGutter"] = true
        }
        if kind == .native {
            try writeNativeSettings(home: home, values: themeSettings)
        }
        if options.screen == "terminal" {
            try MeasureTerminal.writeShellProfile(home: home)
        }
        let app = try await AppLauncher.launch(
            kind: kind, home: home, folderPath: folderPath, appPath: appPath,
            settings: kind == .current ? themeSettings : [:], mode: options.mode, extraFolders: options.extraFolders,
            state: options.startState, workspaceFile: options.workspaceFile
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
            try await showDiff(app, collapse: options.collapse)
        } else if options.screen == "staged" {
            try await stageFiles(app)
        } else if options.screen == "file" || options.screen == "blame" {
            try await openFile(app)
        } else if options.screen == "log" {
            try await showLog(app)
        } else if options.screen == "settings" {
            try await openSettings(app)
        } else if options.screen == "terminal" {
            try await MeasureTerminal.show(app)
        } else if editScreens.contains(options.screen) {
            try await showEditScreen(app, screen: options.screen)
        } else if searchScreens.contains(options.screen) {
            try await showSearchScreen(app, screen: options.screen)
        } else if menuScreens.contains(options.screen) {
            try await openHeaderMenu(app, screen: options.screen)
        } else if closeScreens.contains(options.screen) {
            try await closeFolder(app)
        } else if options.screen == "welcomecustomize" || options.screen == "welcomelearn" {
            try await showWelcomePage(app, page: options.screen == "welcomelearn" ? "Learn" : "Customize")
        } else if options.screen == "welcomeclone" {
            try await showWelcomePage(app, page: "Clone Repository")
        }
        if options.walkSpeed > 0 {
            try await Task.sleep(nanoseconds: 2_000_000_000)
            WindowCapture.bringToFront(pid: app.pid)
            _ = try await MemoryBench.scroll(app, speed: options.walkSpeed)
        }
        try await Task.sleep(nanoseconds: UInt64(options.settleS) * 1_000_000_000)

        let display = try await options.gate.require("before the \(kind.rawValue) screenshot")
        var screenshotPath: String?
        var screenshotSize: String?
        // gm-measure captures both windows itself, the same way, so the pixel diff compares like with like.
        do {
            WindowCapture.bringToFront(pid: app.pid)
            let png = try WindowCapture.capture(pid: app.pid)
            // Typing or clicking on another screen moves the focus and closes open menus: such a run is spoiled.
            if let front = NSWorkspace.shared.frontmostApplication?.processIdentifier, front != app.pid {
                print("\(kind.rawValue): another app was in front at the screenshot; rerun if a menu or focus matters")
            }
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
        if options.screen == "staged" {
            try await unstageFiles(app)
        }
        return MeasureReport.App(
            kind: kind,
            appPath: appPath,
            name: info["name"] as? String ?? (kind == .current ? "Git Manager" : "Git Manager Native"),
            version: (info["version"] ?? info["appVersion"]).map { "\($0)" } ?? "?",
            serverMs: app.serverMs,
            readyMs: app.readyMs,
            screenshotPath: screenshotPath,
            screenshotSize: screenshotSize,
            headroom: display?.headroom,
            avgMb: total["avgMb"] as? Double ?? 0,
            minMb: total["minMb"] as? Double ?? 0,
            maxMb: total["maxMb"] as? Double ?? 0,
            approximate: memory["approximate"] as? Bool ?? true,
            processes: processes
        )
    }
}
