import Foundation
import MeasureKit
import Testing

private func outcome(_ scenario: String, _ mode: String, content: Double?, problems: [String] = []) -> ParityOutcome {
    var outcome = ParityOutcome(scenario: scenario, mode: mode)
    outcome.contentPercent = content
    outcome.windowPercent = content.map { $0 - 0.2 }
    outcome.currentMb = 141.4
    outcome.nativeMb = 32.6
    outcome.currentVersion = "0.1.0-beta.7"
    outcome.nativeVersion = "0.1.0"
    outcome.problems = problems
    if content != nil {
        outcome.files = ["\(scenario)-\(mode)/current.png", "\(scenario)-\(mode)/diff.png"]
    }
    return outcome
}

@Test func reportShowsScoresProblemsAndWhatIsMissing() throws {
    let list = try makeList(scenarios: sampleScenarios, features: sampleFeatures)
    let outcomes = [
        outcome("changes", "light", content: 99.17),
        outcome("diff", "dark", content: nil, problems: ["current: capture failed: No Screen Recording permission"]),
    ]
    let display = DisplayState(headroom: 1, potentialHeadroom: 16, colorSpaceName: "Color LCD")
    let info = ParityRunInfo(
        stamp: "2026-10-08T10-00-00Z", currentApp: "/A/Current.app", nativeApp: "/B/Native.app", hdr: .off,
        displays: [display, display]
    )
    let text = ParityReport.markdown(outcomes, list: list, info: info)
    #expect(text.contains("Display: HDR off at every capture (headroom 1, potential 16), color space Color LCD, "
        + "brightness not readable. Required: --hdr off."))
    #expect(text.contains("| changes: Changes | light | 99.17% | 98.97% | 141 MB | 33 MB | changes-light/diff.png |"))
    #expect(text.contains("| diff: Diff | dark | not compared | - | 141 MB | 33 MB | - |"))
    #expect(text.contains("- diff, dark: current: capture failed: No Screen Recording permission"))
    #expect(text.contains("- Partial in native: Changes (`changes`): staging; commit"))
    #expect(!text.contains("Shell (`shell`)"))
    #expect(text.contains("Note: Old build, known."))
    #expect(text.contains("- `log` Log: missing in native: Log (`log`)"))

    let json = try JSONSerialization.jsonObject(with: Data(try ParityReport.json(outcomes, info: info).utf8))
    let decoded = (json as? [String: Any])?["outcomes"] as? [[String: Any]]
    #expect(decoded?.count == 2)
    #expect(decoded?.first?["contentPercent"] as? Double == 99.17)
    #expect((json as? [String: Any])?["hdr"] as? String == "off")
    #expect(((json as? [String: Any])?["displays"] as? [Any])?.count == 2)
}

@Test func resultsKeepEarlierRunsAndRoundTrip() throws {
    var results = ParityResults()
    results.record([outcome("changes", "light", content: 99.0), outcome("diff", "light", content: 81.4)],
                   date: "2026-10-07")
    results.record([outcome("changes", "light", content: 99.17)], date: "2026-10-08")
    #expect(results.measurement("changes", "light")?.contentPercent == 99.17)
    #expect(results.measurement("changes", "light")?.date == "2026-10-08")
    #expect(results.measurement("diff", "light")?.date == "2026-10-07")
    #expect(results.measurement("diff", "dark") == nil)

    let path = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-results-\(UUID().uuidString).json")
    defer { try? FileManager.default.removeItem(atPath: path) }
    try results.encoded().write(toFile: path, atomically: true, encoding: .utf8)
    #expect(try ParityResults.load(path: path) == results)
    #expect(try ParityResults.load(path: path + ".missing") == ParityResults())
}

@Test func summaryRowsCarryTheLastNumbers() throws {
    let list = try makeList(scenarios: sampleScenarios, features: sampleFeatures)
    var results = ParityResults()
    results.record([outcome("changes", "light", content: 99.17), outcome("changes", "dark", content: 99.1)],
                   date: "2026-10-08")
    let pages = ParitySummary.pages(list, results: results)
    #expect(pages.map(\.name) == ["README.md", "Scenarios.md"])
    let readme = pages[0].text
    #expect(readme.contains("| Changes | changes | partial | changes | 99.17% / 99.1% | 141 MB / 33 MB |"))
    #expect(readme.contains("| Log | log | missing | log | - | - |"))
    #expect(readme.contains("Native: 1 done, 2 partial, 1 missing (4 features). 2 of 3 scenarios run in both apps."))
    let scenarios = pages[1].text
    #expect(scenarios.contains("## log: Log (native app cannot show it yet)"))
    #expect(scenarios.contains("Measured: light 99.17% (141 MB / 33 MB, 2026-10-08), dark 99.1%"))
    #expect(scenarios.contains("- Changes (`changes`, partial): Rows. Native lacks: staging; commit."))
}

@Test func wrapKeepsLinesWithinTheWidth() {
    let text = Array(repeating: "word", count: 40).joined(separator: " ")
    let lines = ParitySummary.wrap("- " + text, width: 30, hanging: "  ")
    #expect(lines.allSatisfy { $0.count <= 30 })
    #expect(lines.dropFirst().allSatisfy { $0.hasPrefix("  word") })
    #expect(lines.joined(separator: " ").split(separator: " ").count == 41)
    #expect(ParitySummary.wrap("") == [""])
}

@Test func paginateSplitsAtSectionHeadings() {
    var lines = ["# Title", ""]
    for section in 0..<5 {
        lines += ["", "## Section \(section)"] + Array(repeating: "text", count: 100)
    }
    let pages = ParitySummary.paginate(lines)
    #expect(pages.count == 3)
    for page in pages {
        let count = page.split(separator: "\n", omittingEmptySubsequences: false).count
        #expect(count <= ParitySummary.pageLines + 1)
    }
    #expect(pages[1].hasPrefix("# Parity scenarios (continued)\n\n## Section 2"))
    #expect(pages.joined().components(separatedBy: "## Section").count == 6)
}

@Test func numbersAreTrimmed() {
    #expect(ParityFormat.percent(99.1) == "99.1%")
    #expect(ParityFormat.percent(100) == "100%")
    #expect(ParityFormat.percent(nil) == "-")
    #expect(ParityFormat.megabytes(32.6) == "33 MB")
}
