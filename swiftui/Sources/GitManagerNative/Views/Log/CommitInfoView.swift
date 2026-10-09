// The left side of the selected commit's details (src/lib/log/CommitDetails.svelte .left), measured in
// swiftui/Reference/log-<mode>/commit-info.json: the subject with Open in Tab, the message, the Author, Date, Hash and
// Parent rows, then "1 changed file" and the files with their status letters.

import AppKit
import NativeCore
import SwiftUI

struct CommitInfoView: View {
    @Environment(\.windowContext) private var windowContext
    @Environment(\.theme) private var theme
    @EnvironmentObject private var model: LogModel

    let details: CommitDetails

    var body: some View {
        let body = LogFormat.splitMessage(details.message)
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 8) {
                    Text(body.subject.isEmpty ? "(no message)" : body.subject)
                        .font(PageFont.font(13, weight: .semibold))
                        .lineSpacing(18.2 - 16)
                        .frame(maxWidth: .infinity, minHeight: 18, alignment: .topLeading)
                        .padding(.top, 1)
                    openInTab
                }
                if !body.rest.isEmpty {
                    Text(body.rest)
                        .font(.system(size: 12.5))
                        .padding(.top, 6)
                }
                meta
                    .padding(.top, 10)
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)
            .padding(.bottom, 10)
            theme.color("--border-strong").frame(height: 1)
            Text(details.files.count == 1 ? "1 changed file" : "\(details.files.count) changed files")
                .font(.system(size: 11.5))
                .foregroundStyle(theme.ink("--text-dim"))
                // 11.5-point text sits half a point lower on the page (measured).
                .offset(y: 0.5)
                .frame(height: 13)
                .padding(.horizontal, 12)
                .padding(.top, 6)
                .padding(.bottom, 4)
            ForEach(details.files, id: \.path) { file in
                CommitFileRow(file: file, selected: file.path == model.selectedPath) {
                    if let repoPath = windowContext?.app.repoPath {
                        Task {
                            await model.selectFile(file.path, repoPath: repoPath)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
    }

    /// .btn.small.open-tab: 24 points tall, 8 points of padding, a 13-point commit icon 5 points before 12-point text.
    private var openInTab: some View {
        HStack(spacing: 5) {
            Icon(name: "commit", size: 13)
            ExactText(text: "Open in Tab", size: 12)
        }
        .padding(.horizontal, 9)
        .frame(height: 24)
        .background(RoundedRectangle(cornerRadius: 6, style: .circular).fill(theme.color("--panel")))
        .borderRing(theme.color("--border-strong"), cornerRadius: 6)
        .fixedSize()
    }

    /// dl.meta: 12-point rows 3 points apart, the dim terms in a column as wide as the widest, 10 points before the
    /// values.
    private var meta: some View {
        let terms = ["Author", "Date", "Hash", details.parents.count > 1 ? "Parents" : "Parent"]
        let termWidth = terms.map { ExactText.width($0, font: .systemFont(ofSize: 12)) }.max() ?? 0
        return VStack(alignment: .leading, spacing: 3) {
            row("Author", termWidth: termWidth, height: 15) {
                HStack(spacing: 0) {
                    ExactText(text: details.authorName + (details.authorEmail.isEmpty ? "" : " "))
                    if !details.authorEmail.isEmpty {
                        ExactText(text: "<\(details.authorEmail)>")
                            .foregroundStyle(theme.ink("--text-dim"))
                    }
                }
            }
            row("Date", termWidth: termWidth, height: 15) {
                ExactText(text: LogFormat.fullDate(details.authorTime))
            }
            if !details.committerName.isEmpty && details.committerName != details.authorName {
                row("Committer", termWidth: termWidth, height: 15) {
                    Text("\(details.committerName), \(LogFormat.fullDate(details.committerTime))").lineLimit(1)
                }
            }
            row("Hash", termWidth: termWidth, height: 20) {
                HStack(spacing: 4) {
                    // Cut as WebKit cuts it (whole characters and an ellipsis); SwiftUI's own truncation set the
                    // mono glyphs a fraction of a pixel off.
                    ExactText(text: Self.cut(details.id, width: hashWidth(termWidth: termWidth)),
                              face: LogRowView.monoFont(12))
                        // The hash takes the row, so the copy button sits at its end.
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Icon(name: "copy", size: 12)
                        .foregroundStyle(theme.ink("--text-dim"))
                        .frame(width: 20, height: 20)
                }
                .frame(maxHeight: .infinity)
            }
            if !details.parents.isEmpty {
                row(terms[3], termWidth: termWidth, height: 16) {
                    HStack(spacing: 6) {
                        ForEach(details.parents, id: \.self) { parentId in
                            let loaded = model.loadedShortId(parentId)
                            ExactText(text: loaded ?? String(parentId.prefix(8)), face: LogRowView.monoFont(12))
                                .foregroundStyle(theme.ink(loaded == nil ? "--text-dim" : "--accent"))
                                .onTapGesture {
                                    if loaded != nil {
                                        Task {
                                            await model.select(parentId)
                                        }
                                    }
                                }
                        }
                    }
                }
            }
        }
        .font(.system(size: 12))
    }

    /// The hash's room: the details' width less the padding, the terms, the gap and the copy button.
    private func hashWidth(termWidth: CGFloat) -> CGFloat {
        CommitDetailsView.leftWidth - 24 - termWidth.rounded(.up) - 10 - 4 - 20
    }

    /// `text` in the mono font cut to `width` with an ellipsis, as text-overflow: ellipsis does.
    static func cut(_ text: String, width: CGFloat) -> String {
        let advance = ("0" as NSString).size(withAttributes: [.font: LogRowView.monoFont(12)]).width
        if CGFloat(text.count) * advance <= width {
            return text
        }
        let fits = max(0, Int(((width - advance) / advance).rounded(.down)))
        return String(text.prefix(fits)) + "\u{2026}"
    }

    private func row(
        _ term: String, termWidth: CGFloat, height: CGFloat, @ViewBuilder value: () -> some View
    ) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(term)
                .foregroundStyle(theme.ink("--text-dim"))
                .frame(width: termWidth, height: 15, alignment: .leading)
            value()
                .foregroundStyle(theme.ink("--text"))
                .frame(maxWidth: .infinity, minHeight: height, maxHeight: height, alignment: .leading)
        }
        .frame(height: height, alignment: .top)
    }
}

/// One changed file (.file): 24 points tall, 12 points of padding, the bold mono status letter in a 12-point column,
/// 6 points before the name and the dim folder.
struct CommitFileRow: View {
    @Environment(\.theme) private var theme
    @State private var hovered = false

    let file: ChangedFile
    let selected: Bool
    let select: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Text(LogFormat.statusLetter(file.status))
                .font(Font(NSFont(name: "JetBrainsMono-Regular_Bold", size: 11.5) ?? .boldSystemFont(ofSize: 11.5)))
                .foregroundStyle(letterColor)
                .frame(width: 12)
            ExactText(text: LogFormat.fileName(file.path), size: 13)
                .foregroundStyle(theme.ink(file.status == "deleted" ? "--text-dim" : "--text"))
            Text((file.origPath.map { "from \(LogFormat.fileName($0)) " } ?? "") + LogFormat.fileDir(file.path))
                .font(.system(size: 12))
                .foregroundStyle(theme.ink("--text-dim"))
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .frame(height: 24)
        .background(theme.color(selected ? "--selected-inactive" : hovered ? "--hover" : "--panel"))
        .contentShape(Rectangle())
        .pageHover { hovered = $0 }
        .onTapGesture(perform: select)
    }

    private var letterColor: Color {
        switch file.status {
        case "added":
            return theme.ink("--success")
        case "deleted":
            return theme.ink("--danger")
        case "renamed", "copied":
            return theme.mix("--accent", 0.55, "--danger")
        case "typechange":
            return theme.ink("--warning")
        default:
            return theme.ink("--accent")
        }
    }
}
