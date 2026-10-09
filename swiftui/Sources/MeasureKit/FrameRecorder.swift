// Records what a window shows over time, the same way for both apps, to time them from the outside: a
// ScreenCaptureKit stream of the window at up to 120 frames a second, each frame kept only as its arrival time and
// the version of one region it shows: the version goes up when a pixel of the region (every other one) differs from
// the last version by more than `tolerance` levels, so text redrawn one level lighter, which nobody can see, does not
// count as a change. ScreenCaptureKit sends a frame only when the window's pixels changed, so the gaps between frames
// during an animation show dropped frames, and the first and last frames after an input show when the app answered
// and when it settled.

import CoreMedia
import CoreVideo
import Foundation
import ScreenCaptureKit

@available(macOS 14.0, *)
public final class FrameRecorder: NSObject, SCStreamOutput, @unchecked Sendable {
    /// One frame: seconds since the recording started and the version of the region it shows.
    public struct Frame: Sendable {
        public let time: Double
        public let digest: UInt64
    }

    /// The largest channel difference that is not a change (a level or two from redrawn antialiased text).
    public static let tolerance: Int32 = 3

    private let lock = NSLock()
    private var frames: [Frame] = []
    private var stream: SCStream?
    private let started = Date()
    /// The region in window points from the top left.
    private let region: CGRect
    private let scale: CGFloat
    /// Keeps a picture of each changed frame (at most 80) while set, for looking at what changed.
    public var keepImages = false
    private var images: [(time: Double, image: CGImage)] = []
    private var version: UInt64 = 0
    /// The sampled pixels of the last version.
    private var sampled: [UInt32] = []

    /// Starts recording window `windowID`'s `region` (window points from the top left).
    public init(windowID: CGWindowID, region: CGRect) async throws {
        self.region = region
        scale = MeasureScreen.scale
        super.init()
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
        guard let window = content.windows.first(where: { $0.windowID == windowID }) else {
            throw ToolError("ScreenCaptureKit does not list window \(windowID)")
        }
        let configuration = SCStreamConfiguration()
        configuration.width = Int((window.frame.width * scale).rounded())
        configuration.height = Int((window.frame.height * scale).rounded())
        configuration.minimumFrameInterval = CMTime(value: 1, timescale: 120)
        configuration.showsCursor = false
        configuration.queueDepth = 8
        configuration.pixelFormat = kCVPixelFormatType_32BGRA
        let stream = SCStream(filter: SCContentFilter(desktopIndependentWindow: window), configuration: configuration,
                              delegate: nil)
        try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: DispatchQueue(label: "gm-measure.frames"))
        try await stream.startCapture()
        self.stream = stream
    }

    /// Seconds since recording started, on the same clock as the frames.
    public var now: Double {
        Date().timeIntervalSince(started)
    }

    /// Stops and returns the frames, oldest first.
    public func stop() async -> [Frame] {
        try? await stream?.stopCapture()
        stream = nil
        return lock.withLock { frames }
    }

    public func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
                       of type: SCStreamOutputType) {
        guard type == .screen, sampleBuffer.isValid, Self.isComplete(sampleBuffer),
              let pixels = sampleBuffer.imageBuffer else {
            return
        }
        let time = now
        let sample = Self.sample(pixels, region: region, scale: scale)
        let changed = lock.withLock { () -> Bool in
            let changed = Self.differs(sample, sampled)
            if changed {
                version += 1
                sampled = sample
            }
            frames.append(Frame(time: time, digest: version))
            return changed
        }
        if keepImages && changed, let image = Self.image(pixels) {
            lock.withLock {
                if images.count < 80 {
                    images.append((time, image))
                }
            }
        }
    }

    /// The pictures kept with `keepImages`, oldest first.
    public var keptImages: [(time: Double, image: CGImage)] {
        lock.withLock { images }
    }

    private static func image(_ buffer: CVPixelBuffer) -> CGImage? {
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(buffer),
              let space = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(data: base, width: CVPixelBufferGetWidth(buffer),
                                      height: CVPixelBufferGetHeight(buffer), bitsPerComponent: 8,
                                      bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: space,
                                      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
                                          | CGBitmapInfo.byteOrder32Little.rawValue) else {
            return nil
        }
        return context.makeImage()
    }

    /// A frame with new pixels (ScreenCaptureKit also sends idle and blank status frames).
    private static func isComplete(_ sampleBuffer: CMSampleBuffer) -> Bool {
        guard let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false)
            as? [[SCStreamFrameInfo: Any]],
            let raw = attachments.first?[.status] as? Int,
            let status = SCFrameStatus(rawValue: raw) else {
            return false
        }
        return status == .complete
    }

    /// Every other pixel of the region, row by row.
    static func sample(_ buffer: CVPixelBuffer, region: CGRect, scale: CGFloat) -> [UInt32] {
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(buffer) else {
            return []
        }
        let width = CVPixelBufferGetWidth(buffer), height = CVPixelBufferGetHeight(buffer)
        let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
        let x0 = max(0, Int(region.minX * scale)), x1 = min(width, Int(region.maxX * scale))
        let y0 = max(0, Int(region.minY * scale)), y1 = min(height, Int(region.maxY * scale))
        let bytes = base.assumingMemoryBound(to: UInt32.self)
        var pixels: [UInt32] = []
        pixels.reserveCapacity(max(0, (x1 - x0 + 1) / 2 * (y1 - y0 + 1) / 2))
        for y in stride(from: y0, to: y1, by: 2) {
            let row = bytes + y * rowBytes / 4
            for x in stride(from: x0, to: x1, by: 2) {
                pixels.append(row[x])
            }
        }
        return pixels
    }

    /// Whether any pixel's channel moved by more than `tolerance` (a first frame always differs).
    static func differs(_ new: [UInt32], _ old: [UInt32]) -> Bool {
        guard new.count == old.count else {
            return true
        }
        for index in new.indices where new[index] != old[index] {
            let a = new[index], b = old[index]
            for shift: UInt32 in [0, 8, 16, 24] {
                let delta = Int32((a >> shift) & 0xFF) - Int32((b >> shift) & 0xFF)
                if abs(delta) > tolerance {
                    return true
                }
            }
        }
        return false
    }
}

/// What a recording says about one input: when the region first changed after it and when it last changed.
@available(macOS 14.0, *)
public struct ResponseTiming: Sendable {
    /// Seconds from the input to the first changed frame, nil when nothing changed.
    public let first: Double?
    /// Seconds from the input to the last changed frame (the region settled then).
    public let settled: Double?
    /// Changed frames after the input.
    public let changes: Int
    /// When each changed frame came, in seconds after the input.
    public let changeTimes: [Double]

    public init(frames: [FrameRecorder.Frame], inputAt: Double) {
        let before = frames.last { $0.time <= inputAt }?.digest
        var previous = before
        var changedTimes: [Double] = []
        for frame in frames where frame.time > inputAt {
            if frame.digest != previous {
                changedTimes.append(frame.time - inputAt)
            }
            previous = frame.digest
        }
        first = changedTimes.first
        settled = changedTimes.last
        changes = changedTimes.count
        changeTimes = changedTimes
    }
}

/// Frame pacing while something moves: the gaps between changed frames inside a span.
@available(macOS 14.0, *)
public struct FramePacing: Sendable {
    public let frames: Int
    /// Gaps in milliseconds, sorted.
    public let gaps: [Double]

    public init(frames: [FrameRecorder.Frame], from start: Double, to end: Double) {
        var times: [Double] = []
        var previous: UInt64?
        for frame in frames where frame.time >= start && frame.time <= end {
            if frame.digest != previous {
                times.append(frame.time)
            }
            previous = frame.digest
        }
        self.frames = times.count
        gaps = zip(times.dropFirst(), times).map { ($0 - $1) * 1000 }.sorted()
    }

    /// The gap below which `share` of the gaps fall (0.5 the median, 0.95 the 95th percentile).
    public func gap(at share: Double) -> Double? {
        guard !gaps.isEmpty else {
            return nil
        }
        return gaps[min(gaps.count - 1, Int(Double(gaps.count - 1) * share))]
    }
}
