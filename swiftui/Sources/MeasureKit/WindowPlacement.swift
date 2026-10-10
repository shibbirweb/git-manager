// Keeps measured windows on the measuring screen (MeasureScreen: the built-in display). Both apps are told where to
// open (the current app's saved session, the native app's -windowFrame), but a window can still land elsewhere (a
// display change, an app that ignores its saved place); then it is moved and sized through Accessibility, by the
// app's process, without touching the pointer.

import AppKit
import ApplicationServices

public enum WindowPlacement {
    /// Moves `pid`'s main window to the measuring screen, centered at the measuring size, when it is not there.
    /// Returns true when the window was moved.
    @discardableResult
    public static func ensureOnMeasureScreen(pid: Int32, size: CGSize) -> Bool {
        guard let target = MeasureScreen.centered(size), let screen = MeasureScreen.screen,
              let primary = NSScreen.screens.first,
              let windowID = WindowCapture.mainWindowID(pid: pid),
              let info = CGWindowListCopyWindowInfo(.optionIncludingWindow, windowID) as? [[String: Any]],
              let boundsInfo = info.first?[kCGWindowBounds as String] as? NSDictionary,
              let bounds = CGRect(dictionaryRepresentation: boundsInfo) else {
            return false
        }
        // The screen in the same top-left coordinates as the window list.
        let frame = screen.frame
        let screenTopLeft = CGRect(x: frame.minX, y: primary.frame.maxY - frame.maxY, width: frame.width,
                                   height: frame.height)
        if screenTopLeft.contains(bounds) {
            return false
        }
        let app = AXUIElementCreateApplication(pid)
        var value: AnyObject?
        AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &value)
        guard let window = (value as? [AXUIElement])?.first else {
            return false
        }
        var origin = target.topLeft
        var sizeValue = size
        if let position = AXValueCreate(.cgPoint, &origin) {
            AXUIElementSetAttributeValue(window, kAXPositionAttribute as CFString, position)
        }
        if let sized = AXValueCreate(.cgSize, &sizeValue) {
            AXUIElementSetAttributeValue(window, kAXSizeAttribute as CFString, sized)
        }
        return true
    }
}
