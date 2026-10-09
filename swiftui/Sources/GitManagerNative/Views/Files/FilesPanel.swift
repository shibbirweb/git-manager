// The Files panel (src/lib/views/files/FileExplorer.svelte), measured in
// swiftui/Reference/changes-<mode>/files-panel.json: the heading (34 points, the folder name and five buttons), then
// rows 24 points tall, 8 points in plus 14 per level: chevron, icon, name, and a tone dot or status letter.

import NativeCore
import SwiftUI

struct FilesPanel: View {
    @Environment(\.windowContext) private var windowContext
    @Environment(\.theme) private var theme
    @EnvironmentObject private var files: FilesModel
    @EnvironmentObject private var editor: EditorModel
    @EnvironmentObject private var workspace: WorkspaceModel

    var body: some View {
        VStack(spacing: 0) {
            head
            ScrollView {
                LazyVStack(spacing: 0) {
                    if files.multiRoot {
                        // Several workspace folders: each is a top-level row, its contents one level in.
                        ForEach(files.roots, id: \.self) { rootPath in
                            folderRootRow(rootPath)
                            if files.expanded.contains(rootPath) {
                                rows(in: rootPath, depth: 1)
                            }
                        }
                    } else if let rootPath = files.roots.first {
                        rows(in: rootPath, depth: 0)
                    }
                }
                .padding(.top, 4)
            }
            .scrollIndicators(.never)
        }
    }

    private var head: some View {
        let layout = Self.headLayout(title.uppercased())
        return VStack(spacing: 0) {
            HStack(spacing: 2) {
                Text(layout.title)
                    .font(PageFont.font(11, weight: .semibold))
                    .tracking(0.66)
                    .foregroundStyle(theme.ink("--text-dim"))
                    .lineLimit(1)
                    .truncationMode(.tail)
                    // 11-point text with the normal line height: WebKit sets it half a point lower (measured).
                    .offset(y: 0.5)
                Spacer(minLength: 0)
                headButton("plus", size: 14, width: layout.buttons[0])
                // Locate the open file: off until a file is shown, as in the current app.
                headButton("locate", size: 14, width: layout.buttons[1],
                           disabled: editor.file == nil || editor.diffActive)
                headButton("chevron-up", size: 14, width: layout.buttons[2])
                headButton("refresh", size: 13, width: layout.buttons[3])
                headButton("x", size: 14, width: layout.buttons[4])
            }
            .padding(.leading, 12)
            .padding(.trailing, 6)
            .frame(maxHeight: .infinity)
            theme.color("--border-strong").frame(height: 1)
        }
        .frame(height: 34)
    }

    /// .icon-btn.small: the icon with 6 points on each side, 24 points tall.
    private func headButton(_ icon: String, size: CGFloat, width: CGFloat, disabled: Bool = false) -> some View {
        IconButton(width: width, height: 24, disabled: disabled, action: {}) {
            Icon(name: icon, size: size)
        }
    }

    private static let titleFont = PageFont.ui(11, weight: .semibold)
    private static let buttonWidths: [CGFloat] = [26, 26, 26, 25, 26]

    /// The heading's flex row: a title too long for it shrinks with the buttons, which stop at their 24-point
    /// min-width (FlexShrink); the title is then cut as WebKit cuts it, the hyphen kept ("ACME, DESIGN-...").
    static func headLayout(_ title: String) -> (title: String, buttons: [CGFloat]) {
        let titleWidth = ExactText.width(title, font: titleFont, tracking: 0.66)
        let available = ShellMetrics.filesWidth - ShellMetrics.border - 12 - 6
        let widths = FlexShrink.widths(
            bases: [titleWidth] + buttonWidths, maxes: [], mins: [0] + buttonWidths.map { min($0, 24) },
            fixed: 2 * 6, available: available
        )
        if widths[0] >= titleWidth {
            return (title, buttonWidths)
        }
        return (ExactText.cut(title, width: widths[0], font: titleFont, tracking: 0.66), Array(widths.dropFirst()))
    }

    /// The workspace's name ("acme, design-system"), or the folder's.
    private var title: String {
        workspace.name ?? files.roots.first.map { ($0 as NSString).lastPathComponent } ?? ""
    }

    /// The branch shown next to a repository folder (FileExplorer branchOf).
    private func branch(of dirPath: String) -> String? {
        let head = workspace.statuses[dirPath]?.head
        return head?.branch ?? head?.shortId
    }

    /// A workspace folder as a section header (.row.folder-root).
    private func folderRootRow(_ rootPath: String) -> some View {
        let isRepo = workspace.repo(at: rootPath) != nil
        let name = (rootPath as NSString).lastPathComponent
        let entry = DirEntry(name: name, isDir: true, ignored: false, isRepo: isRepo)
        return FileTreeRow(entry: entry, depth: 0, expanded: files.expanded.contains(rootPath),
                           tone: files.tones[rootPath], branch: isRepo ? branch(of: rootPath) : nil, folderRoot: true)
            .onTapGesture {
                Task { await files.toggle(rootPath) }
            }
    }

    private func rows(in dirPath: String, depth: Int) -> AnyView {
        AnyView(ForEach(files.entries(in: dirPath), id: \.self) { entry in
            let path = (dirPath as NSString).appendingPathComponent(entry.name)
            FileTreeRow(entry: entry, depth: depth, expanded: files.expanded.contains(path), tone: files.tones[path],
                        branch: entry.isRepo ? branch(of: path) : nil)
                .onTapGesture {
                    Task {
                        if entry.isDir {
                            await files.toggle(path)
                        } else {
                            // A single click opens the preview tab, as in the current app.
                            await windowContext?.editor.open(path, pin: false)
                        }
                    }
                }
                .simultaneousGesture(TapGesture(count: 2).onEnded {
                    if !entry.isDir {
                        windowContext?.editor.keep(path)
                    }
                })
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
    /// A repository folder's branch, 11-point --text-dim after its semibold name.
    var branch: String?
    /// A workspace folder's row with several folders: its name in 11-point bold capitals, 0.04em apart.
    var folderRoot = false

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
                .foregroundStyle(theme.ink(entry.ignored ? "--text-faint" : entry.isRepo ? "--accent" : "--text-dim"))
            Text(folderRoot ? entry.name.uppercased() : entry.name)
                .foregroundStyle(nameColor)
                .font(nameFont)
                .tracking(folderRoot ? 0.44 : 0)
                // 11-point capitals in a 13-point line: WebKit sets them half a point lower (measured).
                .offset(y: folderRoot ? 0.5 : 0)
                .lineLimit(1)
                .truncationMode(.tail)
                .overlay(alignment: .topLeading) {
                    // line-through in the name's color, 8.5 points down its 16-point line box, as on the Changes
                    // rows (SwiftUI's strikethrough sits half a point lower).
                    if tone == .deleted && !entry.isDir {
                        nameColor
                            .frame(width: ExactText.width(entry.name, font: PageFont.ui(13)), height: 1)
                            .offset(y: 8.5)
                    }
                }
            if let branch {
                Text(branch)
                    .font(PageFont.font(11))
                    .foregroundStyle(theme.ink("--text-dim"))
                    .lineLimit(1)
                    .truncationMode(.tail)
                    // 11-point text in a 13-point line: WebKit sets it half a point lower (measured).
                    .offset(y: 0.5)
            }
            Spacer(minLength: 0)
            marker
        }
        .font(.system(size: 13))
        .foregroundStyle(theme.ink("--text-dim"))
        .padding(.leading, 8 + CGFloat(depth) * 14)
        .padding(.trailing, 8)
        .frame(height: 24)
        .contentShape(Rectangle())
    }

    /// The page's CSS order: .row.repo 600, then .row.folder-root 700 (and 11 points), then .row.conflict 500.
    private var nameFont: Font {
        let repoWeight: NSFont.Weight = entry.isRepo ? .semibold : .regular
        let weight: NSFont.Weight = tone == .conflict ? .medium : folderRoot ? .bold : repoWeight
        return PageFont.font(folderRoot ? 11 : 13, weight: weight)
    }

    private var nameColor: Color {
        if entry.ignored {
            return theme.ink("--text-faint")
        }
        switch tone {
        case .modified:
            return theme.ink("--accent")
        case .added:
            return theme.ink("--success")
        case .conflict:
            return theme.ink("--danger")
        case .deleted:
            // 85% opacity in the current app, blended as WebKit does.
            return theme.over("--danger", 0.85, on: "--panel")
        case nil:
            return theme.ink("--text")
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
