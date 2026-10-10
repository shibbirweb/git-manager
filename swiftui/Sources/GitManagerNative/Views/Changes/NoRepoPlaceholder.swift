// Changes for a workspace without any repository (ChangesView.svelte .placeholder.no-repo): centered in the panel
// with 20 by 14 points of padding, 6 apart: a 36-point circle of --accent at 12% with the repository icon, "No git
// repository" in semibold, the hint in --text-dim, then 8 points lower Initialize Repository (primary) and Scan
// Again as small buttons 8 apart.

import SwiftUI

struct NoRepoPlaceholder: View {
    @Environment(\.theme) private var theme
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var workspace: WorkspaceModel

    let busy: Bool

    var body: some View {
        VStack(spacing: 6) {
            Icon(name: "folder-git", size: 20)
                .foregroundStyle(theme.ink("--accent"))
                .frame(width: 36, height: 36)
                .background(Circle().fill(theme.over("--accent", 0.12, on: "--panel")))
            ExactText(text: "No git repository", size: 13, weight: .semibold)
            Text("Initialize one here, or scan again after adding one.")
                .font(PageFont.font(13))
                .foregroundStyle(theme.ink("--text-dim"))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                SmallButton(title: "Initialize Repository", primary: true) {
                    if let folderPath = workspace.root {
                        Task {
                            await model.initRepository(folderPath)
                        }
                    }
                }
                SmallButton(title: "Scan Again") {
                    Task {
                        await model.openFolders(workspace.folders.map(\.root))
                    }
                }
            }
            .disabled(busy)
            .padding(.top, 8)
        }
        .padding(.vertical, 20)
        .padding(.horizontal, 14)
    }

    /// The column at the panel's width, so the hint wraps there, centered as WebKit centers a flex column.
    static func centered(_ placeholder: NoRepoPlaceholder) -> some View {
        GeometryReader { proxy in
            placeholder
                .frame(width: proxy.size.width)
                .modifier(WholePointCenter())
        }
    }
}
