// One window: its own state (WindowContext) and what it opens. The first window takes what the app was started
// with (-folder, -folders, -workspaceFile, or git mergetool's files); the others what WindowOpener asked for.

import AppKit
import SwiftUI

struct WindowRoot: View {
    let request: WindowRequest?
    @StateObject private var context: WindowContext
    @Environment(\.openWindow) private var openWindow

    init(request: WindowRequest?) {
        self.request = request
        // Made once per window (StateObject), so the start arguments go to the first window only.
        _context = StateObject(wrappedValue: WindowRoot.makeContext(request))
    }

    var body: some View {
        let opens = request ?? context.launch
        Group {
            // Started by git mergetool with its four files: the merge tool alone (MergeToolApp.svelte).
            if context.launch != nil && context.merge.mergetool != nil {
                MergetoolRoot()
            } else {
                ContentView(initialFolders: opens?.folders ?? [], initialWorkspaceFile: opens?.workspaceFile)
            }
        }
        .frame(minWidth: 960, minHeight: 600)
        .background(WindowSizer(origin: request.flatMap(Self.origin)))
        .windowContext(context)
        .onAppear {
            WindowOpener.action = openWindow
        }
        .onDisappear {
            context.close()
        }
    }

    private static var launchTaken = false

    /// What the app was started with, the first time a window asks.
    private static func takeLaunch() -> WindowRequest? {
        guard !launchTaken else {
            return nil
        }
        launchTaken = true
        return WindowRequest(folders: AppDelegate.launchFolders(),
                             workspaceFile: UserDefaults.standard.string(forKey: "workspaceFile"))
    }

    private static func makeContext(_ request: WindowRequest?) -> WindowContext {
        let context = WindowContext()
        context.launch = request == nil ? takeLaunch() : nil
        if let opens = request ?? context.launch, !opens.folders.isEmpty || opens.workspaceFile != nil {
            context.expected = .init(folders: opens.folders.map(WindowOpener.canonical),
                                     workspaceFile: opens.workspaceFile.map(WindowOpener.canonical))
        }
        return context
    }

    private static func origin(_ request: WindowRequest) -> CGPoint? {
        guard let x = request.originX, let y = request.originY else {
            return nil
        }
        return CGPoint(x: x, y: y)
    }
}
