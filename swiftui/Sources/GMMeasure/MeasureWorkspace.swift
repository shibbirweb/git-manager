// gm-measure --screen workspace: both apps open the docs demo's acme folder, which is not a repository but holds
// storefront (everyday changes) and payments-api (stopped in a merge), so Changes shows a section per repository.
// --screen folders: a workspace of two folders, acme and design-system (a repository itself, so it is active).
// --screen foldermenu and repomenu: the workspace screen with the header's folder or repository menu opened by a
// press (AccessibilityPress), which opens them at the pill's center in both apps.

import Foundation
import MeasureKit

extension Measure {
    static let workspaceScreens = ["workspace", "folders"] + menuScreens
    static let menuScreens = ["foldermenu", "repomenu"]

    /// The acme folder around the demo's storefront repository.
    static func workspaceFolder(_ demoRepo: String) -> String {
        (demoRepo as NSString).deletingLastPathComponent
    }

    /// The workspace folders after the first that `screen` opens.
    static func extraFolders(_ screen: String, demoRepo: String) -> [String] {
        guard screen == "folders" else {
            return []
        }
        let demoDir = ((demoRepo as NSString).deletingLastPathComponent as NSString).deletingLastPathComponent
        return [(demoDir as NSString).appendingPathComponent("design-system")]
    }

    /// Opens the header menu of `screen` by pressing its pill (AccessibilityPress), which both apps answer with the
    /// menu at the pill's center.
    static func openHeaderMenu(_ app: RunningApp, screen: String) async throws {
        WindowCapture.bringToFront(pid: app.pid)
        try AccessibilityPress.press(pid: app.pid, title: screen == "foldermenu" ? "acme" : "payments-api")
        try await Task.sleep(nanoseconds: 1_000_000_000)
    }
}
