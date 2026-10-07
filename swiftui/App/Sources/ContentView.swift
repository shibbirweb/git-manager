// Phase 0 screen: plain text on purpose. The pixel-matched UI starts in phase 2, once the
// measuring tools exist (docs/plans/swiftui-experiment.md).

import AppKit
import SwiftUI

struct ContentView: View {
    let initialRepoPath: String?

    @ObservedObject private var model = AppModel.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Button("Open Folder...") {
                    chooseFolder()
                }
                if let repoPath = model.repoPath {
                    Text(repoPath)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                Spacer()
                if model.loading {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            Divider()
            statusText
            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task {
            if let initialRepoPath {
                await model.open(repoPath: initialRepoPath)
            }
        }
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
                    .font(.headline)
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
