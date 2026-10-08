// What one gm-measure parity run found per scenario and color mode (ParityOutcome, report.json), and the last
// numbers kept in swiftui/Parity/results.json (ParityResults, written with --record).

import Foundation

/// One scenario in one color mode. A nil score means the pixels could not be compared; `problems` says why.
public struct ParityOutcome: Codable, Equatable {
    public var scenario: String
    public var mode: String
    /// Identical pixels below the title bar, which macOS draws in both apps.
    public var contentPercent: Double?
    public var windowPercent: Double?
    public var differentPixels: Int?
    public var sizeMismatch: String?
    public var currentMb: Double?
    public var nativeMb: Double?
    public var currentVersion: String?
    public var nativeVersion: String?
    /// The highest HDR headroom of the display at this scenario's captures (1.0: HDR off).
    public var headroom: Double?
    /// Screenshots and the overlay, relative to the report folder.
    public var files: [String]
    /// Per app: what failed (launch, steps, capture, memory).
    public var problems: [String]

    public init(scenario: String, mode: String) {
        self.scenario = scenario
        self.mode = mode
        files = []
        problems = []
    }

    public var captured: Bool {
        contentPercent != nil
    }
}

/// The last measurement of a scenario in one mode, as kept in the parity list.
public struct ParityMeasurement: Codable, Equatable {
    public var contentPercent: Double?
    public var windowPercent: Double?
    public var currentMb: Double?
    public var nativeMb: Double?
    public var currentVersion: String?
    public var nativeVersion: String?
    /// The day of the run, yyyy-MM-dd.
    public var date: String
    public var problem: String?

    public init(_ outcome: ParityOutcome, date: String) {
        contentPercent = outcome.contentPercent
        windowPercent = outcome.windowPercent
        currentMb = outcome.currentMb
        nativeMb = outcome.nativeMb
        currentVersion = outcome.currentVersion
        nativeVersion = outcome.nativeVersion
        self.date = date
        problem = outcome.problems.isEmpty ? nil : outcome.problems.joined(separator: "; ")
    }
}

public struct ParityResults: Codable, Equatable {
    /// Scenario id, then mode.
    public var scenarios: [String: [String: ParityMeasurement]]

    public init(scenarios: [String: [String: ParityMeasurement]] = [:]) {
        self.scenarios = scenarios
    }

    public static func load(path filePath: String) throws -> ParityResults {
        guard let data = FileManager.default.contents(atPath: filePath) else {
            return ParityResults()
        }
        return try JSONDecoder().decode(ParityResults.self, from: data)
    }

    /// Keeps earlier numbers of scenarios and modes this run did not measure.
    public mutating func record(_ outcomes: [ParityOutcome], date: String) {
        for outcome in outcomes {
            scenarios[outcome.scenario, default: [:]][outcome.mode] = ParityMeasurement(outcome, date: date)
        }
    }

    public func measurement(_ scenarioID: String, _ mode: String) -> ParityMeasurement? {
        scenarios[scenarioID]?[mode]
    }

    public func encoded() throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return String(decoding: try encoder.encode(self), as: UTF8.self) + "\n"
    }
}

public enum ParityFormat {
    /// "99.17%", or a dash when there is no number.
    public static func percent(_ value: Double?) -> String {
        value.map { "\(trimmed($0))%" } ?? "-"
    }

    /// "141 MB", whole megabytes.
    public static func megabytes(_ value: Double?) -> String {
        value.map { "\(Int($0.rounded())) MB" } ?? "-"
    }

    static func trimmed(_ value: Double) -> String {
        let text = String(format: "%.2f", value)
        var trimmedText = text
        while trimmedText.hasSuffix("0") {
            trimmedText.removeLast()
        }
        if trimmedText.hasSuffix(".") {
            trimmedText.removeLast()
        }
        return trimmedText
    }
}
