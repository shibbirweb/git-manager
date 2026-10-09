// More than one window (src-tauri/src/commands/window.rs window_open and window_focus_owner): New Window, Open
// Folder in New Window and the recent projects in a new window. A folder or workspace another window shows already
// brings that window to the front instead of opening twice (NativeCore WindowOwnership), here or in a new window.
// A new window opens down and right of the one it came from.

import AppKit
import NativeCore
import SwiftUI

/// What a new window opens: folders, a workspace file, or nothing (the welcome screen), and where it goes.
struct WindowRequest: Codable, Hashable {
    var id = UUID()
    var folders: [String] = []
    var workspaceFile: String?
    /// The window's top left on screen (points, y down from the top of the main screen).
    var originX: Double?
    var originY: Double?
}

@MainActor
enum WindowOpener {
    /// SwiftUI's action for the window group, taken from the first window's environment.
    static var action: OpenWindowAction?

    /// Opens `folders` (or `workspaceFile`) in a new window, or focuses the window that shows them already.
    static func openNew(folders: [String] = [], workspaceFile: String? = nil, from context: WindowContext?) {
        if focusOwner(folders: folders, workspaceFile: workspaceFile, except: nil) {
            return
        }
        var request = WindowRequest(folders: folders, workspaceFile: workspaceFile)
        if let window = context?.window, let primary = NSScreen.screens.first {
            let topLeft = CGPoint(x: window.frame.minX, y: primary.frame.maxY - window.frame.maxY)
            let origin = WindowOwnership.cascade(from: topLeft)
            request.originX = origin.x
            request.originY = origin.y
        }
        action?(value: request)
    }

    /// Brings to the front the window, other than `except`, that shows `folders` (or `workspaceFile`); false when
    /// none does, so the caller opens them itself.
    @discardableResult
    static func focusOwner(folders: [String], workspaceFile: String?, except: WindowContext?) -> Bool {
        let wanted = WindowOwnership.Shown(folders: folders.map(canonical), workspaceFile: workspaceFile.map(canonical))
        let others = WindowContext.all.filter { $0 !== except }
        guard let index = WindowOwnership.owner(of: wanted, in: others.map(\.shown)) else {
            return false
        }
        others[index].window?.makeKeyAndOrderFront(nil)
        return true
    }

    /// A path with its symlinks and ".." resolved (paths::real), or as it is when it does not exist.
    static func canonical(_ path: String) -> String {
        URL(fileURLWithPath: path).standardizedFileURL.resolvingSymlinksInPath().path
    }
}

extension WindowContext {
    /// What this window shows, or what it was opened for until its folders are read.
    var shown: WindowOwnership.Shown {
        if workspace.folders.isEmpty, let expected {
            return expected
        }
        return WindowOwnership.Shown(folders: workspace.folders.map { WindowOpener.canonical($0.root) },
                                     workspaceFile: workspace.file.map(WindowOpener.canonical))
    }
}
