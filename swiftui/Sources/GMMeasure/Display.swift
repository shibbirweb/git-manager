// gm-measure display: the display's HDR state, and the gate measure, memory, reference and parity pass before each
// capture (--hdr off|any, --hdr-wait <s>). The current app renders some dark colors one step differently while the
// display has HDR headroom, so captures count only in a known state: HDR off unless --hdr any.
//
//   gm-measure display [--hdr off|any] [--json]   prints the state; exit 1 when --hdr off and HDR is on

import Foundation
import MeasureKit

enum Display {
    /// The run's requirement and how long a capture waits for it; it keeps every state it saw for the report.
    final class Gate {
        let requirement: HDRRequirement
        let waitS: Double
        private(set) var states: [DisplayState] = []

        init(requirement: HDRRequirement, waitS: Double) {
            self.requirement = requirement
            self.waitS = waitS
        }

        /// Waits until the display meets the requirement; `moment` names the capture in messages ("before the
        /// native screenshot"). Throws DisplayGateError when the wait runs out. `record` false leaves the state out
        /// of the report (the check before a run starts).
        @discardableResult
        func require(_ moment: String, record: Bool = true) async throws -> DisplayState? {
            let state = try await DisplayGate.wait(
                for: requirement,
                waitS: waitS,
                moment: moment,
                read: Display.read,
                sleep: { seconds in try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000)) },
                onWait: { state in
                    let headroom = state.map { DisplayReport.number($0.headroom) } ?? "unknown"
                    print("HDR is on (headroom \(headroom)) \(moment); waiting up to \(Int(self.waitS)) s for 1.0")
                }
            )
            if let state, record {
                states.append(state)
            }
            return state
        }

        var markdownLine: String {
            DisplayReport.markdownLine(states, requirement: requirement)
        }

        var json: [String: Any] {
            DisplayReport.json(states, requirement: requirement)
        }
    }

    /// --hdr and --hdr-wait, removed from the arguments.
    static func gate(from arguments: inout [String]) throws -> Gate {
        let requirement = try HDRRequirement.parse(option("--hdr", in: &arguments))
        let waitText = option("--hdr-wait", in: &arguments) ?? "30"
        guard let waitS = Double(waitText), waitS >= 0 else {
            throw ToolError("--hdr-wait is a number of seconds (got \(waitText))")
        }
        return Gate(requirement: requirement, waitS: waitS)
    }

    static func run(_ arguments: [String]) throws -> Int32 {
        var arguments = arguments
        let requirement = try HDRRequirement.parse(option("--hdr", in: &arguments))
        let json = arguments.contains("--json")
        arguments.removeAll { $0 == "--json" }
        guard arguments.isEmpty else {
            print(usage)
            return 2
        }
        let state = DisplayProbe.read()
        if json {
            print(try state?.encodedJSON() ?? "null")
        } else {
            print("Display: \(state?.summary ?? "no screen")")
        }
        switch DisplayGate.verdict(state, requirement: requirement) {
        case .ready:
            return 0
        case let verdict:
            if !json {
                print(DisplayGate.failure(verdict, waitedS: 0, moment: "now"))
            }
            return 1
        }
    }

    /// The state from a new gm-measure process, since this one's NSScreen values may be stale (DisplayProbe);
    /// the in-process value when that fails.
    static func read() -> DisplayState? {
        guard let executable = Bundle.main.executablePath,
              let result = try? AppLauncher.run(executable, ["display", "--hdr", "any", "--json"]),
              result.status == 0 else {
            return DisplayProbe.read()
        }
        let text = result.output.trimmingCharacters(in: .whitespacesAndNewlines)
        if text == "null" {
            return nil
        }
        return (try? DisplayState.decode(json: text)) ?? DisplayProbe.read()
    }
}
