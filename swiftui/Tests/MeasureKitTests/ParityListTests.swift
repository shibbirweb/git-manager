import Foundation
import MeasureKit
import Testing

/// swiftui/ of this checkout.
let swiftuiPath = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .path
let parityPath = (swiftuiPath as NSString).appendingPathComponent("Parity")
let wikiFeaturesPath = ((swiftuiPath as NSString).deletingLastPathComponent as NSString)
    .appendingPathComponent("docs/wiki/features.json")

/// A small list from JSON, as the files hold it.
func makeList(scenarios: String, features: String) throws -> ParityList {
    struct Scenarios: Decodable {
        let scenarios: [ParityScenario]
    }
    struct Features: Decodable {
        let features: [ParityFeature]
    }
    let decoder = JSONDecoder()
    return ParityList(
        scenarios: try decoder.decode(Scenarios.self, from: Data("{\"scenarios\": [\(scenarios)]}".utf8)).scenarios,
        features: try decoder.decode(Features.self, from: Data("{\"features\": [\(features)]}".utf8)).features
    )
}

let sampleScenarios = """
    {"id": "changes", "title": "Changes", "folder": "acme/storefront", "steps": ["Open it"], "run": {}},
    {"id": "diff", "title": "Diff", "folder": "acme/storefront", "steps": ["Click a file"],
     "note": ["Old build,", "known."], "run": {"showDiff": "src/cart.ts", "currentSettings": {"theme": "dark"}}},
    {"id": "log", "title": "Log", "folder": "acme/storefront", "steps": ["Press Shift+Cmd+L"]}
    """

let sampleFeatures = """
    {"id": "changes", "name": "Changes", "usage": "Changes.md", "scenario": "changes", "check": "Rows",
     "native": "partial", "gaps": ["staging", "commit"]},
    {"id": "shell", "name": "Shell", "usage": "Start.md", "scenario": "changes", "check": "Layout", "native": "done"},
    {"id": "diffs", "name": "Diffs", "usage": "Diffs.md", "scenario": "diff", "check": "Panes", "native": "partial"},
    {"id": "log", "name": "Log", "usage": "Log.md", "scenario": "log", "check": "Graph", "native": "missing"}
    """

@Test func theParityListCoversEveryWikiFeature() throws {
    let list = try ParityList.load(directoryPath: parityPath)
    let wikiIDs = try ParityList.wikiFeatureIDs(featuresJSONPath: wikiFeaturesPath)
    #expect(wikiIDs.count > 50)
    #expect(list.problems(wikiFeatureIDs: wikiIDs) == [])
    #expect(try list.select(nil).map(\.id).starts(with: ["changes", "diff"]))
}

@Test func theCommittedSummaryIsUpToDate() throws {
    let list = try ParityList.load(directoryPath: parityPath)
    let results = try ParityResults.load(path: (parityPath as NSString).appendingPathComponent("results.json"))
    for page in ParitySummary.pages(list, results: results) {
        let filePath = (parityPath as NSString).appendingPathComponent(page.name)
        let committed = try String(contentsOfFile: filePath, encoding: .utf8)
        #expect(committed == page.text, "\(page.name) is stale: run gm-measure parity summary")
        let lines = page.text.split(separator: "\n", omittingEmptySubsequences: false)
        #expect(lines.count <= 300, "\(page.name) has \(lines.count) lines")
        #expect(lines.allSatisfy { $0.count <= 120 }, "\(page.name) has a line over 120 columns")
    }
}

@Test func problemsNameEveryMistake() throws {
    let list = try makeList(
        scenarios: sampleScenarios + """
            , {"id": "log", "title": "Again", "folder": null, "steps": []},
            {"id": "lonely", "title": "Unused", "folder": null, "steps": [], "run": {}}
            """,
        features: sampleFeatures + """
            , {"id": "log", "name": "Twice", "usage": "x.md", "scenario": "nowhere", "check": "", "native": "missing"}
            """
    )
    let problems = list.problems(wikiFeatureIDs: ["changes", "terminal"])
    #expect(problems.contains("scenario log is listed twice"))
    #expect(problems.contains("feature log is listed twice"))
    #expect(problems.contains("feature log uses the unknown scenario nowhere"))
    #expect(problems.contains("scenario lonely has no feature"))
    #expect(problems.contains("scenario lonely can run but opens no folder (not supported yet)"))
    #expect(problems.contains("feature terminal of docs/wiki/features.json is not in the parity list"))
    #expect(problems.count == 6)
}

@Test func selectRunsRunnableScenariosOnly() throws {
    let list = try makeList(scenarios: sampleScenarios, features: sampleFeatures)
    #expect(try list.select(nil).map(\.id) == ["changes", "diff"])
    #expect(try list.select(["diff"]).map(\.id) == ["diff"])
    #expect(throws: ToolError.self) { try list.select(["log"]) }
    #expect(throws: ToolError.self) { try list.select(["nope"]) }
    #expect(list.scenario("diff")?.run?.currentSettings?["theme"]?.any as? String == "dark")
}

@Test func modesAreLightAndDarkOnly() throws {
    #expect(try parseModes("light,dark") == ["light", "dark"])
    #expect(try parseModes("dark") == ["dark"])
    #expect(throws: ToolError.self) { try parseModes("light,sepia") }
    #expect(throws: ToolError.self) { try parseModes("") }
}

@Test func theStagedAndEveryLineScenariosRunInBothApps() throws {
    let list = try ParityList.load(directoryPath: parityPath)
    let runnable = try list.select(nil).map(\.id)
    #expect(runnable.contains("staged"))
    #expect(runnable.contains("diff-every-line"))
    #expect(list.scenario("staged")?.run?.stageFiles == ["src/cart.ts"])
    #expect(list.scenario("diff-every-line")?.run?.collapseUnchanged == false)
    #expect(list.scenario("diff")?.run?.collapseUnchanged == true)
    #expect(list.features(in: "staged").map(\.id) == ["changes"])
}
