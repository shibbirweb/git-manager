// gm-measure speed's report: per metric each app's median over the runs, and which app is faster there.

import Foundation
import MeasureKit

enum SpeedReport {
    static func markdown(_ samples: [Speed.Sample], options: Speed.Options, stamp: String) -> String {
        var lines = [
            "# gm-measure speed \(stamp)", "",
            "Mode \(options.mode), \(options.repeats) runs; search over \(options.files) files, a "
                + "\(options.lines)-line diff, scroll walk at \(options.speed) points a frame. Times in ms (median of "
                + "the runs).", "",
            "| Metric | Current app | Native app | Faster |", "|---|---|---|---|",
        ]
        var metrics: [String] = []
        for sample in samples where !metrics.contains(sample.metric) {
            metrics.append(sample.metric)
        }
        for metric in metrics {
            let current = median(samples.filter { $0.metric == metric && $0.kind == .current }.compactMap(\.value))
            let native = median(samples.filter { $0.metric == metric && $0.kind == .native }.compactMap(\.value))
            lines.append("| \(metric) | \(format(current)) | \(format(native)) | "
                + "\(verdict(metric: metric, current: current, native: native)) |")
        }
        lines += ["", "Changed frames after the input (ms), per run:"]
        for sample in samples where !sample.changes.isEmpty {
            let times = sample.changes.map { String(format: "%.0f", $0) }.joined(separator: " ")
            lines.append("- \(sample.kind.rawValue), \(sample.metric): \(times)")
        }
        return lines.joined(separator: "\n") + "\n"
    }

    static func median(_ values: [Double]) -> Double? {
        guard !values.isEmpty else {
            return nil
        }
        let sorted = values.sorted()
        return sorted[sorted.count / 2]
    }

    private static func format(_ value: Double?) -> String {
        value.map { String(format: "%.0f", $0) } ?? "-"
    }

    /// Frames a second are better higher; times and gaps lower.
    private static func verdict(metric: String, current: Double?, native: Double?) -> String {
        guard let current, let native, current > 0, native > 0 else {
            return "-"
        }
        let higherIsBetter = metric.hasSuffix("frames a second")
        let nativeWins = higherIsBetter ? native > current : native < current
        let ratio = max(native, current) / min(native, current)
        return String(format: "%@ (%.1fx)", nativeWins ? "native" : "current", ratio)
    }
}
