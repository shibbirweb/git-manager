// An app's open AppKit menu (a <select>'s list in WebKit, an NSMenu in the native app): its own window on the pop-up
// menu level, outside the main window's capture. Captured the same way (LiveWindowCapture), with its place relative
// to the main window, so both apps' menus can be compared and their offsets checked.

import AppKit
import CoreGraphics
import Foundation

public enum MenuCapture {
    public struct Menu {
        public let png: Data
        /// The menu's frame in points, relative to the main window's top left corner.
        public let frame: CGRect
    }

    /// The open menu of `pid`, or nil when it has none.
    public static func capture(pid: Int32) throws -> Menu? {
        let windows = list(pid: pid)
        guard let menu = windows.first(where: { $0.layer == Int(CGWindowLevelForKey(.popUpMenuWindow)) }),
              let mainID = WindowCapture.mainWindowID(pid: pid),
              let main = windows.first(where: { $0.id == mainID }) else {
            return nil
        }
        guard #available(macOS 14.0, *) else {
            throw ToolError("Capturing a menu needs ScreenCaptureKit (macOS 14)")
        }
        let image = try LiveWindowCapture.menuImage(windowID: menu.id)
        let frame = menu.bounds.offsetBy(dx: -main.bounds.minX, dy: -main.bounds.minY)
        return Menu(png: try WindowCapture.pngData(image), frame: frame)
    }

    private static func list(pid: Int32) -> [(id: CGWindowID, layer: Int, bounds: CGRect)] {
        let info = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
        return (info as? [[String: Any]] ?? []).compactMap { window in
            guard (window[kCGWindowOwnerPID as String] as? Int32) == pid,
                  let id = window[kCGWindowNumber as String] as? CGWindowID,
                  let layer = window[kCGWindowLayer as String] as? Int,
                  let boundsInfo = window[kCGWindowBounds as String] as? NSDictionary,
                  let bounds = CGRect(dictionaryRepresentation: boundsInfo) else {
                return nil
            }
            return (id, layer, bounds)
        }
    }
}
