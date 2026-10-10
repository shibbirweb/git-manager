// The window session (src-tauri/src/commands/window.rs save_session and restore_at_start): every window's folders
// and frame are written to state.json when a window shows another workspace, moves, resizes or closes, and at quit
// (where every window stays); the last window closed is kept, so the next start brings it back. At start, unless
// the app was started on a folder or as git mergetool, the windows of the last session open again
// (NativeCore WindowSession).

import AppKit
import NativeCore

@MainActor
enum WindowSessionKeeper {
    /// Set at quit: the windows closing then stay in the session.
    private static var quitting = false
    private static var lastClosed: WindowSession.Entry?
    private static var pending: DispatchWorkItem?
    /// The windows of the last session after the first, opened once the first window is on screen.
    private static var restoring: [WindowSession.Entry] = []

    /// The first window's start when the app was started on nothing: the last session's first window; the others
    /// open after it (openRestored).
    static func startPlan() -> WindowRequest? {
        guard MergetoolFiles.fromLaunch() == nil else {
            return nil
        }
        let plan = WindowSession.plan(
            RecentProjectsStore.shared.savedSession,
            reopenWindows: SettingsStore.shared.storedBool(WindowSession.reopenSetting, default: true),
            launchedOnFolder: false
        )
        guard let first = plan.first else {
            return nil
        }
        restoring = Array(plan.dropFirst())
        return request(first)
    }

    /// Opens the rest of the last session, each window where it was when that place is still on a screen.
    static func openRestored() {
        let entries = restoring
        restoring = []
        for entry in entries {
            WindowOpener.action?(value: request(entry))
        }
    }

    private static func request(_ entry: WindowSession.Entry) -> WindowRequest {
        var request = WindowRequest(folders: entry.folders, workspaceFile: entry.workspaceFile)
        if let bounds = entry.bounds {
            request.width = bounds.width
            request.height = bounds.height
            if WindowSession.onScreen(bounds, screens: screenRects()) {
                request.originX = bounds.minX
                request.originY = bounds.minY
            }
        }
        return request
    }

    /// Saves a moment later: a moved window reports many times a second.
    static func saveSoon() {
        pending?.cancel()
        let work = DispatchWorkItem {
            MainActor.assumeIsolated {
                save()
            }
        }
        pending = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }

    static func save() {
        guard !quitting, !WindowContext.all.contains(where: { $0.merge.mergetool != nil }) else {
            return
        }
        var entries = WindowContext.all.filter { $0.window != nil }.map(entry)
        if entries.isEmpty, let lastClosed {
            entries = [lastClosed]
        }
        RecentProjectsStore.shared.saveSession(entries)
    }

    /// A window is closing: the last one stays in the session.
    static func closing(_ context: WindowContext) {
        guard !quitting else {
            return
        }
        if WindowContext.all.filter({ $0.window != nil }).count <= 1 {
            lastClosed = entry(context)
        }
    }

    /// The app quits: every window stays in the session.
    static func quit() {
        pending?.cancel()
        save()
        quitting = true
    }

    private static func entry(_ context: WindowContext) -> WindowSession.Entry {
        let shown = context.workspace.folders.isEmpty ? context.expected : nil
        let folders = shown?.folders ?? context.workspace.folders.map(\.root)
        let file = shown?.workspaceFile ?? context.workspace.file
        return WindowSession.Entry(folders: folders, workspaceFile: file, bounds: context.window.map(bounds))
    }

    /// The window's top left (y down from the top of the main screen) and its content size.
    private static func bounds(_ window: NSWindow) -> CGRect {
        let top = (NSScreen.screens.first?.frame.maxY ?? window.frame.maxY) - window.frame.maxY
        let content = window.contentRect(forFrameRect: window.frame).size
        return CGRect(x: window.frame.minX, y: top, width: content.width, height: content.height)
    }

    /// The screens' frames in the same coordinates.
    private static func screenRects() -> [CGRect] {
        let primaryTop = NSScreen.screens.first?.frame.maxY ?? 0
        return NSScreen.screens.map { screen in
            CGRect(x: screen.frame.minX, y: primaryTop - screen.frame.maxY, width: screen.frame.width,
                   height: screen.frame.height)
        }
    }
}
