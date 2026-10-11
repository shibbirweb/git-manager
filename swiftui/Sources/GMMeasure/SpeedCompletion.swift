// gm-measure speed --case completion: code completion on the docs demo's src/cart.ts (TypeScript, so the language's
// keywords and scope names are asked too). A new line in total() as `measure --screen completion` makes it, then
// each run: "t" typed and timed until the popup shows below the line, "h" timed until the list changes, Escape, and
// the two letters deleted. The popup's band is timed, below the typed line, so the caret stays out of it.

import AppKit
import Foundation
import MeasureKit

@available(macOS 14.0, *)
extension SpeedCases {
    static func completion(_ kind: AppKind, workDir: String, options: Speed.Options) async throws
        -> [Speed.Sample] {
        let demoRepo = try Measure.buildDemo(in: (workDir as NSString).appendingPathComponent("completion-\(kind)"))
        let app = try await launch(kind, folderPath: demoRepo, workDir: workDir, tag: "completion", options: options)
        do {
            try await Measure.openFile(app, filePath: Measure.completionFile)
            try await Task.sleep(nanoseconds: settleNanoseconds)
            WindowCapture.bringToFront(pid: app.pid)
            // Go to Line, the line's end, a new line (Measure.showCompletion's steps without the typing).
            KeyPoster.press(pid: app.pid, keyCode: 37, flags: .maskCommand)
            try await Measure.waitForPrompt(app)
            KeyPoster.type(pid: app.pid, "\(Measure.completionLine)")
            KeyPoster.press(pid: app.pid, keyCode: 36)
            try await Task.sleep(nanoseconds: 600_000_000)
            KeyPoster.press(pid: app.pid, keyCode: 124, flags: .maskCommand)
            KeyPoster.press(pid: app.pid, keyCode: 36)
            try await Task.sleep(nanoseconds: 1_000_000_000)
            let samples = try await completionRuns(app, options: options)
            await app.stop()
            print("\(kind.rawValue): completion done")
            return samples
        } catch {
            await app.stop()
            throw error
        }
    }

    private static func completionRuns(_ app: RunningApp, options: Speed.Options) async throws -> [Speed.Sample] {
        let kind = app.kind
        let id = try windowID(app)
        // Below the centered cursor line: where the popup opens.
        let popup = try await FrameRecorder(windowID: id, region: region(app, 0.27, 0.60, 0.50, 0.68))
        try await Task.sleep(nanoseconds: 500_000_000)
        var firsts: [Double] = [], nexts: [Double] = []
        for _ in 0..<options.repeats {
            firsts.append(popup.now)
            KeyPoster.type(pid: app.pid, "t")
            try await Task.sleep(nanoseconds: 1_000_000_000)
            nexts.append(popup.now)
            KeyPoster.type(pid: app.pid, "h")
            try await Task.sleep(nanoseconds: 1_000_000_000)
            // Escape closes the popup; Delete twice takes the letters back.
            KeyPoster.press(pid: app.pid, keyCode: 53)
            try await Task.sleep(nanoseconds: 300_000_000)
            KeyPoster.press(pid: app.pid, keyCode: 51)
            KeyPoster.press(pid: app.pid, keyCode: 51)
            try await Task.sleep(nanoseconds: 1_200_000_000)
        }
        let frames = await popup.stop()
        let ms = { (value: Double?) in value.map { $0 * 1000 } }
        var samples: [Speed.Sample] = []
        for (first, next) in zip(firsts, nexts) {
            let opened = ResponseTiming(frames: frames.filter { $0.time < first + 0.95 }, inputAt: first)
            samples.append(.init(kind: kind, metric: "completion: popup after the first key", value: ms(opened.first),
                                 changes: opened.changeTimes.map { $0 * 1000 }))
            let narrowed = ResponseTiming(frames: frames.filter { $0.time < next + 0.95 }, inputAt: next)
            samples.append(.init(kind: kind, metric: "completion: list after the next key", value: ms(narrowed.first),
                                 changes: narrowed.changeTimes.map { $0 * 1000 }))
        }
        return samples
    }
}
