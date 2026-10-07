// The Files panel (src/lib/views/files/FileExplorer.svelte), measured in
// swiftui/Reference/changes-<mode>/files-panel.json: the heading (34 points, the folder name and five buttons), then
// rows 24 points tall, 8 points in plus 14 per level: chevron, icon, name, and a tone dot or status letter.

import SwiftUI

struct FilesPanel: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var files = FilesModel.shared

    var body: some View {
        VStack(spacing: 0) {
            head
            ScrollView {
                LazyVStack(spacing: 0) {
                    rows(in: "", depth: 0)
                }
                .padding(.top, 4)
            }
            .scrollIndicators(.never)
        }
    }

    private var head: some View {
        VStack(spacing: 0) {
            HStack(spacing: 2) {
                Text((files.rootPath.map { ($0 as NSString).lastPathComponent } ?? "").uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.66)
                    .foregroundStyle(theme.color("--text-dim"))
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer(minLength: 0)
                headButton("plus", size: 14)
                // Locate the open file: off until a file is open, as in the current app.
                headButton("locate", size: 14, disabled: true)
                headButton("chevron-up", size: 14)
                headButton("refresh", size: 13)
                headButton("x", size: 14)
            }
            .padding(.leading, 12)
            .padding(.trailing, 6)
            .frame(maxHeight: .infinity)
            theme.color("--border-strong").frame(height: 1)
        }
        .frame(height: 34)
    }

    /// .icon-btn.small: the icon with 6 points on each side, 24 points tall.
    private func headButton(_ icon: String, size: CGFloat, disabled: Bool = false) -> some View {
        IconButton(width: size + 12, height: 24, disabled: disabled, action: {}) {
            Icon(name: icon, size: size)
        }
    }

    private func rows(in dirPath: String, depth: Int) -> AnyView {
        AnyView(ForEach(files.listings[dirPath] ?? [], id: \.self) { entry in
            let path = dirPath.isEmpty ? entry.name : "\(dirPath)/\(entry.name)"
            FileTreeRow(entry: entry, depth: depth, expanded: files.expanded.contains(path), tone: files.tones[path])
                .onTapGesture {
                    if entry.isDir {
                        Task {
                            await files.toggle(path)
                        }
                    }
                }
            if entry.isDir && files.expanded.contains(path) {
                rows(in: path, depth: depth + 1)
            }
        })
    }
}

struct FileTreeRow: View {
    @Environment(\.theme) private var theme

    let entry: DirEntry
    let depth: Int
    let expanded: Bool
    let tone: FileTone?

    var body: some View {
        HStack(spacing: 4) {
            // Files keep the chevron's 12 points empty, so names line up.
            ZStack {
                if entry.isDir {
                    Icon(name: expanded ? "chevron-down" : "chevron-right", size: 12)
                }
            }
            .frame(width: 12, height: 12)
            Icon(name: entry.isDir ? (entry.isRepo ? "folder-git" : "folder") : "file", size: 14)
                .foregroundStyle(entry.ignored ? theme.color("--text-faint") : theme.color("--text-dim"))
            Text(entry.name)
                .foregroundStyle(nameColor)
                .fontWeight(tone == .conflict ? .medium : .regular)
                .opacity(tone == .deleted ? 0.85 : 1)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 0)
            marker
        }
        .font(.system(size: 13))
        .foregroundStyle(theme.color("--text-dim"))
        .padding(.leading, 8 + CGFloat(depth) * 14)
        .padding(.trailing, 8)
        .frame(height: 24)
        .contentShape(Rectangle())
    }

    private var nameColor: Color {
        if entry.ignored {
            return theme.color("--text-faint")
        }
        switch tone {
        case .modified:
            return theme.color("--accent")
        case .added:
            return theme.color("--success")
        case .conflict, .deleted:
            return theme.color("--danger")
        case nil:
            return theme.color("--text")
        }
    }

    /// A folder's tone dot (6 points, 5 from the edge) or a file's status letter (11-point bold, 16 wide).
    @ViewBuilder
    private var marker: some View {
        if let tone {
            if entry.isDir {
                Circle()
                    .fill(nameColor)
                    .frame(width: 6, height: 6)
                    .padding(.trailing, 5)
            } else {
                Text(Self.letter(tone))
                    .font(.custom("JetBrains Mono", size: 11).weight(.bold))
                    .foregroundStyle(nameColor)
                    .frame(width: 16)
            }
        }
    }

    private static func letter(_ tone: FileTone) -> String {
        switch tone {
        case .conflict:
            return "C"
        case .deleted:
            return "D"
        case .added:
            return "A"
        case .modified:
            return "M"
        }
    }
}
