// CSS flexbox shrinking for a row of items that do not fit (the spec's "resolve flexible lengths" for flex-shrink 1):
// the overflow is taken from each item in proportion to its flex base size (its natural, unclamped width), then
// each item is held to its max-width. Matched against WebKit's commit target row (CommitBox.svelte .target).

import CoreGraphics

public enum FlexShrink {
    /// Widths of the shrinkable `bases` (with optional `maxes`) in a row of `available` points after `fixed` points
    /// of inflexible items and gaps.
    public static func widths(bases: [CGFloat], maxes: [CGFloat?], fixed: CGFloat, available: CGFloat) -> [CGFloat] {
        let total = bases.reduce(0, +)
        let overflow = fixed + total - available
        return bases.enumerated().map { index, base in
            var width = base
            if overflow > 0 && total > 0 {
                width -= overflow * base / total
            }
            if index < maxes.count, let limit = maxes[index] {
                width = min(width, limit)
            }
            return max(0, width)
        }
    }
}
