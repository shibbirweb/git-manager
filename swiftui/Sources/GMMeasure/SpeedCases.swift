// gm-measure speed's cases (Speed.swift): each app started isolated on the case's repository like `measure` does,
// then timed with a FrameRecorder over the part of the window that answers.

import AppKit
import Foundation
import MeasureKit

@available(macOS 14.0, *)
enum SpeedCases {
    /// How long each app is left alone after it is ready, before anything is timed.
    static let settleNanoseconds: UInt64 = 6_000_000_000

    /// Find in Files: the query typed key by key, timed from the first key and from the last.
    static func search(_ kind: AppKind, repoPath: String, workDir: String, options: Speed.Options) async throws
        -> [Speed.Sample] {
        let app = try await launch(kind, folderPath: repoPath, workDir: workDir, tag: "search", options: options)
        do {
            let samples = try await searchRuns(app, options: options)
            await app.stop()
            return samples
        } catch {
            await app.stop()
            throw error
        }
    }

    private static func searchRuns(_ app: RunningApp, options: Speed.Options) async throws -> [Speed.Sample] {
        let kind = app.kind
        try await Task.sleep(nanoseconds: settleNanoseconds)
        WindowCapture.bringToFront(pid: app.pid)
        KeyPoster.press(pid: app.pid, keyCode: 3, flags: [.maskShift, .maskCommand])
        try await Task.sleep(nanoseconds: 1_500_000_000)
        // The results under the query field; the field's blinking caret stays out of it.
        let recorder = try await FrameRecorder(windowID: try windowID(app), region: region(app, 0.15, 0.3, 0.85, 0.93))
        try await Task.sleep(nanoseconds: 500_000_000)
        var inputs: [(first: Double, last: Double)] = []
        for run in 0..<options.repeats {
            // The second run's frames are kept as pictures (build/speed/<time>/frames-<app>/).
            recorder.keepImages = options.frames && run == 1
            let first = recorder.now
            KeyPoster.type(pid: app.pid, MemorySearch.query, interval: 0.03)
            inputs.append((first, recorder.now))
            try await Task.sleep(nanoseconds: 4_000_000_000)
            KeyPoster.press(pid: app.pid, keyCode: 0, flags: .maskCommand)
            KeyPoster.press(pid: app.pid, keyCode: 51)
            try await Task.sleep(nanoseconds: 2_500_000_000)
        }
        let frames = await recorder.stop()
        if options.frames, inputs.count > 1 {
            try saveFrames(recorder.keptImages, since: inputs[1].first, kind: kind, options: options)
        }
        var samples: [Speed.Sample] = try await echo(app)
        for input in inputs {
            let span = frames.filter { $0.time < input.last + 4 }
            let first = ResponseTiming(frames: span, inputAt: input.first)
            samples.append(.init(kind: kind, metric: "search: first results after the first key",
                                 value: first.first.map { $0 * 1000 }, changes: first.changeTimes.map { $0 * 1000 }))
            let settled = ResponseTiming(frames: span, inputAt: input.last)
            samples.append(.init(kind: kind, metric: "search: results settled after the last key",
                                 value: settled.settled.map { $0 * 1000 },
                                 changes: settled.changeTimes.map { $0 * 1000 }))
        }
        print("\(kind.rawValue): search done")
        return samples
    }

    /// Input to screen: single keys typed slowly into the search field, each timed until the field shows it.
    private static func echo(_ app: RunningApp) async throws -> [Speed.Sample] {
        // The field: the popup's query row, 12% of the window down plus the tab strip, its text part only.
        let recorder = try await FrameRecorder(windowID: try windowID(app), region: region(app, 0.27, 0.19, 0.6, 0.23))
        try await Task.sleep(nanoseconds: 300_000_000)
        var samples: [Speed.Sample] = []
        for character in "abcdefgh" {
            let typed = recorder.now
            KeyPoster.type(pid: app.pid, String(character), interval: 0)
            try await Task.sleep(nanoseconds: 250_000_000)
            samples.append(.init(kind: app.kind, metric: "echo: a typed key on screen", value: nil))
            samples[samples.count - 1] = .init(kind: app.kind, metric: "echo: a typed key on screen",
                                               value: Double(typed))
        }
        let frames = await recorder.stop()
        let echoes = samples.map { sample -> Speed.Sample in
            let typed = sample.value ?? 0
            let timing = ResponseTiming(frames: frames.filter { $0.time < typed + 0.25 }, inputAt: typed)
            return .init(kind: app.kind, metric: sample.metric, value: timing.first.map { $0 * 1000 })
        }
        KeyPoster.press(pid: app.pid, keyCode: 0, flags: .maskCommand)
        KeyPoster.press(pid: app.pid, keyCode: 51)
        try await Task.sleep(nanoseconds: 1_000_000_000)
        return echoes
    }

    private static func saveFrames(_ images: [(time: Double, image: CGImage)], since start: Double, kind: AppKind,
                                   options: Speed.Options) throws {
        let folder = (options.outDir as NSString).appendingPathComponent("frames-\(kind.rawValue)")
        try FileManager.default.createDirectory(atPath: folder, withIntermediateDirectories: true)
        for (time, image) in images where time >= start {
            let name = String(format: "%04d.png", Int((time - start) * 1000))
            let data = try WindowCapture.pngData(image)
            try data.write(to: URL(fileURLWithPath: (folder as NSString).appendingPathComponent(name)))
        }
    }

    /// A cold diff per launch, timed until the editor area settles; then the scroll walk's frames in it.
    static func diff(_ kind: AppKind, repoPath: String, workDir: String, options: Speed.Options) async throws
        -> [Speed.Sample] {
        var samples: [Speed.Sample] = []
        for run in 0..<options.repeats {
            let app = try await launch(kind, folderPath: repoPath, workDir: workDir, tag: "diff\(run)",
                                       options: options)
            do {
                samples += try await diffOnce(app, options: options, scroll: run == 0)
            } catch {
                await app.stop()
                throw error
            }
            await app.stop()
        }
        print("\(kind.rawValue): diff done")
        return samples
    }

    private static func diffOnce(_ app: RunningApp, options: Speed.Options, scroll: Bool) async throws
        -> [Speed.Sample] {
        // Both apps settle first: a few seconds after any launch macOS still does one-off work in the process (a
        // LaunchServices clean-up holding the Objective-C runtime lock once blocked the native app's main thread).
        try await Task.sleep(nanoseconds: settleNanoseconds)
        WindowCapture.bringToFront(pid: app.pid)
        var repoRoot = ""
        if app.kind == .current {
            let state = try await app.client.call("get_app_state").structured ?? [:]
            repoRoot = (state["activeRepository"] as? [String: Any])?["root"] as? String ?? ""
        }
        let recorder = try await FrameRecorder(windowID: try windowID(app), region: region(app, 0.25, 0.12, 0.8, 0.9))
        recorder.keepImages = options.frames && scroll
        try await Task.sleep(nanoseconds: 500_000_000)
        let asked = recorder.now
        let shown = app.kind == .current
            ? try await app.client.call("show_changes_diff",
                                        ["repoPath": repoRoot, "filePath": MemoryBench.fileName, "staged": false])
            : try await app.client.call("app", ["action": "show_diff", "filePath": MemoryBench.fileName,
                                                "staged": false])
        if shown.isError {
            throw ToolError("\(app.kind.rawValue): no diff: \(shown.text)")
        }
        try await Task.sleep(nanoseconds: 4_000_000_000)
        var walk: (start: Double, end: Double)?
        if options.cases.contains("scroll") && scroll {
            let start = recorder.now
            _ = try await MemoryBench.scroll(app, speed: options.speed)
            walk = (start, recorder.now)
        }
        let frames = await recorder.stop()
        if options.frames && scroll {
            try saveFrames(recorder.keptImages.filter { $0.time < asked + 4 }, since: asked, kind: app.kind,
                           options: options)
        }
        let timing = ResponseTiming(frames: frames.filter { $0.time < asked + 4 }, inputAt: asked)
        var samples: [Speed.Sample] = []
        if options.cases.contains("diff") {
            samples.append(.init(kind: app.kind, metric: "diff: first change after asking",
                                 value: timing.first.map { $0 * 1000 }))
            // The code itself: the current app first shows its tab over an empty editor.
            samples.append(.init(kind: app.kind, metric: "diff: code on screen",
                                 value: timing.inked.map { $0 * 1000 }))
            samples.append(.init(kind: app.kind, metric: "diff: settled (colors in)",
                                 value: timing.settled.map { $0 * 1000 }))
        }
        if let walk {
            let pacing = FramePacing(frames: frames, from: walk.start, to: walk.end)
            let seconds = walk.end - walk.start
            samples.append(.init(kind: app.kind, metric: "scroll: frames a second",
                                 value: seconds > 0 ? Double(pacing.frames) / seconds : nil))
            samples.append(.init(kind: app.kind, metric: "scroll: median gap", value: pacing.gap(at: 0.5)))
            samples.append(.init(kind: app.kind, metric: "scroll: 95th percentile gap", value: pacing.gap(at: 0.95)))
        }
        return samples
    }

    /// Starts `kind` isolated on `folderPath` in the run's mode, as `measure` does.
    private static func launch(_ kind: AppKind, folderPath: String, workDir: String, tag: String,
                               options: Speed.Options) async throws -> RunningApp {
        let appPath = AppLauncher.defaultAppPath(kind, swiftuiDir: swiftuiDir)
        let home = (workDir as NSString).appendingPathComponent("\(tag)-\(kind.rawValue)-home")
        let settings = Measure.colorThemeSettings(mode: options.mode, themeID: nil)
        if kind == .native {
            try Measure.writeNativeSettings(home: home, values: settings)
            try Measure.writeNativeDiffPrefs(home: home, collapse: true)
        }
        print("\(kind.rawValue): starting for \(tag)")
        return try await AppLauncher.launch(kind: kind, home: home, folderPath: folderPath, appPath: appPath,
                                            settings: kind == .current ? settings : [:], mode: options.mode)
    }

    private static func windowID(_ app: RunningApp) throws -> CGWindowID {
        guard let windowID = WindowCapture.mainWindowID(pid: app.pid) else {
            throw ToolError("\(app.kind.rawValue): no window")
        }
        return windowID
    }

    /// A part of the window given as fractions of its size, in window points.
    private static func region(_ app: RunningApp, _ left: CGFloat, _ top: CGFloat, _ right: CGFloat,
                               _ bottom: CGFloat) -> CGRect {
        let size = AppLauncher.windowSize
        return CGRect(x: size.width * left, y: size.height * top, width: size.width * (right - left),
                      height: size.height * (bottom - top))
    }
}
