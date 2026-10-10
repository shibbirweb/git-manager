// How long the diff canvas takes to paint, collected while a scroll walk runs (ScrollWalk.swift), so gm-measure
// memory can report time per frame next to memory. Off outside a walk: one flag check per paint.

import Foundation

@MainActor
enum DrawStats {
    private static var collecting = false
    private static var times: [Double] = []

    static func start() {
        times = []
        collecting = true
    }

    /// Times one paint, in milliseconds, while collecting.
    static func measure<Value>(_ work: () -> Value) -> Value {
        guard collecting else {
            return work()
        }
        let start = DispatchTime.now().uptimeNanoseconds
        let value = work()
        times.append(Double(DispatchTime.now().uptimeNanoseconds - start) / 1_000_000)
        return value
    }

    /// Paints, average and 95th percentile and slowest paint in ms; stops collecting.
    static func finish() -> [String: Any] {
        collecting = false
        let sorted = times.sorted()
        defer {
            times = []
        }
        guard !sorted.isEmpty else {
            return ["paints": 0]
        }
        let percentile = sorted[min(sorted.count - 1, Int(Double(sorted.count) * 0.95))]
        return [
            "paints": sorted.count,
            "averageMs": round(sorted.reduce(0, +) / Double(sorted.count) * 100) / 100,
            "p95Ms": round(percentile * 100) / 100,
            "maxMs": round((sorted.last ?? 0) * 100) / 100,
        ]
    }
}
