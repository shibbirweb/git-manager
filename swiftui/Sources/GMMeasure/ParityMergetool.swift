// A parity scenario with a `mergetool` run spec: the app starts as git mergetool on that conflicted file of the
// scenario's folder (MeasureMerge.swift says why the merge tool is reached this way), settles, and is captured and
// sampled from outside, as the current app runs no control server in that mode.

import Foundation
import MeasureKit

enum ParityMergetool {
    struct Result {
        var version: String?
        var memoryMb: Double?
        var screenshotPath: String?
        var headroom: Double?
    }

    static func run(
        _ kind: AppKind, filePath: String, repoPath: String, home: String, appPath: String, mode: String,
        shotPath: String, settleS: Int, sampleS: Int, gate: Display.Gate, moment: String
    ) async throws -> Result {
        let folder = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-parity-mergetool")
        try? FileManager.default.removeItem(atPath: folder)
        let files = try MergetoolFileSet.extract(repoPath: repoPath, filePath: filePath, into: folder)
        let app = try await AppLauncher.launchMergetool(kind: kind, home: home, appPath: appPath, mode: mode,
                                                        files: files)
        defer {
            try? FileManager.default.removeItem(atPath: folder)
        }
        do {
            var result = Result()
            let info = try await app.client?.call("get_app_info").structured ?? [:]
            result.version = (info["version"] ?? info["appVersion"]).map { "\($0)" }
            try await Task.sleep(nanoseconds: UInt64(settleS) * 1_000_000_000)
            result.headroom = try await gate.require(moment)?.headroom
            WindowCapture.bringToFront(pid: app.pid)
            let png = try WindowCapture.capture(pid: app.pid)
            try png.write(to: URL(fileURLWithPath: shotPath))
            result.screenshotPath = shotPath
            if sampleS > 0 {
                result.memoryMb = await ExternalMemory.measure(pid: app.pid, durationS: Double(sampleS)).avgMb
            }
            await app.stop()
            return result
        } catch {
            await app.stop()
            throw error
        }
    }
}
