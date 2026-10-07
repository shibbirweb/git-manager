// The window: the shell measured from the current app (Shell.swift) in its theme, with the header, activity bars
// and status bar (UI/). The Changes list, main area and Files panel are still placeholders; phase 2 replaces
// them part by part, each checked against swiftui/Reference.

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
            statusText
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .topLeading)
        } main: {
            EditorArea {
                Color.clear
            } content: {
                Color.clear
            }
        } files: {
            Color.clear
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

    @ViewBuilder
    private var statusText: some View {
        if let errorText = model.errorText {
            Text(errorText)
                .foregroundStyle(.red)
                .textSelection(.enabled)
        } else if let status = model.snapshot?.status {
            VStack(alignment: .leading, spacing: 6) {
                Text(headLine(status.head))
                    .fontWeight(.semibold)
                Text(status.files.isEmpty ? "No changes" : "\(status.files.count) changed files")
                ScrollView {
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(status.files, id: \.path) { file in
                            Text("\(statusLetters(file))  \(file.path)")
                                .font(.system(size: 12, design: .monospaced))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .textSelection(.enabled)
        } else if model.repoPath == nil {
            Text("Open a folder with a git repository to see its status.")
                .foregroundStyle(.secondary)
        }
    }

    private func headLine(_ head: HeadInfo) -> String {
        var line = head.unborn ? "No commits yet" : (head.branch ?? "Detached at \(head.shortId ?? "?")")
        if head.ahead > 0 {
            line += "  \(head.ahead) ahead"
        }
        if head.behind > 0 {
            line += "  \(head.behind) behind"
        }
        return line
    }

    private func statusLetters(_ file: FileStatus) -> String {
        if file.conflicted {
            return "C "
        }
        return "\(letter(file.staged))\(letter(file.unstaged))"
    }

    private func letter(_ changeKind: String?) -> String {
        switch changeKind {
        case "added": return "A"
        case "modified": return "M"
        case "deleted": return "D"
        case "renamed": return "R"
        case "typechange": return "T"
        case "untracked": return "U"
        default: return "."
        }
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
