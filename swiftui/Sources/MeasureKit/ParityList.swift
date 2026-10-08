// The parity list (swiftui/Parity): every feature of the current app (docs/wiki/features.json), the scenario that
// shows it in both apps, and how far the native app has come. Hand-kept JSON, split into files of at most 300 lines
// (features-*.json, scenarios-*.json); measured numbers live apart in results.json, written by gm-measure.

import Foundation

public enum NativeStatus: String, Codable, CaseIterable {
    case done
    case partial
    case missing
}

public struct ParityFeature: Codable, Equatable {
    public let id: String
    public let name: String
    /// The current app's user page, relative to docs/wiki/usage.
    public let usage: String
    public let scenario: String
    /// What to look at or do once the scenario is on screen.
    public let check: String
    public let native: NativeStatus
    /// What the native app still lacks (partial and missing features), one item each.
    public let gaps: [String]?

    /// The gaps as one sentence, or nil.
    public var gapText: String? {
        guard let gaps, !gaps.isEmpty else {
            return nil
        }
        return gaps.joined(separator: "; ")
    }
}

/// A value for the current app's settings.json.
public enum ParityValue: Codable, Equatable {
    case bool(Bool)
    case number(Double)
    case string(String)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let flag = try? container.decode(Bool.self) {
            self = .bool(flag)
        } else if let number = try? container.decode(Double.self) {
            self = .number(number)
        } else {
            self = .string(try container.decode(String.self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .bool(let flag):
            try container.encode(flag)
        case .number(let number):
            try container.encode(number)
        case .string(let text):
            try container.encode(text)
        }
    }

    public var any: Any {
        switch self {
        case .bool(let flag):
            return flag
        case .number(let number):
            return number
        case .string(let text):
            return text
        }
    }
}

/// An element the current app must show (or not show) before it is captured, found with inspect_elements.
public struct ParityExpectation: Codable, Equatable {
    public let selector: String
    public let present: Bool
}

/// How gm-measure parity drives both apps into a scenario. Every field is optional, so a new scenario often needs
/// only data: a file to diff, settings, localStorage values or launch arguments.
public struct ParityRunSpec: Codable, Equatable {
    /// A changed file of the folder whose diff opens (show_changes_diff / app show_diff).
    public var showDiff: String?
    public var staged: Bool?
    /// Values put in the current app's WebKit localStorage for the run (the user's own are put back).
    public var currentStorage: [String: String]?
    /// Extra settings.json values for the current app's throwaway HOME.
    public var currentSettings: [String: ParityValue]?
    /// Extra launch arguments for the native app, such as ["-someOption", "NO"].
    public var nativeArguments: [String]?
    /// Files of the folder staged in both apps before the capture (and unstaged after it, since the scenarios
    /// share one copy of the demo).
    public var stageFiles: [String]?
    /// "Collapse unchanged" in both apps' diffs: the current app's localStorage and the native app's
    /// ~/.gitmanager-native/diff.json, checked on screen in both before the capture.
    public var collapseUnchanged: Bool?
    /// A file of the folder opened in a kept tab in both apps (open_file / app open_file).
    public var openFile: String?
    /// Checked in the current app before capturing; the scenario fails when one does not hold.
    public var expectCurrent: [ParityExpectation]?
    /// Opens the Log in both apps on this revision (such as "HEAD~5"): the current app's show_commit, the native
    /// app's `app action=show_log commitId=...`.
    public var logCommit: String?

    public init() {}
}

public struct ParityScenario: Codable, Equatable {
    public let id: String
    public let title: String
    /// The folder to open, relative to the docs demo (scripts/make-docs-demo.sh); nil for no folder.
    public let folder: String?
    /// The steps as a person does them, the same in both apps.
    public let steps: [String]
    /// Known causes of a difference that are not the native app's (an old current-app build, for example), as
    /// sentences short enough for the line standard.
    public let note: [String]?
    /// Set when gm-measure can drive both apps into the scenario; nil while the native app cannot show it yet.
    public let run: ParityRunSpec?

    public var runnable: Bool {
        run != nil
    }
}

public struct ParityList {
    public var scenarios: [ParityScenario]
    public var features: [ParityFeature]

    public init(scenarios: [ParityScenario], features: [ParityFeature]) {
        self.scenarios = scenarios
        self.features = features
    }

    private struct ScenarioFile: Codable {
        let scenarios: [ParityScenario]
    }

    private struct FeatureFile: Codable {
        let features: [ParityFeature]
    }

    /// Reads every scenarios*.json and features*.json in `directoryPath`, in file name order.
    public static func load(directoryPath: String) throws -> ParityList {
        let names = try FileManager.default.contentsOfDirectory(atPath: directoryPath).sorted()
        var list = ParityList(scenarios: [], features: [])
        for name in names where name.hasSuffix(".json") {
            let filePath = (directoryPath as NSString).appendingPathComponent(name)
            let data = try Data(contentsOf: URL(fileURLWithPath: filePath))
            do {
                if name.hasPrefix("scenarios") {
                    list.scenarios += try JSONDecoder().decode(ScenarioFile.self, from: data).scenarios
                } else if name.hasPrefix("features") {
                    list.features += try JSONDecoder().decode(FeatureFile.self, from: data).features
                }
            } catch {
                throw ToolError("\(name): \(error)")
            }
        }
        return list
    }

    public func scenario(_ scenarioID: String) -> ParityScenario? {
        scenarios.first { $0.id == scenarioID }
    }

    public func features(in scenarioID: String) -> [ParityFeature] {
        features.filter { $0.scenario == scenarioID }
    }

    /// Everything that makes the list unusable: duplicate ids, unknown scenarios, scenarios no feature uses,
    /// runnable scenarios without a folder, and feature ids missing from or unknown to the wiki's feature map.
    public func problems(wikiFeatureIDs: [String]) -> [String] {
        var found: [String] = []
        for id in duplicates(scenarios.map(\.id)) {
            found.append("scenario \(id) is listed twice")
        }
        for id in duplicates(features.map(\.id)) {
            found.append("feature \(id) is listed twice")
        }
        let scenarioIDs = Set(scenarios.map(\.id))
        for feature in features where !scenarioIDs.contains(feature.scenario) {
            found.append("feature \(feature.id) uses the unknown scenario \(feature.scenario)")
        }
        for scenario in scenarios {
            if features(in: scenario.id).isEmpty {
                found.append("scenario \(scenario.id) has no feature")
            }
            if scenario.runnable && scenario.folder == nil {
                found.append("scenario \(scenario.id) can run but opens no folder (not supported yet)")
            }
        }
        let featureIDs = Set(features.map(\.id))
        for id in wikiFeatureIDs where !featureIDs.contains(id) {
            found.append("feature \(id) of docs/wiki/features.json is not in the parity list")
        }
        return found
    }

    /// The scenarios to run: the named ones (each must exist and be runnable), or every runnable one.
    public func select(_ scenarioIDs: [String]?) throws -> [ParityScenario] {
        guard let scenarioIDs, !scenarioIDs.isEmpty else {
            return scenarios.filter(\.runnable)
        }
        return try scenarioIDs.map { scenarioID in
            guard let scenario = scenario(scenarioID) else {
                throw ToolError("Unknown scenario \(scenarioID)")
            }
            if !scenario.runnable {
                throw ToolError("The native app cannot show \(scenarioID) yet (no run in its scenario)")
            }
            return scenario
        }
    }

    /// The feature ids of docs/wiki/features.json.
    public static func wikiFeatureIDs(featuresJSONPath: String) throws -> [String] {
        let data = try Data(contentsOf: URL(fileURLWithPath: featuresJSONPath))
        let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        let features = root["features"] as? [[String: Any]] ?? []
        return features.compactMap { $0["id"] as? String }
    }

    private func duplicates(_ ids: [String]) -> [String] {
        var seen = Set<String>()
        var repeated: [String] = []
        for id in ids where !seen.insert(id).inserted && !repeated.contains(id) {
            repeated.append(id)
        }
        return repeated
    }
}

/// "light,dark" as a list; anything but light and dark is refused.
public func parseModes(_ text: String) throws -> [String] {
    let modes = text.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
    guard !modes.isEmpty, modes.allSatisfy({ $0 == "light" || $0 == "dark" }) else {
        throw ToolError("Modes are light, dark or light,dark (got \(text))")
    }
    return modes
}
