// gm-measure reference: what the SwiftUI app has to match. Starts the current app isolated on the docs demo in
// each color mode and, for each slice-1 screen, saves a screenshot and a layout snapshot: every visible element
// of the screen's parts with its box and computed styles, read through the app's own inspect_elements tool (so
// src/ needs no change).
//
//   Reference/<screen>-<mode>/<part>.json   layout snapshots, committed, so changes show up in review
//   build/reference/<screen>-<mode>.png     screenshots (large and machine-made, so not committed)
//
// The screenshots need Screen Recording permission for the app that runs gm-measure (the terminal).

import Foundation
import MeasureKit

enum Reference {
    /// One part of a screen: a name and the CSS selector of its elements.
    struct Part {
        let name: String
        let selector: String
        var limit = 100
    }

    struct Screen {
        let name: String
        let parts: [Part]
    }

    static let chrome = [
        Part(name: "window", selector: "html"),
        // The boxes the window is split into: workspace, body, sidebar, main area, editor area, Files panel.
        Part(
            name: "layout",
            selector: ".workspace, .workspace > *, .body, .body > *, .sidebar, .main, .editor-area, .explorer",
            limit: 40
        ),
        Part(name: "header", selector: ".header, .header *"),
        Part(name: "activity bars", selector: ".activity, .activity *"),
        Part(name: "status bar", selector: ".status-bar, .status-bar *"),
        Part(name: "files panel", selector: ".explorer, .explorer *"),
    ]

    static let screens = [
        Screen(name: "changes", parts: chrome + [
            Part(name: "changes head", selector: ".sidebar .head, .sidebar .head *"),
            Part(name: "repository header", selector: ".repo-header, .repo-header *"),
            Part(name: "group headers", selector: ".group-header, .group-header *"),
            Part(name: "file rows", selector: ".sidebar .row, .sidebar .row *"),
            Part(name: "commit box", selector: ".commit-box, .commit-box *"),
            Part(name: "nav strip", selector: ".nav-strip, .nav-strip *"),
            Part(name: "main area", selector: ".empty, .empty *"),
        ]),
        Screen(name: "diff", parts: chrome + [
            Part(name: "editor tabs", selector: ".tab-strip, .tab-strip *"),
            Part(name: "diff toolbar", selector: ".diff-view .toolbar, .diff-view .toolbar *"),
            Part(
                name: "diff header",
                selector: ".diff-view > :not(.body), .diff-view .labels, .diff-view .labels *"
            ),
            Part(
                name: "diff layout",
                selector: ".diff-view .cm-mergeView, .diff-view .cm-editor, .diff-view .cm-gutters, "
                    + ".diff-view .cm-scroller",
                limit: 20
            ),
            Part(
                name: "diff changes",
                selector: ".diff-view .cm-changedLine, .diff-view .cm-changedText, .diff-view .cm-deletedChunk, "
                    + ".diff-view .cm-collapsedLines, .diff-view .cm-merge-revert",
                limit: 60
            ),
            Part(
                name: "diff widgets",
                selector: ".diff-view .cm-diffFold, .diff-view .cm-diffFold *, .diff-view .diff-revert, "
                    + ".diff-view .diff-revert *, .diff-view .cm-gm-indentGuide",
                limit: 60
            ),
            Part(name: "diff gutters", selector: ".diff-view .cm-gutterElement", limit: 40),
            Part(name: "diff lines", selector: ".diff-view .cm-line", limit: 40),
        ]),
    ]

    /// A modified file of demo/acme/storefront, for the diff screen.
    static let diffFile = "src/cart.ts"

    static let permissionHint = "allow the app that runs gm-measure (your terminal) in System Settings > "
        + "Privacy & Security > Screen & System Audio Recording, then restart it"

    static func run(_ arguments: [String]) async throws -> Int32 {
        var arguments = arguments
        let modes = (option("--modes", in: &arguments) ?? "light,dark").split(separator: ",").map(String.init)
        let appPath = option("--current-app", in: &arguments)
            ?? AppLauncher.defaultAppPath(.current, swiftuiDir: swiftuiDir)
        let gate = try Display.gate(from: &arguments)
        let names = option("--screens", in: &arguments).map { $0.split(separator: ",").map(String.init) }
        let chosen = chosenScreens(names)
        guard arguments.isEmpty, !chosen.isEmpty, modes.allSatisfy({ $0 == "light" || $0 == "dark" }) else {
            print(usage)
            return 2
        }
        try await gate.require("before the run starts", record: false)
        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let workDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-reference-\(stamp)")
        let folderPath = try Measure.buildDemo(in: workDir)
        let jsonDir = (swiftuiDir as NSString).appendingPathComponent("Reference")
        let pngDir = (swiftuiDir as NSString).appendingPathComponent("build/reference")
        try FileManager.default.createDirectory(atPath: pngDir, withIntermediateDirectories: true)
        if !WindowCapture.ensureAccess() {
            print("Screenshots need Screen Recording permission (\(permissionHint)); writing layout snapshots only.")
        }

        var missingShots = 0
        var shots: [(name: String, headroom: Double?)] = []
        for mode in modes {
            print("\(mode): starting \(appPath)")
            let home = (workDir as NSString).appendingPathComponent("home-\(mode)")
            let prefs = try CurrentAppPrefs.apply(appPath: appPath)
            defer { prefs?.restore() }
            let app = try await AppLauncher.launch(
                kind: .current, home: home, folderPath: folderPath, appPath: appPath, mode: mode
            )
            do {
                let info = try await app.client.call("get_app_info").structured ?? [:]
                let version = (info["version"] ?? info["appVersion"]).map { "\($0)" } ?? "?"
                var logShown = false
                for screen in chosen {
                    try await prepare(screen, app, logShown: &logShown)
                    if screen.name == "diff" {
                        try await showDiff(app, fallbackRepoPath: folderPath)
                    } else if screen.name == "file" {
                        try await Measure.openFile(app)
                    }
                    try await Task.sleep(nanoseconds: 1_500_000_000)
                    let name = "\(screen.name)-\(mode)"
                    let pngPath = (pngDir as NSString).appendingPathComponent("\(name).png")
                    let display = try await gate.require("before the \(name) screenshot")
                    shots.append((name, display?.headroom))
                    if try await screenshot(app, to: pngPath) == false {
                        missingShots += 1
                    }
                    let count = try await ReferenceSnapshot.capture(
                        app, screen: screen, mode: mode, version: version,
                        into: (jsonDir as NSString).appendingPathComponent(name)
                    )
                    print("\(name): \(count) elements")
                }
            } catch {
                await app.stop()
                throw error
            }
            await app.stop()
        }
        try writeReport(shots, gate: gate, stamp: stamp, into: pngDir)
        print("Layout snapshots: \(jsonDir)\nScreenshots: \(pngDir)\n\(gate.markdownLine)")
        if missingShots > 0 {
            print("\(missingShots) screenshots are missing: \(permissionHint).")
        }
        return 0
    }

    /// Opens the diff of `diffFile`. The app knows the repository by its real path (/private/var/..., not
    /// /var/...), so the path comes from its own state.
    private static func showDiff(_ app: RunningApp, fallbackRepoPath: String) async throws {
        let state = try await app.client.call("get_app_state").structured ?? [:]
        let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? fallbackRepoPath
        let shown = try await app.client.call("show_changes_diff", ["repoPath": repoRoot, "filePath": diffFile])
        if shown.isError {
            throw ToolError("show_changes_diff: \(shown.text)")
        }
    }

    /// build/reference/report.md and report.json: the display state of each screenshot (the layout snapshots
    /// do not depend on it, the pixels do).
    private static func writeReport(
        _ shots: [(name: String, headroom: Double?)], gate: Display.Gate, stamp: String, into pngDir: String
    ) throws {
        var lines = ["# Reference screenshots: \(stamp)", "", gate.markdownLine, "", "| Screenshot | HDR headroom |",
                     "|---|---|"]
        lines += shots.map { "| \($0.name).png | \($0.headroom.map(DisplayReport.number) ?? "not read") |" }
        let markdown = lines.joined(separator: "\n") + "\n"
        try markdown.write(toFile: (pngDir as NSString).appendingPathComponent("report.md"), atomically: true,
                           encoding: .utf8)
        let json: [String: Any] = [
            "stamp": stamp,
            "display": gate.json,
            "screenshots": shots.map { ["name": $0.name, "headroom": $0.headroom ?? NSNull()] as [String: Any] },
        ]
        try WrappedJSON.string(json).write(
            toFile: (pngDir as NSString).appendingPathComponent("report.json"), atomically: true, encoding: .utf8
        )
    }

    /// Captured by gm-measure itself, like `measure` does for both apps.
    private static func screenshot(_ app: RunningApp, to filePath: String) async throws -> Bool {
        do {
            WindowCapture.bringToFront(pid: app.pid)
            try WindowCapture.capture(pid: app.pid).write(to: URL(fileURLWithPath: filePath))
            return true
        } catch {
            print("  no screenshot: \(error)")
            return false
        }
    }
}
