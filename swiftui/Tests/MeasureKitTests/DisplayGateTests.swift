import Foundation
import MeasureKit
import Testing

private let off = DisplayState(
    headroom: 1, potentialHeadroom: 16, screenName: "Built-in Retina Display", colorSpaceName: "Color LCD"
)

private func hdr(_ headroom: Double) -> DisplayState {
    var state = off
    state.headroom = headroom
    return state
}

/// A clock that moves only when the gate sleeps, and a reader that plays back a list of states.
private final class FakeDisplay {
    var states: [DisplayState?]
    var reads = 0
    var waits = 0
    var time = Date(timeIntervalSince1970: 0)

    init(_ states: [DisplayState?]) {
        self.states = states
    }

    func read() -> DisplayState? {
        reads += 1
        return states.count > 1 ? states.removeFirst() : states.first ?? nil
    }

    func wait(_ requirement: HDRRequirement, waitS: Double = 5) async throws -> DisplayState? {
        try await DisplayGate.wait(
            for: requirement, waitS: waitS, pollS: 0.5, moment: "before the native screenshot",
            read: read, sleep: { self.time.addTimeInterval($0) }, now: { self.time }, onWait: { _ in self.waits += 1 }
        )
    }
}

@Test func headroomAboveOneIsHDR() {
    #expect(!off.hdrOn)
    #expect(!hdr(1.0004).hdrOn)
    #expect(hdr(1.01).hdrOn)
    #expect(hdr(2.5).hdrOn)
}

@Test func requirementParsesWithOffAsDefault() throws {
    #expect(try HDRRequirement.parse(nil) == .off)
    #expect(try HDRRequirement.parse("any") == .any)
    #expect(throws: ToolError.self) { try HDRRequirement.parse("on") }
}

@Test func verdictFollowsTheRequirement() {
    #expect(DisplayGate.verdict(off, requirement: .off) == .ready)
    #expect(DisplayGate.verdict(hdr(2), requirement: .off) == .hdrOn(2))
    #expect(DisplayGate.verdict(nil, requirement: .off) == .noScreen)
    #expect(DisplayGate.verdict(hdr(2), requirement: .any) == .ready)
    #expect(DisplayGate.verdict(nil, requirement: .any) == .ready)
}

@Test func gatePassesAtOnceWithHDROff() async throws {
    let display = FakeDisplay([off])
    #expect(try await display.wait(.off) == off)
    #expect(display.reads == 1)
    #expect(display.waits == 0)
}

@Test func gateWaitsUntilHDRGoesOff() async throws {
    let display = FakeDisplay([hdr(3), hdr(1.5), off])
    #expect(try await display.wait(.off) == off)
    #expect(display.reads == 3)
    #expect(display.waits == 1)
    #expect(display.time.timeIntervalSince1970 == 1)
}

@Test func gateFailsNamingTheCauseWhenHDRStaysOn() async throws {
    let display = FakeDisplay([hdr(2.5)])
    do {
        _ = try await display.wait(.off, waitS: 3)
        Issue.record("the gate let an HDR display through")
    } catch let error as DisplayGateError {
        let text = error.description
        #expect(text.contains("HDR is on before the native screenshot"))
        #expect(text.contains("2.5x headroom"))
        #expect(text.contains("Some app shows HDR content"))
        #expect(text.contains("waited 3 s"))
    }
    #expect(display.time.timeIntervalSince1970 == 3)
}

@Test func gateFailsWithoutAScreenUnlessAnyIsAsked() async throws {
    await #expect(throws: DisplayGateError.self) { try await FakeDisplay([nil]).wait(.off, waitS: 1) }
    #expect(try await FakeDisplay([nil]).wait(.any) == nil)
    let display = FakeDisplay([hdr(4)])
    #expect(try await display.wait(.any) == hdr(4))
    #expect(display.reads == 1)
}

@Test func reportLinesGiveStateHeadroomAndScreen() {
    #expect(off.summary == "HDR off (headroom 1, potential 16), Built-in Retina Display, color space Color LCD, "
        + "brightness not readable")
    #expect(DisplayReport.markdownLine([off, off], requirement: .off) == "Display: HDR off at every capture "
        + "(headroom 1, potential 16), Built-in Retina Display, color space Color LCD, brightness not readable. "
        + "Required: --hdr off.")
    var bright = hdr(2.25)
    bright.brightness = 0.734
    bright.referenceHeadroom = 4
    #expect(DisplayReport.describe([off, bright]).hasPrefix(
        "HDR on at some captures (headroom 1 to 2.25, potential 16, reference 4), Built-in Retina Display"
    ))
    #expect(DisplayReport.describe([bright]).hasSuffix("brightness 73%"))
    #expect(DisplayReport.describe([]) == "not read (no screen)")
}

@Test func reportJSONListsEveryHeadroom() throws {
    let json = DisplayReport.json([off, hdr(1.5)], requirement: .any)
    #expect(json["hdr"] as? String == "any")
    #expect(json["hdrOn"] as? Bool == true)
    #expect(json["headroom"] as? [Double] == [1, 1.5])
    #expect(json["colorSpace"] as? String == "Color LCD")
    #expect(json["brightness"] is NSNull)
    #expect(try DisplayState.decode(json: try off.encodedJSON()) == off)
}
