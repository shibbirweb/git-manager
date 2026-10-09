// The screen both apps are measured on: the built-in display, so the user can keep working on another one, and
// every score stays comparable (all floors were taken there, at 2 pixels to the point). Falls back to the main
// screen on a Mac without one.

import AppKit
import CoreGraphics

public enum MeasureScreen {
    public static var screen: NSScreen? {
        NSScreen.screens.first { screen in
            let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber
            return number.map { CGDisplayIsBuiltin(CGDirectDisplayID($0.uint32Value)) != 0 } ?? false
        } ?? NSScreen.main ?? NSScreen.screens.first
    }

    public static var scale: CGFloat {
        screen?.backingScaleFactor ?? 2
    }

    /// A window of `size` points centered in the screen's visible area, as x and y from the top left of the screen
    /// with the menu bar (the coordinates Tauri saves window bounds in), with `cocoaFrame` as AppKit places it.
    public static func centered(_ size: CGSize) -> (topLeft: CGPoint, cocoaFrame: CGRect)? {
        guard let screen, let primary = NSScreen.screens.first else {
            return nil
        }
        let visible = screen.visibleFrame
        let x = (visible.minX + max(0, (visible.width - size.width) / 2)).rounded()
        let y = (visible.minY + max(0, (visible.height - size.height) / 2)).rounded()
        let frame = CGRect(x: x, y: y, width: size.width, height: size.height)
        return (CGPoint(x: x, y: primary.frame.maxY - frame.maxY), frame)
    }
}
