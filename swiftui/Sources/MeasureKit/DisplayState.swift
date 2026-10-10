// The display's state during a measurement. The current app (WebKit) renders some dark colors one step differently
// while the display has HDR headroom (any HDR or EDR content on screen, such as a video), so a capture is only valid
// in a known state. gm-measure checks it before each capture (DisplayGate) and writes it into its reports.

import Foundation

public struct DisplayState: Codable, Equatable {
    /// The extended dynamic range headroom macOS gives the screen right now: 1.0 while no app shows HDR content.
    public var headroom: Double
    /// The most the screen could give (1.0 on a display without HDR).
    public var potentialHeadroom: Double
    /// The headroom of the screen's reference mode, nil when it is not in one.
    public var referenceHeadroom: Double?
    public var screenName: String?
    public var colorSpaceName: String?
    /// The display's brightness from 0 to 1, when a public API reads it (not on the built-in display of Apple
    /// silicon Macs, which only private frameworks report).
    public var brightness: Double?

    public init(
        headroom: Double,
        potentialHeadroom: Double,
        referenceHeadroom: Double? = nil,
        screenName: String? = nil,
        colorSpaceName: String? = nil,
        brightness: Double? = nil
    ) {
        self.headroom = headroom
        self.potentialHeadroom = potentialHeadroom
        self.referenceHeadroom = referenceHeadroom
        self.screenName = screenName
        self.colorSpaceName = colorSpaceName
        self.brightness = brightness
    }

    /// Headroom above 1.0 (a hair of slack for float noise) means some app shows HDR content.
    public var hdrOn: Bool {
        headroom > 1.0005
    }

    /// "HDR off (headroom 1, potential 16), Built-in Retina Display, color space Color LCD, brightness not readable"
    public var summary: String {
        DisplayReport.describe([self])
    }

    public static func decode(json text: String) throws -> DisplayState {
        try JSONDecoder().decode(DisplayState.self, from: Data(text.utf8))
    }

    public func encodedJSON() throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return String(decoding: try encoder.encode(self), as: UTF8.self)
    }
}

/// What a run asks of the display (--hdr): off (headroom 1.0 at every capture, the default and the user's gate) or
/// any (no check, the state is still recorded).
public enum HDRRequirement: String, CaseIterable {
    case off
    case any

    public static func parse(_ text: String?) throws -> HDRRequirement {
        guard let text else {
            return .off
        }
        guard let requirement = HDRRequirement(rawValue: text) else {
            throw ToolError("--hdr is off or any (got \(text))")
        }
        return requirement
    }
}

/// The display lines and JSON of the reports.
public enum DisplayReport {
    /// One sentence for the states seen at a run's captures: the HDR state, the headroom (a range when it moved),
    /// the screen, its color space and brightness. Screen details come from the last state.
    public static func describe(_ states: [DisplayState]) -> String {
        guard let last = states.last else {
            return "not read (no screen)"
        }
        let headrooms = states.map(\.headroom)
        let low = headrooms.min() ?? last.headroom
        let high = headrooms.max() ?? last.headroom
        let anyOn = states.contains(where: \.hdrOn)
        let state: String
        if !anyOn {
            state = states.count > 1 ? "HDR off at every capture" : "HDR off"
        } else if states.allSatisfy(\.hdrOn) {
            state = "HDR on"
        } else {
            state = "HDR on at some captures"
        }
        let headroom = low == high ? number(low) : "\(number(low)) to \(number(high))"
        var details = "headroom \(headroom), potential \(number(last.potentialHeadroom))"
        if let reference = last.referenceHeadroom {
            details += ", reference \(number(reference))"
        }
        var parts = ["\(state) (\(details))"]
        if let screen = last.screenName {
            parts.append(screen)
        }
        parts.append("color space \(last.colorSpaceName ?? "unknown")")
        parts.append(last.brightness.map { "brightness \(Int(($0 * 100).rounded()))%" } ?? "brightness not readable")
        return parts.joined(separator: ", ")
    }

    /// The line of report.md: the states and the run's requirement.
    public static func markdownLine(_ states: [DisplayState], requirement: HDRRequirement) -> String {
        "Display: \(describe(states)). Required: --hdr \(requirement.rawValue)."
    }

    /// The "display" object of report.json.
    public static func json(_ states: [DisplayState], requirement: HDRRequirement) -> [String: Any] {
        let last = states.last
        return [
            "hdr": requirement.rawValue,
            "hdrOn": states.contains(where: \.hdrOn),
            "headroom": states.map(\.headroom),
            "potentialHeadroom": last?.potentialHeadroom ?? NSNull(),
            "referenceHeadroom": last?.referenceHeadroom ?? NSNull(),
            "screen": last?.screenName ?? NSNull(),
            "colorSpace": last?.colorSpaceName ?? NSNull(),
            "brightness": last?.brightness ?? NSNull(),
        ]
    }

    /// 1, 1.5, 16: at most three decimals, no trailing zeros.
    public static func number(_ value: Double) -> String {
        var text = String(format: "%.3f", value)
        while text.hasSuffix("0") {
            text.removeLast()
        }
        if text.hasSuffix(".") {
            text.removeLast()
        }
        return text
    }
}
