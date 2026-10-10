// The check before each capture: with --hdr off the display must have no HDR headroom (1.0). The waiting is pure
// logic with the reader, sleep and clock passed in, so it is tested without a screen; DisplayProbe reads the screen.

import Foundation

/// Why a run stopped: the display is not in the state the run asked for.
public struct DisplayGateError: Error, CustomStringConvertible {
    public let description: String

    public init(_ description: String) {
        self.description = description
    }
}

public enum DisplayGate {
    public enum Verdict: Equatable {
        case ready
        /// HDR is on, with this headroom.
        case hdrOn(Double)
        /// No screen to read (no window server connection, for example).
        case noScreen
    }

    public static func verdict(_ state: DisplayState?, requirement: HDRRequirement) -> Verdict {
        if requirement == .any {
            return .ready
        }
        guard let state else {
            return .noScreen
        }
        if state.hdrOn {
            return .hdrOn(state.headroom)
        }
        return .ready
    }

    /// The error after waiting, naming the cause and the way out. `moment` says which capture waited.
    public static func failure(_ verdict: Verdict, waitedS: Double, moment: String) -> DisplayGateError {
        let waited = DisplayReport.number(waitedS)
        switch verdict {
        case .hdrOn(let headroom):
            return DisplayGateError(
                "HDR is on \(moment): the display has \(DisplayReport.number(headroom))x headroom, and --hdr off "
                    + "needs 1.0 (waited \(waited) s). Some app shows HDR content (a video, an HDR photo or an EDR "
                    + "window): close it or move it off this screen and run again. The current app renders some "
                    + "dark colors one step differently while HDR is on, so this run would not be comparable."
            )
        case .noScreen:
            return DisplayGateError(
                "No screen to read \(moment) (waited \(waited) s): gm-measure cannot tell whether HDR is off. "
                    + "Run it in a logged-in session with a display, or pass --hdr any."
            )
        case .ready:
            return DisplayGateError("The display is ready \(moment).")
        }
    }

    /// Reads the display until it meets `requirement` or `waitS` seconds pass, polling every `pollS`. Returns the
    /// last state read (nil without a screen under --hdr any); throws DisplayGateError when the time runs out.
    public static func wait(
        for requirement: HDRRequirement,
        waitS: Double,
        pollS: Double = 0.5,
        moment: String,
        read: () -> DisplayState?,
        sleep: (Double) async -> Void,
        now: () -> Date = Date.init,
        onWait: (DisplayState?) -> Void = { _ in }
    ) async throws -> DisplayState? {
        let start = now()
        var state = read()
        var waited = false
        while true {
            let current = verdict(state, requirement: requirement)
            if current == .ready {
                return state
            }
            let elapsed = now().timeIntervalSince(start)
            if elapsed >= waitS {
                throw failure(current, waitedS: elapsed, moment: moment)
            }
            if !waited {
                waited = true
                onWait(state)
            }
            await sleep(min(pollS, max(0, waitS - elapsed)))
            state = read()
        }
    }
}
