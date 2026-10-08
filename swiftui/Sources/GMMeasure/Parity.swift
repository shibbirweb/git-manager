// gm-measure parity: runs every scenario of the parity list (swiftui/Parity) that the native app can show, in
// both apps and each color mode, and writes build/parity/<time>/report.md and report.json: per scenario the pixel
// match, the overlay, memory, and the features listed as missing in native.
//
//   gm-measure parity [--scenarios a,b] [--modes light,dark] [--settle <s>] [--sample <s>]
//                     [--current-app <path>] [--native-app <path>] [--record] [--hdr off|any] [--hdr-wait <s>]
//   gm-measure parity list              the scenarios, and which ones run
//   gm-measure parity summary [--check] writes (or checks) Parity/README.md and Scenarios*.md from the JSON

import Foundation
import MeasureKit

enum Parity {
    static let parityDir = (swiftuiDir as NSString).appendingPathComponent("Parity")
    static let resultsPath = (parityDir as NSString).appendingPathComponent("results.json")
    static let wikiFeaturesPath = (repoRoot as NSString).appendingPathComponent("docs/wiki/features.json")

    static func run(_ arguments: [String]) async throws -> Int32 {
        var arguments = arguments
        switch arguments.first {
        case "list":
            arguments.removeFirst()
            return try printList(arguments)
        case "summary":
            arguments.removeFirst()
            return try summary(check: arguments == ["--check"], arguments: arguments)
        default:
            return try await measure(arguments)
        }
    }

    /// The list, refused when it has problems (a feature of the wiki left out, an unknown scenario...).
    static func loadList() throws -> ParityList {
        let list = try ParityList.load(directoryPath: parityDir)
        let problems = list.problems(wikiFeatureIDs: try ParityList.wikiFeatureIDs(featuresJSONPath: wikiFeaturesPath))
        if !problems.isEmpty {
            throw ToolError("The parity list (\(parityDir)) has problems:\n- " + problems.joined(separator: "\n- "))
        }
        return list
    }

    private static func measure(_ arguments: [String]) async throws -> Int32 {
        var arguments = arguments
        let scenarioIDs = option("--scenarios", in: &arguments).map { $0.split(separator: ",").map(String.init) }
        let modes = try parseModes(option("--modes", in: &arguments) ?? "light,dark")
        var options = ParityRun.Options()
        options.settleS = max(0, Int(option("--settle", in: &arguments) ?? "3") ?? 3)
        options.sampleS = max(0, Int(option("--sample", in: &arguments) ?? "5") ?? 5)
        options.appPaths[.current] = option("--current-app", in: &arguments)
        options.appPaths[.native] = option("--native-app", in: &arguments)
        options.gate = try Display.gate(from: &arguments)
        let record = arguments.contains("--record")
        arguments.removeAll { $0 == "--record" }
        guard arguments.isEmpty else {
            print(usage)
            return 2
        }
        let list = try loadList()
        let scenarios = try list.select(scenarioIDs)
        if !WindowCapture.ensureAccess() {
            print("Screenshots need Screen Recording permission (\(Reference.permissionHint)); "
                + "the report marks every scenario as not compared.")
        }

        try await options.gate.require("before the run starts", record: false)

        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let outDir = (swiftuiDir as NSString).appendingPathComponent("build/parity/\(stamp)")
        try FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
        let workDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-parity-\(stamp)")
        defer { try? FileManager.default.removeItem(atPath: workDir) }
        _ = try Measure.buildDemo(in: workDir)
        let demoDir = (workDir as NSString).appendingPathComponent("demo")

        var outcomes: [ParityOutcome] = []
        var gateError: DisplayGateError?
        runs: for mode in modes {
            for scenario in scenarios {
                let run = await ParityRun.run(
                    scenario, mode: mode, demoDir: demoDir, workDir: workDir, outDir: outDir, options: options
                )
                outcomes.append(run.outcome)
                if let error = run.gateError {
                    gateError = error
                    break runs
                }
            }
        }
        let info = ParityRunInfo(
            stamp: stamp,
            currentApp: options.appPaths[.current] ?? AppLauncher.defaultAppPath(.current, swiftuiDir: swiftuiDir),
            nativeApp: options.appPaths[.native] ?? AppLauncher.defaultAppPath(.native, swiftuiDir: swiftuiDir),
            hdr: options.gate.requirement,
            displays: options.gate.states
        )
        let markdown = ParityReport.markdown(outcomes, list: list, info: info)
        let markdownPath = (outDir as NSString).appendingPathComponent("report.md")
        try markdown.write(toFile: markdownPath, atomically: true, encoding: .utf8)
        let jsonPath = (outDir as NSString).appendingPathComponent("report.json")
        try ParityReport.json(outcomes, info: info).write(toFile: jsonPath, atomically: true, encoding: .utf8)
        print("\n\(markdown)\nSaved in \(outDir)")
        if let gateError {
            print("Stopped: \(gateError)")
            return 1
        }

        if record {
            var results = try ParityResults.load(path: resultsPath)
            let day = DateFormatter()
            day.dateFormat = "yyyy-MM-dd"
            day.locale = Locale(identifier: "en_US_POSIX")
            results.record(outcomes, date: day.string(from: Date()))
            try results.encoded().write(toFile: resultsPath, atomically: true, encoding: .utf8)
            try writeSummary(list, results: results)
            print("Recorded in \(resultsPath) and the summary pages.")
        }
        return outcomes.allSatisfy { $0.problems.isEmpty } ? 0 : 1
    }

    private static func printList(_ arguments: [String]) throws -> Int32 {
        guard arguments.isEmpty else {
            print(usage)
            return 2
        }
        let list = try loadList()
        for scenario in list.scenarios {
            let features = list.features(in: scenario.id).map(\.id).joined(separator: ", ")
            print("\(scenario.runnable ? "runs   " : "missing") \(scenario.id): \(features)")
        }
        return 0
    }

    /// Writes the generated pages, or with --check reports which ones are out of date.
    private static func summary(check: Bool, arguments: [String]) throws -> Int32 {
        guard arguments.isEmpty || check else {
            print(usage)
            return 2
        }
        let list = try loadList()
        let results = try ParityResults.load(path: resultsPath)
        if !check {
            try writeSummary(list, results: results)
            print("Wrote the summary pages in \(parityDir)")
            return 0
        }
        let pages = ParitySummary.pages(list, results: results)
        var stale = pages.filter { page in
            let filePath = (parityDir as NSString).appendingPathComponent(page.name)
            return (try? String(contentsOfFile: filePath, encoding: .utf8)) != page.text
        }.map(\.name)
        stale += extraPages(keeping: pages.map(\.name))
        if stale.isEmpty {
            print("The parity summary is up to date.")
            return 0
        }
        print("Out of date: \(stale.joined(separator: ", ")). Run: swift run -c release gm-measure parity summary")
        return 1
    }

    private static func writeSummary(_ list: ParityList, results: ParityResults) throws {
        let pages = ParitySummary.pages(list, results: results)
        for page in pages {
            let filePath = (parityDir as NSString).appendingPathComponent(page.name)
            try page.text.write(toFile: filePath, atomically: true, encoding: .utf8)
        }
        for name in extraPages(keeping: pages.map(\.name)) {
            try FileManager.default.removeItem(atPath: (parityDir as NSString).appendingPathComponent(name))
        }
    }

    /// Scenario pages left from a longer list.
    private static func extraPages(keeping names: [String]) -> [String] {
        let existing = (try? FileManager.default.contentsOfDirectory(atPath: parityDir)) ?? []
        return existing.filter { $0.hasPrefix("Scenarios") && $0.hasSuffix(".md") && !names.contains($0) }.sorted()
    }
}
