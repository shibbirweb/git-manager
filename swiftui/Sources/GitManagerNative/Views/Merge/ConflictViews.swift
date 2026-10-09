// What a merge, rebase, cherry-pick or revert in progress adds to the window: the operation banner under the header
// (src/lib/views/OpBanner.svelte), the Conflicts group at the top of the Changes list with its Resolve... button
// (src/lib/views/changes/RepoSection.svelte), and the status bar's conflict count and operation (StatusBar.svelte).

import NativeCore
import SwiftUI

/// The banner: 6 and 12 points of padding, color-mix(--danger 10%, --panel) while files are in conflict (--accent
/// 12% once resolved) with a --border-strong line below; the icon in the tint's color, the bold description, the
/// dim count, then small buttons.
struct OpBanner: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var model = AppModel.shared

    var body: some View {
        if let op = model.snapshot?.status?.op, op.kind != "none" {
            let conflicts = FileGroups(model.snapshot?.status?.files ?? []).conflicts.count
            let tint = conflicts > 0 ? "--danger" : "--accent"
            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    Icon(name: conflicts > 0 ? "alert" : "merge", size: 15)
                        .foregroundStyle(theme.ink(tint))
                    HStack(spacing: 0) {
                        ExactText(text: (op.description ?? "") + " ", size: 13, weight: .bold)
                        ExactText(text: conflicts > 0
                            ? "\u{00B7} \(conflicts) \(conflicts == 1 ? "file has" : "files have") conflicts"
                            : "\u{00B7} all conflicts resolved", size: 13)
                            .foregroundStyle(theme.ink("--text-dim"))
                            .layoutPriority(-1)
                        Spacer(minLength: 0)
                    }
                    HStack(spacing: 6) {
                        if conflicts > 0 {
                            SmallButton(title: "Resolve Conflicts...", primary: true) {
                                MergeCenter.shared.openConflicts()
                            }
                        }
                        if op.kind != "other" {
                            SmallButton(title: "Abort") {}
                        }
                    }
                }
                .padding(.horizontal, 12)
                .frame(height: 36)
                .background(theme.mix(tint, conflicts > 0 ? 0.1 : 0.12, "--panel"))
                theme.color("--border-strong").frame(height: 1)
            }
        }
    }
}

/// .btn.small: 24 points tall (20 in a group header), 8 points of padding inside a 1-point border, 12-point text
/// (11.5 in a group header), --panel or .primary's --accent.
struct SmallButton: View {
    @Environment(\.theme) private var theme
    let title: String
    var primary = false
    var height: CGFloat = 24
    var size: CGFloat = 12
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ExactText(text: title, size: size)
                .foregroundStyle(theme.ink(primary ? "--accent-text" : "--text"))
                .padding(.horizontal, 9)
                .frame(height: height)
                .background(RoundedRectangle(cornerRadius: 6, style: .circular)
                    .fill(theme.color(primary ? "--accent" : "--panel")))
                .borderRing(theme.color(primary ? "--accent" : "--border-strong"), cornerRadius: 6)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// The Conflicts group: its header always shows Resolve...; a click on a row opens the merge tool on that file.
struct ConflictsGroup: View {
    @Environment(\.theme) private var theme
    let files: [FileStatus]
    /// Inside a repository's section (several repositories): 12 points further in.
    var nested = false
    /// Makes the section's repository the active one before its conflicts open.
    var activate: () async -> Void = {}

    var body: some View {
        if !files.isEmpty {
            HStack(spacing: 4) {
                HStack(spacing: 5) {
                    Icon(name: "chevron-down", size: 13)
                    ExactText(text: "Conflicts", size: 13, weight: .semibold)
                    ExactText(text: "\(files.count)", size: 12)
                        .foregroundStyle(theme.ink("--text-dim"))
                    Spacer(minLength: 0)
                }
                .padding(.leading, 4)
                SmallButton(title: "Resolve...", height: 20, size: 11.5) {
                    Task {
                        await activate()
                        MergeCenter.shared.openConflicts()
                    }
                }
            }
            .padding(.leading, nested ? 16 : 4)
            .padding(.trailing, 6)
            .frame(height: 26)
            ForEach(files, id: \.path) { file in
                FileRow(file: file, kind: nil, nested: nested)
                    .onTapGesture {
                        Task {
                            await activate()
                            await MergeCenter.shared.openMerge(file.path)
                        }
                    }
            }
            Color.clear.frame(height: 4)
        }
    }
}

/// The status bar's "<n> conflicts" in --danger with the alert icon, and the operation's description.
struct StatusBarConflicts: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var model = AppModel.shared

    var body: some View {
        let conflicts = FileGroups(model.snapshot?.status?.files ?? []).conflicts.count
        let op = model.snapshot?.status?.op
        // Nothing at all without them, so the status bar's spacing stays as it was.
        if conflicts > 0 || (op != nil && op?.kind != "none") {
            items(conflicts: conflicts, op: op)
        }
    }

    private func items(conflicts: Int, op: OpStateDTO?) -> some View {
        HStack(spacing: 2) {
            if conflicts > 0 {
                HStack(spacing: 5) {
                    Icon(name: "alert", size: 12)
                    ExactText(text: "\(conflicts) \(conflicts == 1 ? "conflict" : "conflicts")")
                }
                .foregroundStyle(theme.ink("--danger"))
                .padding(.horizontal, 7)
                .frame(height: 20)
                .onTapGesture {
                    MergeCenter.shared.openConflicts()
                }
            }
            if let op, op.kind != "none" {
                ExactText(text: op.description ?? "")
                    .padding(.horizontal, 7)
                    .frame(maxWidth: 320, alignment: .leading)
                    .frame(height: 20)
            }
        }
    }
}
