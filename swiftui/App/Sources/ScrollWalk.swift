// The control server's `scroll` action: scrolls the window's largest scrollable area down and back up one frame at
// a time, like the current app's scroll_view tool (src/lib/mcp/perf.ts scrollWalk), so gm-measure can sample memory
// while both apps scroll the same way.

import AppKit

@MainActor
final class ScrollWalk {
    struct Result {
        let durationMs: Int
        let frames: Int
        /// Frames that took more than 25 ms, about one and a half frames at 60 Hz.
        let slowFrames: Int
        let scrollHeight: Double
        let clientHeight: Double
    }

    /// The longest a walk may take, as in the current app.
    static let maxMs = 25_000.0

    private let clip: NSClipView
    private let maxScroll: Double
    private let speed: Double
    private let rounds: Int
    private let done: (Result) -> Void
    private var position = 0.0
    private var direction = 1.0
    private var roundsDone = 0
    private var frames = 0
    private var slowFrames = 0
    private var last: Date?
    private let start = Date()
    private var timer: Timer?
    /// Keeps App Nap from slowing the timer while the app is not in front, as a browser keeps animation frames.
    private var activity: NSObjectProtocol?

    private init(clip: NSClipView, maxScroll: Double, speed: Double, rounds: Int, done: @escaping (Result) -> Void) {
        self.clip = clip
        self.maxScroll = maxScroll
        self.speed = speed
        self.rounds = rounds
        self.done = done
    }

    /// Starts a walk on `window`'s largest scroll view; false when nothing there can scroll.
    static func start(in window: NSWindow, speed: Double, rounds: Int, done: @escaping (Result) -> Void) -> Bool {
        guard let scrollView = largestScrollView(in: window.contentView), let document = scrollView.documentView else {
            return false
        }
        let clip = scrollView.contentView
        let walk = ScrollWalk(
            clip: clip, maxScroll: document.frame.height - clip.bounds.height, speed: speed, rounds: rounds, done: done
        )
        walk.scroll(to: 0)
        walk.activity = ProcessInfo.processInfo.beginActivity(
            options: [.userInitiated, .latencyCritical], reason: "Scroll walk for memory sampling"
        )
        let timer = Timer(timeInterval: 1.0 / 60, repeats: true) { _ in
            MainActor.assumeIsolated {
                walk.step()
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        walk.timer = timer
        return true
    }

    private func step() {
        let now = Date()
        if let last, now.timeIntervalSince(last) > 0.025 {
            slowFrames += 1
        }
        last = now
        frames += 1
        position += speed * direction
        if position >= maxScroll {
            position = maxScroll
            direction = -1
        } else if position <= 0 {
            position = 0
            direction = 1
            roundsDone += 1
        }
        scroll(to: position)
        if roundsDone >= rounds || now.timeIntervalSince(start) * 1000 > Self.maxMs {
            finish()
        }
    }

    private func scroll(to offset: Double) {
        clip.scroll(to: NSPoint(x: clip.bounds.origin.x, y: offset))
        clip.enclosingScrollView?.reflectScrolledClipView(clip)
    }

    private func finish() {
        timer?.invalidate()
        timer = nil
        if let activity {
            ProcessInfo.processInfo.endActivity(activity)
        }
        activity = nil
        done(Result(
            durationMs: Int(Date().timeIntervalSince(start) * 1000),
            frames: frames,
            slowFrames: slowFrames,
            scrollHeight: maxScroll + clip.bounds.height,
            clientHeight: clip.bounds.height
        ))
    }

    private static func largestScrollView(in view: NSView?) -> NSScrollView? {
        guard let view else {
            return nil
        }
        var best: (view: NSScrollView, area: Double)?
        var stack = [view]
        while let next = stack.popLast() {
            stack.append(contentsOf: next.subviews)
            guard let scrollView = next as? NSScrollView, let document = scrollView.documentView,
                document.frame.height - scrollView.contentView.bounds.height > 1
            else {
                continue
            }
            let area = Double(scrollView.visibleRect.width * scrollView.visibleRect.height)
            if area > best?.area ?? 0 {
                best = (scrollView, area)
            }
        }
        return best?.view
    }
}
