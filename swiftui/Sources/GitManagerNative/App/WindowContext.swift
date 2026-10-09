// One window's state (the current app gives each window its own page): its folders and repository, the editor and
// its tabs, the Log, Files, the terminal, the merge tool, the search popups, the open diff, toasts, the Clone dialog
// and the context menu. Each model reaches the others of its window through `context`; views read them from the
// environment (`windowContext(_:)` puts them there); what acts on "the window" from outside (the control server)
// takes the focused one. Settings, recent projects, diff preferences and the memory readout are the app's.

import AppKit
import NativeCore
import SwiftUI

@MainActor
final class WindowContext: ObservableObject {
    let app = AppModel()
    let workspace = WorkspaceModel()
    let editor = EditorModel()
    let log = LogModel()
    let files = FilesModel()
    let terminal = TerminalStore()
    let merge = MergeCenter()
    let search = SearchPopups()
    let diffs = DiffStore()
    let toasts = ToastCenter()
    let clone = CloneCenter()
    let menus = ContextMenuCenter()
    /// The window showing this context, once it is on screen.
    weak var window: NSWindow?
    /// What a new window was opened for, until its folders are read (WindowOpener).
    var expected: WindowOwnership.Shown?
    /// What the app was started with, in the first window only (WindowRoot).
    var launch: WindowRequest?

    /// Every window's context, oldest first.
    private(set) static var all: [WindowContext] = []
    /// The window focused last (the key window, or the last one that was).
    private static weak var lastFocused: WindowContext?

    init() {
        app.context = self
        workspace.context = self
        editor.context = self
        log.context = self
        files.context = self
        terminal.context = self
        merge.context = self
        search.context = self
        diffs.context = self
        toasts.context = self
        clone.context = self
        menus.context = self
        Self.all.append(self)
    }

    /// The context of the key window, else of the window focused last, else the first one.
    static var focused: WindowContext {
        if let key = NSApp.keyWindow, let context = all.first(where: { $0.window === key }) {
            lastFocused = context
            return context
        }
        if let lastFocused {
            return lastFocused
        }
        return all.first ?? WindowContext()
    }

    /// The context of `window` (a key event's, an AppKit view's).
    static func of(_ window: NSWindow?) -> WindowContext? {
        guard let window else {
            return nil
        }
        return all.first { $0.window === window }
    }

    /// The window closed: its context goes, with its terminals.
    func close() {
        terminal.kill()
        Self.all.removeAll { $0 === self }
    }
}

private struct WindowContextKey: EnvironmentKey {
    static let defaultValue: WindowContext? = nil
}

extension EnvironmentValues {
    /// The window this view is in.
    var windowContext: WindowContext? {
        get { self[WindowContextKey.self] }
        set { self[WindowContextKey.self] = newValue }
    }
}

extension View {
    /// Puts `context` and each of its observable models in the environment of this window's views.
    func windowContext(_ context: WindowContext) -> some View {
        background(WindowBinder(context: context))
            .environment(\.windowContext, context)
            .environmentObject(context.app)
            .environmentObject(context.workspace)
            .environmentObject(context.editor)
            .environmentObject(context.log)
            .environmentObject(context.files)
            .environmentObject(context.terminal)
            .environmentObject(context.merge)
            .environmentObject(context.search)
            .environmentObject(context.diffs)
            .environmentObject(context.toasts)
            .environmentObject(context.clone)
            .environmentObject(context.menus)
            .environmentObject(context.app.draft)
    }
}

/// Tells a context which window shows it, once its views are in one.
private struct WindowBinder: NSViewRepresentable {
    let context: WindowContext

    func makeNSView(context: Context) -> BinderView {
        BinderView(windowContext: self.context)
    }

    func updateNSView(_ view: BinderView, context: Context) {}

    final class BinderView: NSView {
        private let windowContext: WindowContext

        init(windowContext: WindowContext) {
            self.windowContext = windowContext
            super.init(frame: .zero)
        }

        required init?(coder: NSCoder) {
            nil
        }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            if let window {
                windowContext.window = window
            }
        }
    }
}

