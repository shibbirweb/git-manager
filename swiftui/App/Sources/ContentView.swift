// The window: the shell measured from the current app (Shell.swift) in its theme, with the header, activity bars,
// Changes list, commit box, Files panel and status bar (UI/). The main area is still a placeholder; phase 2 replaces
// it next, checked against swiftui/Reference.

import AppKit
import SwiftUI

struct ContentView: View {
    let initialRepoPath: String?

    @ObservedObject private var model = AppModel.shared
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = Theme.standard(for: colorScheme)
        Shell {
            HeaderBar(
                folderName: model.folderName,
                head: model.snapshot?.status?.head,
                chooseFolder: chooseFolder,
                toggleAppearance: toggleAppearance
            )
        } leftBar: {
            LeftActivityBar(changeCount: model.changeCount)
        } sidebar: {
            ChangesPanel(status: model.snapshot?.status, errorText: model.errorText)
        } main: {
            EditorArea {
                Color.clear
            } content: {
                Color.clear
            }
        } files: {
            FilesPanel()
        } rightBar: {
            RightActivityBar()
        } status: {
            StatusBarView(
                folderName: model.folderName,
                head: model.snapshot?.status?.head,
                changeCount: model.changeCount,
                memoryMb: model.memoryMb
            )
        }
        .background(theme.color("--bg").ignoresSafeArea())
        // SwiftUI paints its own toolbar background where the title bar is; make it the current app's --bg.
        .toolbarBackground(theme.systemColor("--bg"), for: .windowToolbar)
        .toolbarBackground(.visible, for: .windowToolbar)
        .foregroundStyle(theme.color("--text"))
        .font(.system(size: 13))
        .environment(\.theme, theme)
        .background(WindowChrome(background: theme.nsColor("--bg")))
        .navigationTitle(model.folderName)
        .task {
            if let initialRepoPath {
                await model.open(repoPath: initialRepoPath)
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

    /// The header's theme button: switches between light and dark for this app.
    private func toggleAppearance() {
        NSApp.appearance = NSAppearance(named: colorScheme == .dark ? .aqua : .darkAqua)
    }

    private func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let folderPath = panel.url?.path {
            Task {
                await model.open(repoPath: folderPath)
            }
        }
    }
}
