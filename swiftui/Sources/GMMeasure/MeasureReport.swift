// The report of gm-measure measure: report.md (a table to read), report.json (the same numbers for scripts)
// and, with both screenshots, diff.png with the pixel diff between the two apps.

import Foundation
import MeasureKit

enum MeasureReport {
    struct App {
        let kind: AppKind
        let appPath: String
        let name: String
        let version: String
        let serverMs: Int
        let readyMs: Int
        let screenshotPath: String?
        let screenshotSize: String?
        /// The display's HDR headroom just before the screenshot (1.0: HDR off).
        let headroom: Double?
        let avgMb: Double
        let minMb: Double
        let maxMb: Double
        let approximate: Bool
        /// Label without the pid, then average and peak MB.
        let processes: [(label: String, avgMb: Double, maxMb: Double)]
    }

    static func write(_ apps: [App], stamp: String, options: Measure.Options, outDir: String) throws {
        var diffLine = "Pixel diff: needs both screenshots."
        var diffJSON: [String: Any] = [:]
        if let current = apps.first(where: { $0.kind == .current })?.screenshotPath,
           let native = apps.first(where: { $0.kind == .native })?.screenshotPath {
            let first = try RGBAImage.load(path: current)
            let second = try RGBAImage.load(path: native)
            let result = diffImages(first, second)
            // A tolerance of 1 leaves out the one-step rounding the system adds to some colors on the way to the
            // display (#dfe1e5 shown as #dfe1e4), so what remains is a real difference.
            let loose = diffImages(first, second, tolerance: 1)
            // The title bar sometimes renders one step off in either app from run to run (#1e1f22 as 30,31,33),
            // which alone moves the dark score by about 4 points; the content score leaves it out.
            let content = diffImages(first, second, fromRow: WindowCapture.titleBarRows)
            try result.overlay.write(path: (outDir as NSString).appendingPathComponent("diff.png"))
            try loose.overlay.write(path: (outDir as NSString).appendingPathComponent("diff-tolerance-1.png"))
            diffLine = "Pixel diff: \(Diff.describe(result, tolerance: 0)). Overlay: diff.png.\n\n"
                + "With tolerance 1: \(loose.identicalPercent)% identical. Overlay: diff-tolerance-1.png.\n\n"
                + "Content only (below the title bar): \(content.identicalPercent)% identical "
                + "(\(content.differentPixels) pixels differ)."
            diffJSON = [
                "identicalPercent": result.identicalPercent,
                "identicalPercentTolerance1": loose.identicalPercent,
                "contentIdenticalPercent": content.identicalPercent,
                "contentDifferentPixels": content.differentPixels,
                "sizeMismatch": result.sizeMismatch ?? NSNull(),
                "differentPixels": result.differentPixels,
            ]
        }
        let markdown = render(apps, stamp: stamp, options: options, diffLine: diffLine)
        let markdownPath = (outDir as NSString).appendingPathComponent("report.md")
        try markdown.write(toFile: markdownPath, atomically: true, encoding: .utf8)
        let json: [String: Any] = [
            "stamp": stamp,
            "mode": options.mode,
            "durationS": options.durationS,
            "settleS": options.settleS,
            "screen": options.screen,
            "collapse": options.collapse,
            "apps": apps.map(appJSON),
            "pixelDiff": diffJSON,
            "display": options.gate.json,
        ]
        let jsonPath = (outDir as NSString).appendingPathComponent("report.json")
        try WrappedJSON.string(json).write(toFile: jsonPath, atomically: true, encoding: .utf8)
        print("\n\(markdown)\nSaved in \(outDir)")
    }

    private static func appJSON(_ app: App) -> [String: Any] {
        [
            "kind": app.kind.rawValue,
            "appPath": app.appPath,
            "name": app.name,
            "version": app.version,
            "serverMs": app.serverMs,
            "readyMs": app.readyMs,
            "screenshotSize": app.screenshotSize ?? NSNull(),
            "headroom": app.headroom ?? NSNull(),
            "avgMb": app.avgMb,
            "minMb": app.minMb,
            "maxMb": app.maxMb,
            "approximate": app.approximate,
            // Two windows of the current app have two "Web content (UI)" processes: their memory adds up.
            "processes": Dictionary(
                app.processes.map { ($0.label, ["avgMb": $0.avgMb, "maxMb": $0.maxMb]) },
                uniquingKeysWith: { first, second in first.merging(second, uniquingKeysWith: +) }
            ),
        ]
    }

    private static func screenStep(_ screen: String) -> String {
        switch screen {
        case "diff":
            return "show the diff of \(Reference.diffFile)"
        case "staged":
            return "stage \(Reference.diffFile) and wait until the Staged group shows it"
        case "merge", "conflicts":
            return Measure.mergeStep(screen)
        default:
            return "stay on the Changes screen"
        }
    }

    static func render(_ apps: [App], stamp: String, options: Measure.Options, diffLine: String) -> String {
        func row(_ title: String, _ value: (App) -> String) -> String {
            "| \(title) | " + apps.map(value).joined(separator: " | ") + " |"
        }
        let diff = options.screen == "diff" ? ", diff with collapse \(options.collapse ? "on" : "off")" : ""
        var lines = [
            "# Side by side: \(stamp)",
            "",
            "Scenario (\(options.mode) mode\(diff)): open demo/acme/storefront, wait until its status is on screen,",
            "\(screenStep(options.screen)), settle \(options.settleS) s, screenshot, sample memory for "
                + "\(options.durationS) s (every 0.5 s).",
            "",
            "| | " + apps.map { "\($0.name) \($0.version)" }.joined(separator: " | ") + " |",
            "|---|" + apps.map { _ in "---" }.joined(separator: "|") + "|",
            row("Server answers") { "\($0.serverMs) ms" },
            row("Status on screen") { "\($0.readyMs) ms" },
            row("Memory, average") { "\($0.avgMb) MB" },
            row("Memory, min to peak") { "\($0.minMb) to \($0.maxMb) MB" },
            row("Measured exactly") { $0.approximate ? "no (helpers matched by start time)" : "yes" },
            row("Screenshot") { $0.screenshotSize ?? "none" },
            row("HDR headroom at the screenshot") { $0.headroom.map(DisplayReport.number) ?? "not read" },
            "",
            options.gate.markdownLine,
            "",
            "Memory by process (average / peak):",
            "",
        ]
        for app in apps {
            let parts = app.processes.map { "\($0.label) \($0.avgMb) / \($0.maxMb) MB" }
            lines.append("- \(app.name): " + parts.joined(separator: ", "))
        }
        lines.append(contentsOf: ["", diffLine, ""])
        return lines.joined(separator: "\n")
    }
}
