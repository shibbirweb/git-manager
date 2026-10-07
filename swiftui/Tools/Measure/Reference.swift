// gm-measure reference: what the SwiftUI app has to match. Starts the current app isolated on the docs demo
// in each color mode and, for each slice-1 screen, saves a screenshot and a layout snapshot: every visible
// element of the screen's parts with its box and computed styles, read through the app's own
// inspect_elements tool (so src/ needs no change).
//
//   Reference/<screen>-<mode>.json    layout snapshots, committed, so changes show up in review
//   build/reference/<screen>-<mode>.png   screenshots (large and machine-made, so not committed)
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

    /// The computed styles every element records (inspect_elements reads at most 30).
    static let styles = [
        "display", "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "color",
        "background-color", "opacity", "border-top-width", "border-right-width", "border-bottom-width",
        "border-left-width", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
        "border-radius", "padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top",
        "margin-left", "gap", "box-shadow", "text-align", "white-space", "overflow", "text-overflow",
    ]

    static let chrome = [
        Part(name: "window", selector: "html"),
        Part(name: "header", selector: ".header, .header *"),
        Part(name: "activity bars", selector: ".activity, .activity *"),
        Part(name: "status bar", selector: ".status-bar, .status-bar *"),
    ]

    static let screens = [
        Screen(name: "changes", parts: chrome + [
            Part(name: "repository header", selector: ".repo-header, .repo-header *"),
            Part(name: "group headers", selector: ".group-header, .group-header *"),
            Part(name: "file rows", selector: ".row, .row *"),
            Part(name: "commit box", selector: ".commit-box, .commit-box *"),
            Part(name: "main area", selector: ".empty, .empty *"),
        ]),
        Screen(name: "diff", parts: chrome + [
            Part(name: "diff header", selector: ".diff-view > :not(.body), .diff-view .labels, .diff-view .labels *"),
            Part(name: "diff gutters", selector: ".diff-view .cm-gutterElement", limit: 40),
            Part(name: "diff lines", selector: ".diff-view .cm-line", limit: 40),
        ]),
    ]

    /// Values left out of the snapshots to keep them readable: a style missing there has one of these.
    static let defaultStyleValues: Set<String> = ["", "none", "normal", "0px", "rgba(0, 0, 0, 0)", "visible", "start", "clip", "1", "auto"]

    /// A modified file of demo/acme/storefront, for the diff screen.
    static let diffFile = "src/cart.ts"

    static func run(_ arguments: [String]) async throws -> Int32 {
        var arguments = arguments
        let modes = (option("--modes", in: &arguments) ?? "light,dark").split(separator: ",").map(String.init)
        let appPath = option("--current-app", in: &arguments) ?? AppLauncher.defaultAppPath(.current, swiftuiDir: swiftuiDir)
        guard arguments.isEmpty, modes.allSatisfy({ $0 == "light" || $0 == "dark" }) else {
            print(usage)
            return 2
        }
        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let workDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-reference-\(stamp)")
        let demoDir = (workDir as NSString).appendingPathComponent("demo")
        print("Building the demo in \(demoDir) ...")
        let demo = try AppLauncher.run("/bin/bash", [(repoRoot as NSString).appendingPathComponent("scripts/make-docs-demo.sh"), demoDir])
        if demo.status != 0 {
            throw ToolError("The demo did not build:\n\(demo.output)")
        }
        let folderPath = (demoDir as NSString).appendingPathComponent("acme/storefront")
        let jsonDir = (swiftuiDir as NSString).appendingPathComponent("Reference")
        let pngDir = (swiftuiDir as NSString).appendingPathComponent("build/reference")
        try FileManager.default.createDirectory(atPath: jsonDir, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(atPath: pngDir, withIntermediateDirectories: true)

        if !WindowCapture.ensureAccess() {
            print("Screenshots need Screen Recording permission for the app running gm-measure; writing layout snapshots only.")
        }
        var missingShots = 0
        for mode in modes {
            print("\(mode): starting \(appPath)")
            let home = (workDir as NSString).appendingPathComponent("home-\(mode)")
            let app = try await AppLauncher.launch(kind: .current, home: home, folderPath: folderPath, appPath: appPath, settings: ["theme": mode])
            do {
                let info = try await app.client.call("get_app_info").structured ?? [:]
                let version = (info["version"] ?? info["appVersion"]).map { "\($0)" } ?? "?"
                for screen in screens {
                    if screen.name == "diff" {
                        // The app knows the repository by its real path (/private/var/..., not /var/...).
                        let state = try await app.client.call("get_app_state").structured ?? [:]
                        let repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? folderPath
                        let shown = try await app.client.call("show_changes_diff", ["repoPath": repoRoot, "filePath": diffFile])
                        if shown.isError {
                            throw ToolError("show_changes_diff: \(shown.text)")
                        }
                    }
                    try await Task.sleep(nanoseconds: 1_500_000_000)
                    let name = "\(screen.name)-\(mode)"
                    if try await screenshot(app, to: (pngDir as NSString).appendingPathComponent("\(name).png")) == false {
                        missingShots += 1
                    }
                    let snapshot = try await layout(app, screen: screen, mode: mode, version: version)
                    let data = try JSONSerialization.data(withJSONObject: snapshot, options: [.prettyPrinted, .sortedKeys])
                    try data.write(to: URL(fileURLWithPath: (jsonDir as NSString).appendingPathComponent("\(name).json")))
                    let count = (snapshot["parts"] as? [[String: Any]] ?? []).reduce(0) { $0 + (($1["elements"] as? [Any])?.count ?? 0) }
                    print("\(name): \(count) elements")
                }
            } catch {
                await app.stop()
                throw error
            }
            await app.stop()
        }
        print("Layout snapshots: \(jsonDir)\nScreenshots: \(pngDir)")
        if missingShots > 0 {
            print("\(missingShots) screenshots are missing: allow the app that runs gm-measure (your terminal) in System Settings > Privacy & Security > Screen & System Audio Recording, then restart it.")
        }
        return 0
    }

    /// Captured by gm-measure itself, like `measure` does for both apps.
    private static func screenshot(_ app: RunningApp, to filePath: String) async throws -> Bool {
        do {
            try WindowCapture.capture(pid: app.pid).write(to: URL(fileURLWithPath: filePath))
            return true
        } catch {
            print("  no screenshot: \(error)")
            return false
        }
    }

    /// The screen's parts as plain JSON: visible elements only, in document order.
    private static func layout(_ app: RunningApp, screen: Screen, mode: String, version: String) async throws -> [String: Any] {
        var parts: [[String: Any]] = []
        for part in screen.parts {
            let answer = try await app.client.call("inspect_elements", ["selector": part.selector, "styles": styles, "limit": part.limit])
            if answer.isError {
                throw ToolError("inspect_elements \(part.selector): \(answer.text)")
            }
            let found = answer.structured ?? [:]
            let elements = (found["elements"] as? [[String: Any]] ?? []).filter { $0["visible"] as? Bool == true }.map { element in
                var element = element
                element.removeValue(forKey: "visible")
                let values = element["styles"] as? [String: String] ?? [:]
                element["styles"] = values.filter { !defaultStyleValues.contains($0.value) }
                return element
            }
            parts.append([
                "name": part.name,
                "selector": part.selector,
                "matched": found["count"] ?? 0,
                "limit": part.limit,
                "elements": elements,
            ])
        }
        return [
            "screen": screen.name,
            "mode": mode,
            "app": "Git Manager \(version)",
            "demo": "scripts/make-docs-demo.sh, acme/storefront" + (screen.name == "diff" ? ", diff of \(diffFile)" : ""),
            "note": "Visible elements only. A style left out has its default value: " + defaultStyleValues.sorted().map { "'\($0)'" }.joined(separator: ", "),
            "parts": parts,
        ]
    }
}
