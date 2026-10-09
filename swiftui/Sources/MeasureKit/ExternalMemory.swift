// Memory of an app measured from outside, counted like its own get_memory_usage (src-tauri/src/memory.rs and the
// bridge's memory.rs): the app's phys_footprint plus the WebKit helpers macOS holds it responsible for. For the
// current app started as git mergetool, whose control server does not run.

import Darwin
import Foundation

public enum ExternalMemory {
    public struct Sample {
        public let totalBytes: UInt64
        public let processes: [(name: String, bytes: UInt64)]
    }

    private typealias Responsible = @convention(c) (Int32) -> Int32

    /// libSystem's responsibility_get_pid_responsible_for_pid, which Activity Monitor uses to group helpers.
    private static let responsible: Responsible? = {
        guard let handle = dlopen(nil, RTLD_NOW),
              let symbol = dlsym(handle, "responsibility_get_pid_responsible_for_pid") else {
            return nil
        }
        return unsafeBitCast(symbol, to: Responsible.self)
    }()

    static func footprint(_ pid: Int32) -> UInt64? {
        var info = rusage_info_v2()
        let result = withUnsafeMutablePointer(to: &info) { pointer in
            pointer.withMemoryRebound(to: rusage_info_t?.self, capacity: 1) { proc_pid_rusage(pid, RUSAGE_INFO_V2, $0) }
        }
        return result == 0 ? info.ri_phys_footprint : nil
    }

    static func name(_ pid: Int32) -> String {
        var buffer = [CChar](repeating: 0, count: 256)
        let length = proc_name(pid, &buffer, UInt32(buffer.count))
        return length > 0 ? String(cString: buffer) : ""
    }

    static func allPids() -> [Int32] {
        var pids = [Int32](repeating: 0, count: 8192)
        let count = proc_listallpids(&pids, Int32(pids.count * MemoryLayout<Int32>.size))
        return count > 0 ? Array(pids.prefix(Int(count))) : []
    }

    /// The app at `pid` (launched by macOS, so responsible for itself) and its WebKit helpers.
    public static func sample(pid: Int32) -> Sample {
        var processes: [(name: String, bytes: UInt64)] = [(name(pid), footprint(pid) ?? 0)]
        if let responsible {
            for other in allPids() where other > 0 && other != pid && responsible(other) == pid {
                let processName = name(other)
                if processName.hasPrefix("com.apple.WebKit"), let bytes = footprint(other) {
                    processes.append((processName, bytes))
                }
            }
        }
        return Sample(totalBytes: processes.reduce(0) { $0 + $1.bytes }, processes: processes)
    }

    /// Samples every `intervalS` for `durationS` and returns the average, lowest and highest total in MB.
    public static func measure(pid: Int32, durationS: Double, intervalS: Double = 0.5) async -> (
        avgMb: Double, minMb: Double, maxMb: Double, last: Sample
    ) {
        var totals: [Double] = []
        var last = sample(pid: pid)
        let end = Date().addingTimeInterval(durationS)
        repeat {
            last = sample(pid: pid)
            totals.append(Double(last.totalBytes) / 1_048_576)
            try? await Task.sleep(nanoseconds: UInt64(intervalS * 1_000_000_000))
        } while Date() < end
        let average = totals.reduce(0, +) / Double(max(1, totals.count))
        let round = { (value: Double) in (value * 10).rounded() / 10 }
        return (round(average), round(totals.min() ?? 0), round(totals.max() ?? 0), last)
    }
}
