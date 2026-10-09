// The window: the shell measured from the current app (Shell.swift) in its theme, with every part of the Changes
// screen (UI/): header, activity bars, Changes list, commit box, welcome screen, Files panel and status bar, each
// matched against swiftui/Reference.

import AppKit
import NativeCore
import SwiftUI

struct ContentView: View {
    let initialFolders: [String]

    @ObservedObject private var model = AppModel.shared
    @ObservedObject private var workspace = WorkspaceModel.shared
    @ObservedObject private var toasts = ToastCenter.shared
    @ObservedObject private var editor = EditorModel.shared
    @ObservedObject private var log = LogModel.shared
    @ObservedObject private var settings = SettingsStore.shared
    @ObservedObject private var terminal = TerminalStore.shared
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = settings.theme(for: colorScheme)
        Shell {
            HeaderBar(
                folderName: model.folderName,
                head: model.snapshot?.status?.head,
                repoPill: workspace.showsRepoPicker ? (model.repoName, workspace.repos.count) : nil,
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
                memoryBytes: model.memoryBytes,
                fileItems: fileItems,
                busy: model.busy,
                unread: toasts.unread,
                unreadError: toasts.unreadError,
                openBell: toasts.markRead
            )
        }
        .overlay {
            if settings.dialogOpen {
                SettingsDialog(settings: settings)
            }
            SearchOverlay()
            MergeOverlay()
        }
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
        .task {
            if !initialFolders.isEmpty {
                await model.openFolders(initialFolders)
            }
        }
        .task {
            // The status bar's memory readout, like the current app's (every 2 seconds while the window shows).
            while !Task.isCancelled {
                await model.refreshMemory()
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    /// The shown file's cursor, indentation, line ends and language, as the status bar lists them.
    private var fileItems: [String] {
        guard let file = editor.file, !editor.diffActive || model.openDiff == nil else {
            return []
        }
        // FileView.svelte: the main selection's head, its line, and its UTF-16 offset in that line.
        let head = editor.session?.state.selection.main.head ?? 0
        let line = editor.session?.state.doc.lineAt(head)
        let position = "Ln \((line?.index ?? 0) + 1), Col \(head - (line?.from ?? 0) + 1)"
        return [position, EditorInfo.indentLabel(file.indent), file.eolLabel, file.language]
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
