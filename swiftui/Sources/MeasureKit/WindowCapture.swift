// Captures an app's main window from outside the app, the same way for both apps, so the pixel diff
// compares like with like: the window as the display shows it (LiveWindowCapture), without its shadow, even
// when covered. Needs Screen
// Recording permission for the app that runs gm-measure (the terminal), not for the measured apps.

import AppKit
import CoreGraphics
import Foundation
import ImageIO

public enum WindowCapture {
    /// Height of the macOS title bar both apps draw over their content, in points.
    public static let titleBarPoints = 32

    /// Screenshot rows taken by the title bar on the measuring screen (2 points to the pixel on Retina).
    public static var titleBarRows: Int {
        titleBarPoints * Int(MeasureScreen.scale)
    }

    /// Brings the app with `pid` to the front and waits a moment. macOS pauses drawing in a covered web view, so the
    /// current app must be in front to be captured with its page painted. By process id, never by name, so the
    /// user's own running Git Manager is left alone.
    public static func bringToFront(pid: Int32) {
        NSRunningApplication(processIdentifier: pid)?.activate(options: [.activateAllWindows])
        Thread.sleep(forTimeInterval: 0.8)
    }

    /// True when this process may capture other apps' windows. Without it, macOS is asked to show
    /// the permission request for the app that runs the tool.
    public static func ensureAccess() -> Bool {
        if CGPreflightScreenCaptureAccess() {
            return true
        }
        return CGRequestScreenCaptureAccess()
    }

    /// The largest normal window of `pid` (menu bar extras and panels are smaller).
    public static func mainWindowID(pid: Int32) -> CGWindowID? {
        if let pinned = pinned[pid] {
            return pinned
        }
        return windowList(pid: pid).max { $0.area < $1.area }?.id
    }

    /// A window to capture instead of the largest one, per process (a window a screen opened, such as newwindow's).
    nonisolated(unsafe) public static var pinned: [Int32: CGWindowID] = [:]

    /// Every window of `pid` taller than 100 points, in the window server's order.
    public static func windowIDs(pid: Int32) -> [CGWindowID] {
        windowList(pid: pid).map(\.id)
    }

    private static func windowList(pid: Int32) -> [(id: CGWindowID, area: CGFloat)] {
        let info = CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID)
        let list = info as? [[String: Any]] ?? []
        let windows = list.compactMap { window -> (id: CGWindowID, area: CGFloat)? in
            guard (window[kCGWindowOwnerPID as String] as? Int32) == pid,
                  (window[kCGWindowLayer as String] as? Int) == 0,
                  let id = window[kCGWindowNumber as String] as? CGWindowID,
                  let boundsInfo = window[kCGWindowBounds as String] as? NSDictionary,
                  let bounds = CGRect(dictionaryRepresentation: boundsInfo),
                  bounds.height > 100 else {
                return nil
            }
            return (id, bounds.width * bounds.height)
        }
        return windows
    }

    /// The PNG of the main window of `pid`.
    public static func capture(pid: Int32) throws -> Data {
        // Without the permission macOS still returns an image, just without the window in it.
        guard CGPreflightScreenCaptureAccess() else {
            throw ToolError(
                "No Screen Recording permission. Allow the app that runs gm-measure (your terminal) in System "
                    + "Settings > Privacy & Security > Screen & System Audio Recording, then restart it."
            )
        }
        // A window being redrawn or replaced can fail once; find it again and retry.
        var lastWindowID: CGWindowID?
        for attempt in 0..<5 {
            if attempt > 0 {
                Thread.sleep(forTimeInterval: 0.3)
            }
            guard let windowID = mainWindowID(pid: pid) else {
                continue
            }
            lastWindowID = windowID
            // The live composition (LiveWindowCapture); the older call below only where ScreenCaptureKit is missing.
            if #available(macOS 14.0, *) {
                do {
                    return try pngData(LiveWindowCapture.image(windowID: windowID))
                } catch {
                    FileHandle.standardError.write(Data("ScreenCaptureKit: \(error)\n".utf8))
                    continue
                }
            }
            let options: CGWindowImageOption = [.boundsIgnoreFraming, .bestResolution]
            if let image = CGWindowListCreateImage(.null, .optionIncludingWindow, windowID, options),
               image.width > 1 {
                return try pngData(image)
            }
        }
        let reason = lastWindowID.map { "Could not capture window \($0) of process \(pid)" }
        throw ToolError(reason ?? "No window of process \(pid)")
    }

    /// The image as PNG with its own color profile (the display's), unchanged.
    public static func pngData(_ image: CGImage) throws -> Data {
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, "public.png" as CFString, 1, nil) else {
            throw ToolError("Could not write a PNG")
        }
        CGImageDestinationAddImage(destination, image, nil)
        if !CGImageDestinationFinalize(destination) {
            throw ToolError("Could not write a PNG")
        }
        return output as Data
    }
}
