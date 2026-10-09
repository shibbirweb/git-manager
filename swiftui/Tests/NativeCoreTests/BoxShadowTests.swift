// The popup shadow against the current app's pixels: Quick Open over white (build/reference/quickopen-light.png,
// 2026-10-08), right of the popup at mid height, where each pixel is 255 minus the shadow's stored alpha.

import Foundation
@testable import NativeCore
import Testing

@Test func shadowEdgeMatchesTheCurrentApp() {
    let observed = [
        235, 235, 236, 237, 237, 238, 238, 239, 239, 240, 241, 241, 241, 242, 243, 243, 244, 244, 245, 245,
        246, 246, 246, 247, 247, 248, 248, 248, 249, 249, 249, 250, 250, 250, 251, 251, 251, 251, 252, 252,
        252, 252, 252, 253, 253, 253, 253, 253, 253, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254,
        254, 255, 255,
    ]
    // The popup at 390, 8, 620 x 152 points, the shadow 8 points lower, at 2x.
    let shadow = BoxShadow(
        box: CGRect(x: 780, y: 32, width: 1240, height: 304), radius: 16,
        sigma: BoxShadow.sigma(blur: 28, scale: 2), alpha: 0.16
    )
    let shown = observed.indices.map { 255 - shadow.alpha(x: 2020 + $0, y: 236) }
    #expect(shown == observed)
    #expect(shadow.alpha(x: 2020 + Int(shadow.reach), y: 236) == 0)
}
