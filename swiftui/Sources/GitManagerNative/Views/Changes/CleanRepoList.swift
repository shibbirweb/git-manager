// The repositories without changes, after the sections of a workspace (src/lib/views/changes/CleanRepoList.svelte):
// 6 points down, a 26-point "No Changes" heading (chevron, the label in semibold --text-dim and the count in 12
// points) that folds the list, then a 24-point row each, 24 points in: the repository icon in --text-faint, the name
// in --text, its path and operation, then the row actions without Commit. The active one has the accent bar, 4
// points from the top and bottom; the others offer Set as active repository under the mouse.
// Not built yet: the right-click menu (the "..." items, Set as Active Repository, Copy Repository Path).

import NativeCore
import SwiftUI

struct CleanRepoList: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var model = AppModel.shared
    @ObservedObject private var workspace = WorkspaceModel.shared
    @State private var headerHovered = false

    let repos: [WorkspaceRepo]
    /// After a section: its groups end with a 4-point margin, which collapses into the list's 6 (CSS margins).
    var afterSection = true

    var body: some View {
        let collapsed = workspace.isCleanCollapsed(repos.count)
        VStack(spacing: 0) {
            Button {
                workspace.toggleClean(repos.count)
            } label: {
                HStack(spacing: 5) {
                    Icon(name: collapsed ? "chevron-right" : "chevron-down", size: 13)
                    ExactText(text: "No Changes", size: 13, weight: .semibold)
                    ExactText(text: "\(repos.count)", size: 12)
                }
                .padding(.horizontal, 4)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("No Changes \(repos.count)")
            .foregroundStyle(theme.ink("--text-dim"))
            .padding(.leading, 4)
            .padding(.trailing, 6)
            .frame(height: 26)
            .background(headerHovered ? theme.color("--hover") : .clear)
            .pageHover { headerHovered = $0 }
            if !collapsed {
                ForEach(repos, id: \.root) { repo in
                    CleanRepoRow(repo: repo, status: workspace.statuses[repo.root],
                                 active: repo.root == model.repoPath, busy: model.busy != nil)
                }
            }
        }
        .padding(.top, afterSection ? 2 : 6)
    }
}

private struct CleanRepoRow: View {
    @Environment(\.theme) private var theme
    @State private var hovered = false

    let repo: WorkspaceRepo
    let status: RepoStatus?
    let active: Bool
    let busy: Bool

    var body: some View {
        let model = AppModel.shared
        HStack(spacing: 6) {
            Icon(name: "folder-git", size: 13)
                .foregroundStyle(theme.ink("--text-faint"))
            ExactText(text: repo.name, size: 13)
                .foregroundStyle(theme.ink("--text"))
            if !repo.relativePath.isEmpty && repo.relativePath != repo.name {
                ExactText(text: repo.relativePath, size: 12)
                    .foregroundStyle(theme.ink("--text-faint"))
            }
            if let op = WorkspaceRules.opLabel(status?.op?.kind) {
                ExactText(text: op, size: 11, weight: .semibold)
                    .foregroundStyle(theme.ink("--warning"))
                    .padding(.horizontal, 6)
                    .frame(height: 16)
                    .background(Capsule(style: .circular).fill(theme.fill("--warning", 0.18, on: "--panel")))
            }
            Spacer(minLength: 0)
            if hovered && !active {
                HeadAction(action: { Task { await model.setActive(repo.root) } }) {
                    Icon(name: "folder-git", size: 13).frame(width: 20, height: 20)
                }
                .accessibilityLabel("Set \(repo.name) as active repository")
            }
            if let status {
                RepoActions(
                    head: status.head, decorations: "", busy: busy, publish: ChangesPanel.publishes(status),
                    operation: status.op.map { $0.kind != "none" } ?? false, showCommit: false,
                    refresh: { Task { await model.refreshAll() } }
                )
            } else {
                ExactText(text: "reading status", size: 11.5)
                    .foregroundStyle(theme.ink("--text-faint"))
            }
        }
        .padding(.leading, 24)
        .padding(.trailing, 6)
        .frame(height: 24)
        .foregroundStyle(theme.ink("--text-dim"))
        .background(hovered ? theme.color("--hover") : .clear)
        .overlay(alignment: .leading) {
            if active {
                HalfRoundedRectangle(roundedSide: .trailing, radius: 2)
                    .fill(theme.color("--accent"))
                    .frame(width: 3)
                    .padding(.vertical, 4)
            }
        }
        .contentShape(Rectangle())
        .pageHover { hovered = $0 }
    }
}
