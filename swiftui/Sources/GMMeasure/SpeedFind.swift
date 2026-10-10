// gm-measure speed --case find: the editor's find bar on MemoryBench's --lines line file ("stock" is in every
// method, so the query has hundreds of matches). Each run: Cmd+F timed until the bar shows, the query typed key by
// key timed from the first key until the matches show and from the last key until the code settles, then Cmd+G
// (find next) a few times, each timed until the code changes, and Escape. The code is timed below the bar, so the
// field's blinking caret and the counter stay out of it.

import AppKit
import Foundation
import MeasureKit

@available(macOS 14.0, *)
extension SpeedCases {
    static let findQuery = "stock"

    static func find(_ kind: AppKind, repoPath: String, workDir: String, options: Speed.Options) async throws
        -> [Speed.Sample] {
        let app = try await launch(kind, folderPath: repoPath, workDir: workDir, tag: "find", options: options)
        do {
            try await Measure.openFile(app, filePath: MemoryBench.fileName)
            let samples = try await findRuns(app, options: options)
            await app.stop()
            print("\(kind.rawValue): find done")
            return samples
        } catch {
            await app.stop()
            throw error
        }
    }

    private static func findRuns(_ app: RunningApp, options: Speed.Options) async throws -> [Speed.Sample] {
        let kind = app.kind
        try await Task.sleep(nanoseconds: settleNanoseconds)
        WindowCapture.bringToFront(pid: app.pid)
        let id = try windowID(app)
        // The editor column from the tab strip down (the bar opening), and its code under the replace row's place.
        let editor = try await FrameRecorder(windowID: id, region: region(app, 0.23, 0.12, 0.76, 0.95))
        let code = try await FrameRecorder(windowID: id, region: region(app, 0.23, 0.24, 0.76, 0.95))
        try await Task.sleep(nanoseconds: 500_000_000)
        var opens: [Double] = [], typed: [(first: Double, last: Double)] = [], nexts: [Double] = []
        for _ in 0..<options.repeats {
            opens.append(editor.now)
            // F with Cmd.
            KeyPoster.press(pid: app.pid, keyCode: 3, flags: .maskCommand)
            try await Task.sleep(nanoseconds: 1_500_000_000)
            let first = code.now
            KeyPoster.type(pid: app.pid, findQuery, interval: 0.03)
            typed.append((first, code.now))
            try await Task.sleep(nanoseconds: 2_000_000_000)
            for _ in 0..<3 {
                nexts.append(code.now)
                // G with Cmd.
                KeyPoster.press(pid: app.pid, keyCode: 5, flags: .maskCommand)
                try await Task.sleep(nanoseconds: 1_000_000_000)
            }
            // Escape closes the bar.
            KeyPoster.press(pid: app.pid, keyCode: 53)
            try await Task.sleep(nanoseconds: 1_500_000_000)
        }
        let editorFrames = await editor.stop(), codeFrames = await code.stop()
        let ms = { (value: Double?) in value.map { $0 * 1000 } }
        var samples: [Speed.Sample] = []
        for open in opens {
            let timing = ResponseTiming(frames: editorFrames.filter { $0.time < open + 1.4 }, inputAt: open)
            samples.append(.init(kind: kind, metric: "find: bar on screen after Cmd+F", value: ms(timing.first),
                                 changes: timing.changeTimes.map { $0 * 1000 }))
        }
        for input in typed {
            let span = codeFrames.filter { $0.time < input.last + 1.9 }
            let first = ResponseTiming(frames: span, inputAt: input.first)
            let last = ResponseTiming(frames: span, inputAt: input.last)
            samples.append(.init(kind: kind, metric: "find: matches after the first key", value: ms(first.first),
                                 changes: first.changeTimes.map { $0 * 1000 }))
            samples.append(.init(kind: kind, metric: "find: code settled after the last key", value: ms(last.settled),
                                 changes: last.changeTimes.map { $0 * 1000 }))
        }
        for next in nexts {
            let timing = ResponseTiming(frames: codeFrames.filter { $0.time < next + 0.9 }, inputAt: next)
            samples.append(.init(kind: kind, metric: "find: next match after Cmd+G", value: ms(timing.first),
                                 changes: timing.changeTimes.map { $0 * 1000 }))
        }
        return samples
    }
}
