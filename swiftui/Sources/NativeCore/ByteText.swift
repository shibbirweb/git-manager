// The status bar's memory text, as StatusBar.svelte formatBytes writes it: GB with two decimals, MB with one below
// 100 MB and none from there, KB below 1 MB. JavaScript's toFixed rounds halves up, so this does too.

import Foundation

public enum ByteText {
    public static func status(_ bytes: UInt64) -> String {
        let value = Double(bytes)
        let mb = 1024.0 * 1024
        if value >= 1024 * mb {
            return fixed(value / mb / 1024, digits: 2) + " GB"
        }
        if value >= mb {
            return fixed(value / mb, digits: value >= 100 * mb ? 0 : 1) + " MB"
        }
        return fixed(value / 1024, digits: 0) + " KB"
    }

    private static func fixed(_ value: Double, digits: Int) -> String {
        let scale = pow(10, Double(digits))
        let rounded = (value * scale).rounded(.toNearestOrAwayFromZero) / scale
        return String(format: "%.\(digits)f", rounded)
    }
}
