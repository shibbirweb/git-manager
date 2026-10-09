// gm-measure --screen workspace: both apps open the docs demo's acme folder, which is not a repository but holds
// storefront (everyday changes) and payments-api (stopped in a merge), so Changes shows a section per repository.
// --screen folders: a workspace of two folders, acme and design-system (a repository itself, so it is active).
// --screen cleanrepos: the folders screen with payments-api and design-system made clean (in the throwaway copy),
// so Changes shows storefront, then the clean ones under "No Changes", design-system active. (demo/extras would
// stop the current app with its Git LFS dialog.)
// --screen norepo: acme/notes, a plain folder: Changes offers to initialize a repository.
// --screen foldermenu, repomenu and branchmenu: the workspace screen with the header's folder, repository or branch
// menu opened by a press (AccessibilityPress), which opens them where WebKit clicks in both apps.

import Foundation
import MeasureKit

extension Measure {
    static let workspaceScreens = ["workspace", "folders", "cleanrepos", "norepo"] + menuScreens
    static let menuScreens = ["foldermenu", "repomenu", "branchmenu"]
    /// The title of the pill each menu screen presses.
    static let menuPills = ["foldermenu": "acme", "repomenu": "payments-api", "branchmenu": "main"]

    /// The folder a screen opens: the demo's storefront repository or the acme folder around it; cleanrepos first
    /// makes payments-api (its merge too) and design-system clean in the throwaway copy.
    static func screenFolder(_ screen: String, demoRepo: String) throws -> String {
        guard workspaceScreens.contains(screen) else {
            return demoRepo
        }
        if screen == "cleanrepos" {
            let payments = (workspaceFolder(demoRepo) as NSString).appendingPathComponent("payments-api")
            for repo in [payments] + extraFolders(screen, demoRepo: demoRepo) {
                for arguments in [["reset", "-q", "--hard"], ["clean", "-q", "-f", "-d"]] {
                    let done = try AppLauncher.run("/usr/bin/git", ["-C", repo] + arguments)
                    if done.status != 0 {
                        throw ToolError("Could not make \(repo) clean:\n\(done.output)")
                    }
                }
            }
        }
        if screen == "norepo" {
            return (workspaceFolder(demoRepo) as NSString).appendingPathComponent("notes")
        }
        return workspaceFolder(demoRepo)
    }

    /// The acme folder around the demo's storefront repository.
    static func workspaceFolder(_ demoRepo: String) -> String {
        (demoRepo as NSString).deletingLastPathComponent
    }

    /// The workspace folders after the first that `screen` opens.
    static func extraFolders(_ screen: String, demoRepo: String) -> [String] {
        guard screen == "folders" || screen == "cleanrepos" else {
            return []
        }
        let demoDir = ((demoRepo as NSString).deletingLastPathComponent as NSString).deletingLastPathComponent
        return [(demoDir as NSString).appendingPathComponent("design-system")]
    }

    /// Opens the header menu of `screen` by pressing its pill (AccessibilityPress), which both apps answer with the
    /// menu at the pill's center.
    static func openHeaderMenu(_ app: RunningApp, screen: String) async throws {
        WindowCapture.bringToFront(pid: app.pid)
        try AccessibilityPress.press(pid: app.pid, title: menuPills[screen] ?? screen)
        try await Task.sleep(nanoseconds: 1_000_000_000)
    }
}
