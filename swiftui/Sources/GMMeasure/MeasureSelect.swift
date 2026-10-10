// gm-measure --screen committarget: the workspace screen with the commit box's "Commit to" select opened by a press
// (AccessibilityPress on "Repository to commit to"). The list is an AppKit menu in both apps (WebKit's select popup,
// the native SelectMenu), a window of its own: it is captured too (<app>-menu.png) and compared after the run, with
// its place relative to the main window.

import Foundation
import MeasureKit

extension Measure {
    static let selectScreens = ["committarget"]
    static let selectLabels = ["committarget": "Repository to commit to"]

    /// Presses the select once; a second press would close its menu.
    static func openSelect(_ app: RunningApp, screen: String) async throws {
        try await Task.sleep(nanoseconds: 1_500_000_000)
        WindowCapture.bringToFront(pid: app.pid)
        try AccessibilityPress.press(pid: app.pid, title: selectLabels[screen] ?? screen)
        try await Task.sleep(nanoseconds: 1_000_000_000)
    }

    /// Saves the open menu as <app>-menu.png and its frame as <app>-menu.json.
    static func saveMenu(_ app: RunningApp, outDir: String) {
        do {
            guard let menu = try MenuCapture.capture(pid: app.pid) else {
                print("\(app.kind.rawValue): no menu open")
                return
            }
            let base = (outDir as NSString).appendingPathComponent("\(app.kind.rawValue)-menu")
            try menu.png.write(to: URL(fileURLWithPath: base + ".png"))
            let frame = ["x": menu.frame.minX, "y": menu.frame.minY, "width": menu.frame.width,
                         "height": menu.frame.height]
            let data = try JSONSerialization.data(withJSONObject: frame, options: [.sortedKeys])
            try data.write(to: URL(fileURLWithPath: base + ".json"))
            print("\(app.kind.rawValue): menu at \(menu.frame)")
        } catch {
            print("\(app.kind.rawValue): no menu capture (\(error))")
        }
    }

    /// Compares the two menus (menu-diff.png) and says how far apart they open.
    static func compareMenus(outDir: String) throws {
        let path = { (name: String) in (outDir as NSString).appendingPathComponent(name) }
        guard FileManager.default.fileExists(atPath: path("current-menu.png")),
              FileManager.default.fileExists(atPath: path("native-menu.png")) else {
            print("Menu diff: needs both menus.")
            return
        }
        let result = diffImages(try RGBAImage.load(path: path("current-menu.png")),
                                try RGBAImage.load(path: path("native-menu.png")))
        try result.overlay.write(path: path("menu-diff.png"))
        let frames = try ["current", "native"].map { kind -> [String: Double] in
            let data = try Data(contentsOf: URL(fileURLWithPath: path("\(kind)-menu.json")))
            return (try JSONSerialization.jsonObject(with: data) as? [String: Double]) ?? [:]
        }
        let delta = ["x", "y", "width", "height"].map { key in
            "\(key) \((frames[1][key] ?? 0) - (frames[0][key] ?? 0))"
        }
        print("Menu diff: \(Diff.describe(result, tolerance: 0)). Native minus current: "
            + delta.joined(separator: ", ") + ". Overlay: menu-diff.png.")
    }
}
