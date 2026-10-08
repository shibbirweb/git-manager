// A file in the main area under the tab strip (src/lib/views/files/FileView.svelte), measured in
// swiftui/Reference/file-<mode>/file-bar.json and file-actions.json: the file bar (the path as crumbs, then the
// actions), then the editor (FileEditorView). Read only for now: the cursor moves, the text does not change.

import AppKit
import NativeCore
import SwiftUI

struct FileScreen: View {
    @ObservedObject private var editor = EditorModel.shared
    @ObservedObject private var model = AppModel.shared

    let file: OpenFile

    var body: some View {
        VStack(spacing: 0) {
            FileBar(folderName: model.folderName, relativePath: file.relativePath)
            FileEditorView(file: file, cursor: editor.cursor, blameLabel: editor.blameLabel) { line, column in
                editor.cursor = (line, column)
            }
        }
    }
}

/// .file-bar: 29 points on --panel with a --border-strong bottom line, 10 points in on the left and 6 on the right,
/// 6 between its parts; 12-point --text-dim text.
struct FileBar: View {
    @Environment(\.theme) private var theme

    let folderName: String
    let relativePath: String

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                crumbs
                Spacer(minLength: 0)
                actions
            }
            .padding(.leading, 10)
            .padding(.trailing, 6)
            .frame(height: 28)
            theme.color("--border-strong").frame(height: 1)
        }
        .frame(height: 29)
        .background(theme.color("--panel"))
    }

    /// NavigationBar.svelte: the repository (--accent, its icon), each folder, then the file (--text, weight 600 and
    /// its icon), 1 point apart with an 11-point chevron in --text-faint between them.
    private var crumbs: some View {
        let parts = relativePath.split(separator: "/").map(String.init)
        return HStack(spacing: 1) {
            crumb(icon: "folder-git", name: folderName, color: "--accent")
            ForEach(Array(parts.enumerated()), id: \.offset) { index, part in
                Icon(name: "chevron-right", size: 11)
                    .foregroundStyle(theme.ink("--text-faint"))
                if index == parts.count - 1 {
                    crumb(icon: "file", name: part, color: "--text", weight: .semibold)
                } else {
                    crumb(icon: nil, name: part, color: "--text-dim")
                }
            }
        }
    }

    /// .crumb: 22 points tall, 3 points of padding, a 12-point icon 4 points before the name.
    private func crumb(icon: String?, name: String, color: String, weight: NSFont.Weight = .regular) -> some View {
        HStack(spacing: 4) {
            if let icon {
                Icon(name: icon, size: 12)
            }
            ExactText(text: name, size: 12, weight: weight)
        }
        .foregroundStyle(theme.ink(color))
        .padding(.horizontal, 3)
        .frame(height: 22)
    }

    /// .actions, 2 points apart: previous and next change (off without changes), the change label, a divider, Blame
    /// and Copy relative path.
    private var actions: some View {
        HStack(spacing: 2) {
            tool("arrow-up", size: 13, disabled: true)
            tool("arrow-down", size: 13, disabled: true)
            // .nav-label: 11.5-point text, 4 points of padding, at least 58 wide; set half a point lower (measured).
            ExactText(text: "No changes", size: 11.5)
                .foregroundStyle(theme.ink("--text-dim"))
                .offset(y: 0.5)
                .padding(.horizontal, 4)
                .frame(minWidth: 58, alignment: .leading)
            theme.color("--border-strong")
                .frame(width: 1, height: 14)
                .padding(.horizontal, 4)
            tool("history", size: 13)
            tool("copy", size: 12) {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(relativePath, forType: .string)
                ToastCenter.shared.show(.success, "Copied relative path")
            }
        }
    }

    /// .tool: 24 x 22 with the icon in --text-dim; a disabled one at 40% opacity, blended as WebKit blends it.
    private func tool(
        _ icon: String, size: CGFloat, disabled: Bool = false, action: @escaping () -> Void = {}
    ) -> some View {
        Icon(name: icon, size: size)
            .foregroundStyle(disabled ? theme.over("--text-dim", 0.4, on: "--panel") : theme.ink("--text-dim"))
            .frame(width: 24, height: 22)
            .contentShape(Rectangle())
            .onTapGesture {
                if !disabled {
                    action()
                }
            }
    }
}
