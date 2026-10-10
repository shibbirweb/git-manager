// CSS flexbox shrinking for a row of items that do not fit (the spec's "resolve flexible lengths" for flex-shrink 1):
// the overflow is taken from each item in proportion to its flex base size (its natural, unclamped width), then
// each item is held to its max-width. Matched against WebKit's commit target row (CommitBox.svelte .target).

import CoreGraphics

public enum FlexShrink {
    /// Widths of the shrinkable `bases` (with optional `maxes` and `mins`) in a row of `available` points after
    /// `fixed` points of inflexible items and gaps. An item that would shrink below its min-width is frozen there and
    /// the rest of the overflow is shared again among the others, as the spec's loop does.
    public static func widths(
        bases: [CGFloat], maxes: [CGFloat?], mins: [CGFloat] = [], fixed: CGFloat, available: CGFloat
    ) -> [CGFloat] {
        var widths = bases
        var frozen = Set<Int>()
        while true {
            let open = bases.indices.filter { !frozen.contains($0) }
            let openBase = open.reduce(0) { $0 + bases[$1] }
            let frozenWidth = frozen.reduce(0) { $0 + widths[$1] }
            let overflow = fixed + frozenWidth + openBase - available
            var violated = false
            for index in open {
                var width = bases[index]
                if overflow > 0 && openBase > 0 {
                    width -= overflow * bases[index] / openBase
                }
                let minimum = index < mins.count ? mins[index] : 0
                if width < minimum {
                    width = minimum
                    frozen.insert(index)
                    violated = true
                }
                widths[index] = width
            }
            if !violated {
                break
            }
        }
        return widths.enumerated().map { index, width in
            let limited = index < maxes.count ? maxes[index].map { min(width, $0) } ?? width : width
            return max(0, limited)
        }
    }
}
