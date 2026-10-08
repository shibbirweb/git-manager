// The window: the shell measured from the current app (Shell.swift) in its theme, with every part of the Changes
// screen (UI/): header, activity bars, Changes list, commit box, welcome screen, Files panel and status bar, each
// matched against swiftui/Reference.

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
            ChangesPanel(
                status: model.snapshot?.status,
                errorText: model.errorText,
                selected: model.openDiff.map { ($0.filePath, $0.staged) }
            ) { file, staged in
                Task {
                    await model.showDiff(file, staged: staged)
                }
            }
        } main: {
            if let open = model.openDiff {
                DiffScreen(open: open, close: model.closeDiff)
            } else {
                EditorArea {
                if model.repoPath != nil {
                    RepoCrumb(name: model.folderName, hasChanges: model.changeCount > 0)
                }
                } content: {
                    WelcomeView(title: model.folderName)
                }
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
                memoryBytes: model.memoryBytes
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
