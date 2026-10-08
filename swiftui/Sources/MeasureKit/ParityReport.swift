// report.md of a gm-measure parity run: per scenario and mode the pixel match, memory and overlay, what failed,
// and per scenario what the native app is missing. CI posts the same text as the job summary.

import Foundation

public struct ParityRunInfo {
    public let stamp: String
    public let currentApp: String
    public let nativeApp: String

    public init(stamp: String, currentApp: String, nativeApp: String) {
        self.stamp = stamp
        self.currentApp = currentApp
        self.nativeApp = nativeApp
    }
}

public enum ParityReport {
    public static func markdown(_ outcomes: [ParityOutcome], list: ParityList, info: ParityRunInfo) -> String {
        let currentVersion = outcomes.compactMap(\.currentVersion).first ?? "?"
        let nativeVersion = outcomes.compactMap(\.nativeVersion).first ?? "?"
        var lines = [
            "# Native parity: \(info.stamp)",
            "",
            "Current app \(currentVersion) (`\(info.currentApp)`), native app \(nativeVersion) (`\(info.nativeApp)`).",
            "Both apps run each scenario isolated on the docs demo, and gm-measure captures both windows the same way.",
            "Match is the share of identical pixels below the title bar (macOS draws the title bar in both apps).",
            "",
            "| Scenario | Mode | Match | Whole window | Memory current | Memory native | Overlay |",
            "|---|---|---|---|---|---|---|",
        ]
        for outcome in outcomes {
            let title = list.scenario(outcome.scenario)?.title ?? outcome.scenario
            let match = outcome.captured ? ParityFormat.percent(outcome.contentPercent) : "not compared"
            let overlay = outcome.files.first { $0.hasSuffix("/diff.png") } ?? "-"
            lines.append(
                "| \(outcome.scenario): \(title) | \(outcome.mode) | \(match) | "
                    + "\(ParityFormat.percent(outcome.windowPercent)) | \(ParityFormat.megabytes(outcome.currentMb)) | "
                    + "\(ParityFormat.megabytes(outcome.nativeMb)) | \(overlay) |"
            )
        }
        let failed = outcomes.filter { !$0.problems.isEmpty }
        if !failed.isEmpty {
            lines += ["", "## Problems", ""]
            for outcome in failed {
                for problem in outcome.problems {
                    lines.append("- \(outcome.scenario), \(outcome.mode): \(problem)")
                }
            }
        }
        lines += ["", "## Missing in native, per scenario"]
        var seen = Set<String>()
        for outcome in outcomes where seen.insert(outcome.scenario).inserted {
            guard let scenario = list.scenario(outcome.scenario) else {
                continue
            }
            lines += ["", "### \(scenario.id): \(scenario.title)", ""]
            if let note = scenario.note, !note.isEmpty {
                lines += ["Note: " + note.joined(separator: " "), ""]
            }
            lines += gapLines(list.features(in: scenario.id))
        }
        let notRun = list.scenarios.filter { !$0.runnable }
        if !notRun.isEmpty {
            lines += ["", "## Not run: the native app cannot show these yet", ""]
            for scenario in notRun {
                let names = list.features(in: scenario.id).map { "\($0.name) (`\($0.id)`)" }
                let missing = names.joined(separator: ", ")
                lines.append("- `\(scenario.id)` \(scenario.title): missing in native: \(missing)")
            }
        }
        return lines.joined(separator: "\n") + "\n"
    }

    /// The features of one scenario that are not done, as "missing in native" lines.
    public static func gapLines(_ features: [ParityFeature]) -> [String] {
        let open = features.filter { $0.native != .done }
        if open.isEmpty {
            return ["Nothing missing: every feature of this scenario is done."]
        }
        return open.map { feature in
            let label = feature.native == .missing ? "Missing in native" : "Partial in native"
            let gaps = feature.gapText.map { ": \($0)" } ?? ""
            return "- \(label): \(feature.name) (`\(feature.id)`)\(gaps)"
        }
    }

    /// report.json: the outcomes plus the run's apps.
    public static func json(_ outcomes: [ParityOutcome], info: ParityRunInfo) throws -> String {
        struct Report: Encodable {
            let stamp: String
            let currentApp: String
            let nativeApp: String
            let outcomes: [ParityOutcome]
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        let report = Report(
            stamp: info.stamp, currentApp: info.currentApp, nativeApp: info.nativeApp, outcomes: outcomes
        )
        return String(decoding: try encoder.encode(report), as: UTF8.self) + "\n"
    }
}
