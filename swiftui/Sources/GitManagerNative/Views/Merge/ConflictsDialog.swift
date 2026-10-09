// The "Conflicts" list (src/lib/merge/ConflictsDialog.svelte): every conflicted file with what each side did, Accept
// Yours or Theirs on the selection, Merge... for one file, and Continue once all are resolved. A dialog 760 points
// wide (at most the window less 32) at 9% of the height from the top, over the window dimmed by --overlay. The dim
// and the dialog's shadow are the page's own layers (DialogBackdrop), placed once the dialog's height is known; a
// SwiftUI shadow on the dialog would shade every label and button in it.

import AppKit
import NativeCore
import SwiftUI

struct ConflictsDialog: View {
    @Environment(\.theme) private var theme
    @ObservedObject var center: MergeCenter
    @EnvironmentObject private var model: AppModel
    @State private var summary: ConflictSummaryDTO?
    @State private var loadError: String?
    @State private var selected: [String] = []
    @State private var anchor: String?
    @State private var dialogFrame: CGRect = .zero

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                DialogBackdrop(dialog: dialogFrame, cornerRadius: 10, overlayAlpha: theme.alpha("--overlay"),
                               shadow: DialogBackdrop.parseShadow(theme.raw("--shadow") ?? ""), shadowInOverlay: true)
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture {
                        center.conflictsOpen = false
                    }
                dialog
                    .frame(width: min(760, proxy.size.width - 32))
                    .background(GeometryReader { box in
                        let frame = box.frame(in: .named("conflicts"))
                        Color.clear
                            .onAppear {
                                dialogFrame = frame
                            }
                            .onChange(of: frame) { newFrame in
                                dialogFrame = newFrame
                            }
                    })
                    .frame(maxHeight: proxy.size.height * 0.78, alignment: .top)
                    .padding(.top, proxy.size.height * 0.09)
            }
            .coordinateSpace(name: "conflicts")
        }
        .task(id: model.snapshot?.hash) {
            await refresh()
        }
    }

    private var files: [ConflictFileDTO] {
        summary?.files ?? []
    }

    private var selectedFiles: [ConflictFileDTO] {
        files.filter { selected.contains($0.path) }
    }

    private var dialog: some View {
        VStack(alignment: .leading, spacing: 0) {
            head
                .padding(.bottom, 12)
            if let loadError {
                Text(loadError)
                    .foregroundStyle(theme.ink("--danger"))
            } else if let summary, files.isEmpty {
                done(summary)
            } else {
                HStack(alignment: .top, spacing: 12) {
                    ConflictsTable(files: files, op: summary?.op, selected: selected, select: select,
                                   open: { file in open(file) })
                    actions
                }
                ExactText(text: "Double-click a file to merge it. Cmd-click or Shift-click selects several files.",
                          size: 12)
                    .foregroundStyle(theme.ink("--text-dim"))
                    .padding(.top, 10)
            }
        }
        // The page's padding (14, 16, 12) starts inside its 1-point border.
        .padding(.top, 15)
        .padding(.horizontal, 17)
        .padding(.bottom, 13)
        .background(RoundedRectangle(cornerRadius: 10, style: .circular).fill(theme.color("--panel")))
        .borderRing(theme.color("--border-strong"), cornerRadius: 10)
    }

    private var head: some View {
        HStack(spacing: 10) {
            ExactText(text: "Conflicts", size: 14, weight: .bold)
            if let op = summary?.op, op.kind != "none" {
                ExactText(text: op.description ?? "", size: 13)
                    .foregroundStyle(theme.ink("--text-dim"))
                    .layoutPriority(-1)
            }
            Spacer(minLength: 0)
            IconButton(action: { center.conflictsOpen = false }) {
                Icon(name: "x", size: 15)
            }
        }
    }

    private var actions: some View {
        let single = selectedFiles.count == 1 ? selectedFiles.first : nil
        let canMerge = single.map { !$0.binary } ?? false
        return VStack(spacing: 8) {
            DialogButton(title: "Accept Yours", disabled: selectedFiles.isEmpty) {
                ConflictActions.accept(selectedFiles.map(\.path), side: .ours, center: center)
            }
            DialogButton(title: "Accept Theirs", disabled: selectedFiles.isEmpty) {
                ConflictActions.accept(selectedFiles.map(\.path), side: .theirs, center: center)
            }
            DialogButton(title: "Merge...", primary: true, disabled: !canMerge) {
                if let single {
                    open(single)
                }
            }
        }
        .frame(width: 140)
    }

    private func done(_ summary: ConflictSummaryDTO) -> some View {
        VStack(spacing: 10) {
            Icon(name: "check", size: 22)
                .foregroundStyle(theme.ink("--success"))
                .frame(width: 44, height: 44)
                .background(Circle().fill(theme.mix("--success", 0.18, "--panel")))
            Text("All conflicts are resolved.")
            if summary.op.kind != "none" && summary.op.kind != "other" {
                DialogButton(title: "Continue \(ConflictLabels.opLabel(summary.op.kind))", primary: true) {
                    center.conflictsOpen = false
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 24)
        .padding(.bottom, 16)
    }

    private func select(_ file: ConflictFileDTO, command: Bool, shift: Bool) {
        let next = ConflictLabels.select(file.path, in: files.map(\.path), selected: selected, anchor: anchor,
                                         command: command, shift: shift)
        selected = next.selected
        anchor = next.anchor
    }

    private func open(_ file: ConflictFileDTO) {
        guard !file.binary else {
            return
        }
        Task {
            await center.openMerge(file.path)
        }
    }

    /// Reads the list again whenever the status changes (resolutions, refreshes), keeping the selection that still
    /// exists, else the first file.
    private func refresh() async {
        guard let repoPath = model.repoPath else {
            return
        }
        let result = await Task.detached { () -> Result<ConflictSummaryDTO, Error> in
            Result { try Backend.call("list_conflicts", RepoPathArgs(repoPath: repoPath)) }
        }.value
        switch result {
        case .success(let next):
            summary = next
            loadError = nil
            let paths = Set(next.files.map(\.path))
            selected = selected.filter { paths.contains($0) }
            if selected.isEmpty, let first = next.files.first {
                selected = [first.path]
                anchor = first.path
            }
        case .failure(let error):
            loadError = AppModel.describe(error)
        }
    }
}

/// .btn in the dialog: 28 points tall, centered text, --border-strong border with 6-point corners on --panel, or
/// .primary in --accent; 50% opacity while disabled.
struct DialogButton: View {
    @Environment(\.theme) private var theme
    let title: String
    var primary = false
    var disabled = false
    /// As wide as its text with 12 points of padding and the border (the Git dialogs' buttons), not the column.
    var hug = false
    /// .btn.small: 24 points tall, 8 points in, 12-point text.
    var small = false
    /// .btn.danger: the text in --danger (New Token).
    var danger = false
    let action: () -> Void

    var body: some View {
        let surface = primary ? "--accent" : "--panel"
        let ink = primary ? "--accent-text" : danger ? "--danger" : "--text"
        Button(action: action) {
            ExactText(text: title, size: small ? 12 : 13)
                // opacity: 0.5 on the whole button: the text at half over the dialog's --panel.
                .foregroundStyle(disabled ? theme.over(ink, 0.5, on: "--panel") : theme.ink(ink))
                .padding(.horizontal, hug ? (small ? 9 : 13) : 0)
                .frame(maxWidth: hug ? nil : .infinity)
                .frame(height: small ? 24 : 28)
                .background(RoundedRectangle(cornerRadius: 6, style: .circular)
                    .fill(disabled ? theme.over(surface, 0.5, on: "--panel") : theme.color(surface)))
                .borderRing(disabled ? theme.over(primary ? "--accent" : "--border-strong", 0.5, on: "--panel")
                    : theme.color(primary ? "--accent" : "--border-strong"), cornerRadius: 6)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // The title as is (ExactText may lead with a kerned space).
        .accessibilityLabel(title)
        .allowsHitTesting(!disabled)
    }
}

