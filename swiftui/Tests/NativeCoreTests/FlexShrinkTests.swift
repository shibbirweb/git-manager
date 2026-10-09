// Flex shrinking, checked against the current app's commit target row: a 239-point row with "Commit to" (58.5),
// two 6-point gaps, the select (natural 183.14, at most 70%) and "on main" (44.5).

import CoreGraphics
import NativeCore
import Testing

@Test func shrinksInProportionToTheUnclampedBaseSizes() {
    let widths = FlexShrink.widths(bases: [183.14, 44.5], maxes: [239 * 0.7, nil], fixed: 70.5, available: 239)
    // WebKit drew the select 135.5 wide (snapped to the device pixel) and cut "on main" to "on ...".
    #expect(abs(widths[0] - 135.56) < 0.05)
    #expect(abs(widths[1] - 32.94) < 0.05)
}

@Test func itemsThatFitKeepTheirWidthsButNotPastTheirMax() {
    let widths = FlexShrink.widths(bases: [100, 30], maxes: [80, nil], fixed: 10, available: 300)
    #expect(widths == [80, 30])
    #expect(FlexShrink.widths(bases: [50], maxes: [], fixed: 400, available: 300) == [0])
}
