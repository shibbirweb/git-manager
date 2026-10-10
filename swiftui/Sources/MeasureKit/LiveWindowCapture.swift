// A window as the display shows it, through ScreenCaptureKit. CGWindowListCreateImage composites the window again on
// its own, and on a display without HDR headroom it often lands one step off on some of the window's surfaces: the
// ones in another color space than the display's (the title bar, a web view's composited layers such as the
// current app's right diff editor once the merge view scrolls) and translucent layers (code text). Which result
// comes back changes from call to call, so the same window scored 99.2% in one run and 85.5% in the next.
// ScreenCaptureKit returns the pixels of the live composition every time (measured 2026-10-08, GM-50).

import AppKit
import CoreGraphics
import Foundation
import ScreenCaptureKit

@available(macOS 14.0, *)
enum LiveWindowCapture {
    /// The window with `windowID` as an image in the display's color space, at the screen's scale.
    static func image(windowID: CGWindowID, timeout: TimeInterval = 10) throws -> CGImage {
        let content = try wait(timeout) { done in
            SCShareableContent.getExcludingDesktopWindows(false, onScreenWindowsOnly: false) { content, error in
                done(content, error)
            }
        }
        guard let window = content.windows.first(where: { $0.windowID == windowID }) else {
            throw ToolError("ScreenCaptureKit does not list window \(windowID)")
        }
        let scale = MeasureScreen.scale
        let configuration = SCStreamConfiguration()
        configuration.width = Int((window.frame.width * scale).rounded())
        configuration.height = Int((window.frame.height * scale).rounded())
        configuration.showsCursor = false
        configuration.ignoreShadowsSingleWindow = true
        let filter = SCContentFilter(desktopIndependentWindow: window)
        return try wait(timeout) { done in
            SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration) { image, error in
                done(image, error)
            }
        }
    }

    /// Runs a completion-handler call and waits for its value; the handlers run on ScreenCaptureKit's own queue.
    private static func wait<Value>(
        _ timeout: TimeInterval, _ start: (@escaping (Value?, Error?) -> Void) -> Void
    ) throws -> Value {
        let finished = DispatchSemaphore(value: 0)
        let box = ResultBox<Value>()
        start { value, error in
            box.value = value
            box.error = error
            finished.signal()
        }
        if finished.wait(timeout: .now() + timeout) == .timedOut {
            throw ToolError("ScreenCaptureKit did not answer within \(Int(timeout)) s")
        }
        guard let value = box.value else {
            throw box.error ?? ToolError("ScreenCaptureKit returned nothing")
        }
        return value
    }
}

private final class ResultBox<Value>: @unchecked Sendable {
    var value: Value?
    var error: Error?
}
