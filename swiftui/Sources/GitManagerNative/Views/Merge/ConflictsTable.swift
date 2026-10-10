// The conflicts dialog's table (ConflictsDialog.svelte .table): a --border-strong frame with 6-point corners, a
// sticky header on --panel-alt (Name, then the two sides' labels in 12-point dim semibold), and 28-point rows of
// three columns (the rest, 130, 130; 8 apart, 10 points of padding): the file icon, the name, its folder dimmed,
// a "binary" tag, and what each side did (Deleted in --danger).

import AppKit
import NativeCore
import SwiftUI

struct ConflictsTable: View {
    @Environment(\.theme) private var theme
    let files: [ConflictFileDTO]
    let op: OpStateDTO?
    let selected: [String]
    let select: (ConflictFileDTO, _ command: Bool, _ shift: Bool) -> Void
    let open: (ConflictFileDTO) -> Void

    var body: some View {
        VStack(spacing: 0) {
            row {
                ExactText(text: "Name", size: 12, weight: .semibold)
            } ours: {
                ExactText(text: op?.oursLabel ?? "Yours", size: 12, weight: .semibold)
            } theirs: {
                ExactText(text: op?.theirsLabel ?? "Theirs", size: 12, weight: .semibold)
            }
            .foregroundStyle(theme.ink("--text-dim"))
            .frame(height: 27)
            .background(theme.color("--panel-alt"))
            theme.color("--border-strong").frame(height: 1)
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(files) { file in
                        item(file)
                    }
                }
            }
            .scrollIndicators(.never)
        }
        .padding(1)
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .circular))
        .borderRing(theme.color("--border-strong"), cornerRadius: 6)
        .fixedSize(horizontal: false, vertical: true)
    }

    private func item(_ file: ConflictFileDTO) -> some View {
        let parts = ConflictLabels.split(file.path)
        let isSelected = selected.contains(file.path)
        return row {
            HStack(spacing: 6) {
                Icon(name: "file", size: 13)
                ExactText(text: parts.name, size: 13, weight: .medium)
                if let folder = parts.folder {
                    ExactText(text: folder, size: 12)
                        .foregroundStyle(theme.ink("--text-dim"))
                        .layoutPriority(-1)
                }
                if file.binary {
                    ExactText(text: "binary", size: 11)
                        .foregroundStyle(theme.ink("--text-dim"))
                        .padding(.horizontal, 5)
                        .background(RoundedRectangle(cornerRadius: 4, style: .circular).fill(theme.color("--hover")))
                }
            }
        } ours: {
            side(file, .ours)
        } theirs: {
            side(file, .theirs)
        }
        .frame(height: 28)
        // The dialog is a layer of its own on the page, so --selected shows as macOS converts it (LayerFill).
        .background {
            if isSelected {
                LayerFill(color: theme.srgbLayerColor("--selected"), cornerRadius: 0)
            }
        }
        .contentShape(Rectangle())
        .gesture(TapGesture(count: 2).onEnded {
            open(file)
        })
        .simultaneousGesture(TapGesture().onEnded {
            let flags = NSEvent.modifierFlags
            select(file, flags.contains(.command), flags.contains(.shift))
        })
    }

    private func side(_ file: ConflictFileDTO, _ side: MergeSide) -> some View {
        let status = ConflictLabels.sideStatus(kind: file.kind, side: side)
        return ExactText(text: status, size: 12)
            .foregroundStyle(theme.ink(status == "Deleted" ? "--danger" : "--text"))
    }

    private func row<Name: View, Ours: View, Theirs: View>(
        @ViewBuilder name: () -> Name, @ViewBuilder ours: () -> Ours, @ViewBuilder theirs: () -> Theirs
    ) -> some View {
        HStack(spacing: 8) {
            name()
                .frame(maxWidth: .infinity, alignment: .leading)
            ours()
                .frame(width: 130, alignment: .leading)
            theirs()
                .frame(width: 130, alignment: .leading)
        }
        .padding(.horizontal, 10)
    }
}
