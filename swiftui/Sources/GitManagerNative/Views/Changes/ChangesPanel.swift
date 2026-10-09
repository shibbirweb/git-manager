// The Changes sidebar (src/lib/views/ChangesView.svelte): the heading row, the grouped file list and the commit box,
// measured in swiftui/Reference/changes-<mode>/changes-head.json, group-headers.json and file-rows.json. With
// several repositories the list has a section for each (RepoSections) and the commit box names its target.

import NativeCore
import SwiftUI

struct ChangesPanel: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var model = AppModel.shared
    @ObservedObject private var draft = AppModel.shared.draft
    @ObservedObject private var workspace = WorkspaceModel.shared

    var body: some View {
        let status = model.snapshot?.status
        let groups = FileGroups(status?.files ?? [])
        let state = model.commitState
        let multiRepo = workspace.multiRepo
        VStack(spacing: 0) {
            ChangesHead(
                count: multiRepo ? workspace.totalChanges : status?.files.count ?? 0,
                head: status?.head, decorations: groups.decorations,
                busy: model.busy != nil, commitBlocked: CommitRules.blocked(state) != nil,
                publish: status.map(Self.publishes) ?? false,
                operation: status?.op.map { $0.kind != "none" } ?? false,
                commit: { Task { await model.commitFromHead() } },
                refresh: { Task { multiRepo ? await model.refreshAll() : await model.refreshStatus() } },
                repoActions: !multiRepo
            )
            if let errorText = model.errorText {
                Text(errorText)
                    .foregroundStyle(theme.ink("--danger"))
                    .padding(12)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            } else {
                // The page's classic scrollbar takes its 10 points from the rows while they overflow.
                PageScroll {
                    VStack(spacing: 0) {
                        if multiRepo {
                            RepoSections()
                        } else {
                            if status != nil && groups.isEmpty {
                                CleanTree()
                            }
                            ChangeGroups(repoRoot: model.repoPath ?? "", groups: groups)
                        }
                    }
                    // .file-list: 4 points above and below the rows.
                    .padding(.vertical, 4)
                }
            }
            CommitBox(state: state, ahead: status?.head.ahead ?? 0, publish: status.map(Self.publishes) ?? false,
                      target: multiRepo ? commitTarget(staged: groups.staged.count, head: status?.head) : nil)
        }
    }

    /// A branch without an upstream is published rather than synced (syncPlan in sync.ts).
    static func publishes(_ status: RepoStatus) -> Bool {
        !status.head.unborn && status.head.branch != nil && status.head.upstream == nil
    }

    /// The active repository (no other target is picked yet), offered with the others that have changes.
    private func commitTarget(staged: Int, head: HeadInfo?) -> CommitTarget? {
        let counts = Dictionary(uniqueKeysWithValues: workspace.repos.map { ($0.root, workspace.changeCount($0.root)) })
        guard let repo = WorkspaceRules.commitTarget(workspace.repos, preferredRoot: nil, activeRoot: model.repoPath)
        else {
            return nil
        }
        let choices = WorkspaceRules.commitChoices(workspace.repos, changeCounts: counts, targetRoot: repo.root)
        let branch = head.map { $0.branch ?? ($0.shortId.map { "detached at \($0)" } ?? "detached") }
        return CommitTarget(
            label: WorkspaceRules.choiceLabel(repo, staged: staged), name: repo.name, branch: branch,
            picker: choices.count > 1
        )
    }
}

/// "Working tree clean": a 36-point tinted circle with a check, centered under the list's top padding.
struct CleanTree: View {
    @Environment(\.theme) private var theme
    var text = "Working tree clean"

    var body: some View {
        VStack(spacing: 8) {
            Icon(name: "check", size: 18)
                .foregroundStyle(theme.ink("--success"))
                .frame(width: 36, height: 36)
                .background(Circle().fill(theme.over("--success", 0.14, on: "--panel")))
            Text(text)
                .foregroundStyle(theme.ink("--text-dim"))
        }
        .padding(.vertical, 28)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity)
    }
}
