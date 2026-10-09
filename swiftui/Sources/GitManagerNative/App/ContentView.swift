// The window: the shell measured from the current app (Shell.swift) in its theme, with every part of the Changes
// screen (UI/): header, activity bars, Changes list, commit box, welcome screen, Files panel and status bar, each
// matched against swiftui/Reference.

import AppKit
import NativeCore
import SwiftUI

struct ContentView: View {
    @Environment(\.windowContext) private var windowContext
    let initialFolders: [String]

    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var workspace: WorkspaceModel
    @EnvironmentObject private var toasts: ToastCenter
    @EnvironmentObject private var log: LogModel
    @ObservedObject private var settings = SettingsStore.shared
    @EnvironmentObject private var terminal: TerminalStore
    @EnvironmentObject private var clone: CloneCenter
    @Environment(\.colorScheme) private var colorScheme
    /// The folders given at start are still opening: the shell shows, not the welcome screen.
    @State private var opening: Bool

    let initialWorkspaceFile: String?

    init(initialFolders: [String], initialWorkspaceFile: String? = nil) {
        self.initialFolders = initialFolders
        self.initialWorkspaceFile = initialWorkspaceFile
        _opening = State(initialValue: !initialFolders.isEmpty || initialWorkspaceFile != nil)
    }

    var body: some View {
        let theme = settings.theme(for: colorScheme)
        Group {
            if !opening && workspace.folders.isEmpty && model.repoPath == nil {
                WelcomeWindow()
            } else {
                shell
            }
        }
        .overlay {
            if settings.dialogShown(in: windowContext) {
                SettingsDialog(settings: settings)
            }
            SearchOverlay()
            MergeOverlay()
            if clone.shown {
                CloneDialog()
            }
            ContextMenuOverlay()
        }
        .coordinateSpace(name: HeaderMenus.pageSpace)
        .overlay(alignment: .bottomTrailing) {
            ToastStack(center: toasts)
        }
        .background(theme.color("--bg").ignoresSafeArea())
        // SwiftUI paints its own toolbar background where the title bar is; make it the current app's --bg.
        .toolbarBackground(theme.systemColor("--bg"), for: .windowToolbar)
        .toolbarBackground(.visible, for: .windowToolbar)
        .foregroundStyle(theme.ink("--text"))
        .font(.system(size: 13))
        .environment(\.theme, theme)
        .background(WindowChrome(background: theme.nsColor("--bg")))
        .navigationTitle(model.folderName)
        .onAppear {
            PointerGate.begin()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                if let windowContext {
                    ViewWarmUp.diffScreen(theme: settings.theme(for: colorScheme), context: windowContext)
                }
            }
        }
        .task {
            if let initialWorkspaceFile {
                await model.openWorkspaceFile(initialWorkspaceFile)
            } else if !initialFolders.isEmpty {
                await model.openFolders(initialFolders)
            }
            opening = false
        }
        .task {
            // The status bar's memory readout, like the current app's (every 2 seconds while the window shows). The
            // readout is the app's, so only the oldest window reads it.
            while !Task.isCancelled {
                if WindowContext.all.first === windowContext {
                    await model.refreshMemory()
                }
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    private var shell: some View {
        Shell {
            HeaderBar(
                folderName: model.folderName,
                head: model.snapshot?.status?.head,
                repoPill: workspace.showsRepoPicker ? (model.repoName, workspace.repos.count) : nil,
                noRepository: !workspace.folders.isEmpty && workspace.repos.isEmpty,
                chooseFolder: chooseFolder,
                toggleAppearance: settings.toggleLightDark,
                openSettings: { settings.openDialog() },
                busy: model.busy
            )
        } leftBar: {
            LeftActivityBar(
                changeCount: workspace.multiRepo ? workspace.totalChanges : model.changeCount,
                // Red while any repository of the workspace has a conflict, not only the active one.
                conflicts: workspace.multiRepo
                    ? workspace.statuses.values.contains { $0.files.contains(where: \.conflicted) }
                    : model.snapshot?.status?.files.contains(where: \.conflicted) ?? false,
                logShown: log.shown
            ) {
                log.toggle(repoPath: model.repoPath)
            }
        } sidebar: {
            ChangesPanel()
        } main: {
            // The editor area above the bottom panel, which takes the main area's whole width (Workspace.svelte).
            VStack(spacing: 0) {
                if log.shown {
                    LogScreen()
                } else {
                    MainArea()
                }
                if terminal.panelOpen {
                    TerminalPanel(store: terminal)
                }
            }
        } files: {
            FilesPanel()
        } rightBar: {
            RightActivityBar()
        } status: {
            StatusBarView(
                folderName: model.repoName,
                head: model.snapshot?.status?.head,
                changeCount: model.changeCount,
                busy: model.busy,
                unread: toasts.unread,
                unreadError: toasts.unreadError,
                openBell: toasts.markRead
            )
        }
    }

    private func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let folderPath = panel.url?.path {
            Task {
                await model.openFolder(folderPath)
            }
        }
    }
}
