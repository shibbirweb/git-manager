// One recent project on the welcome screen (Welcome.svelte .row): 12 points in, the 36-point badge (its initials in
// 13-point bold --accent-text on a 135-degree gradient of the badge color's bright and plain terminal colors, each
// mixed with --term-black), 14 points before the name and the paths, each cut with an ellipsis; the "..." menu
// button 10 points from the right shows on the selected row. What the rows and their menus do (WelcomeActions).

import AppKit
import NativeCore
import SwiftUI

struct WelcomeProjectRow: View {
    @Environment(\.theme) private var theme
    @Environment(\.windowContext) private var windowContext
    @State private var textWidth: CGFloat = 0

    let entry: RecentEntry
    let selected: Bool
    /// The pointer came over the row: it becomes the selected one (onmouseenter).
    let hover: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            Button {
                WelcomeActions.open(entry, in: windowContext)
            } label: {
                HStack(spacing: 14) {
                    badge
                    VStack(alignment: .leading, spacing: 3) {
                        let nameFont = PageFont.ui(13.5, weight: .semibold)
                        ExactText(text: ExactText.cut(entry.label, width: textWidth, font: nameFont), size: 13.5,
                                  weight: .semibold)
                            .foregroundStyle(theme.ink("--text"))
                        ExactText(text: ExactText.cut(entry.subtitle, width: textWidth, font: PageFont.ui(12)),
                                  size: 12)
                            .foregroundStyle(theme.ink("--text-dim"))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(GeometryReader { proxy in
                        Color.clear
                            .onAppear { textWidth = proxy.size.width }
                            .onChange(of: proxy.size.width) { textWidth = $0 }
                    })
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .frame(minHeight: 56)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(entry.label)
            MenuButton(size: 30, iconSize: 16) { WelcomeActions.items(entry, in: windowContext) }
                .opacity(selected ? 1 : 0)
                .allowsHitTesting(selected)
                .padding(.trailing, 10)
        }
        .background(RoundedRectangle(cornerRadius: 8, style: .circular)
            .fill(selected ? theme.solid("--hover", on: "--panel") : .clear))
        .pageHover { inside in
            if inside {
                hover()
            }
        }
    }

    private var badge: some View {
        let color = WelcomeList.badgeColor(entry.key)
        return ExactText(text: WelcomeList.initials(entry.label), size: 13, weight: .bold, tracking: 0.39)
            .foregroundStyle(theme.ink("--accent-text"))
            .frame(width: 36, height: 36)
            .background(RoundedRectangle(cornerRadius: 8, style: .circular).fill(LinearGradient(
                colors: [theme.mix("--term-bright-\(color)", 0.88, "--term-black"),
                         theme.mix("--term-\(color)", 0.72, "--term-black")],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )))
    }
}

/// An icon button with "..." that opens a context menu where it was pressed (its center without the pointer).
struct MenuButton: View {
    @Environment(\.windowContext) private var windowContext
    @State private var pageFrame = CGRect.zero

    let size: CGFloat
    let iconSize: CGFloat
    let items: () -> [MenuItem]

    var body: some View {
        IconButton(width: size, height: size, action: open) {
            Icon(name: "more", size: iconSize)
        }
        .accessibilityLabel("More actions")
        .background(GeometryReader { proxy in
            let frame = proxy.frame(in: .named(HeaderMenus.pageSpace))
            Color.clear
                .onAppear { pageFrame = frame }
                .onChange(of: frame) { pageFrame = $0 }
        })
    }

    private func open() {
        windowContext?.menus.open(items(), at: MenuNav.simulatedClickPoint(pageFrame))
    }
}

/// What a recent project does when opened, and its menu (Welcome.svelte entryItems).
@MainActor
enum WelcomeActions {
    static func open(_ entry: RecentEntry, in context: WindowContext?) {
        guard let model = context?.app else {
            return
        }
        switch entry.kind {
        case .folder(let folderPath):
            Task {
                await model.openFolder(folderPath)
            }
        case .workspace(let folderPaths):
            Task {
                await model.openFolders(folderPaths)
            }
        case .workspaceFile(let filePath):
            Task {
                await model.openWorkspaceFile(filePath)
            }
        }
    }

    static func items(_ entry: RecentEntry, in context: WindowContext?) -> [MenuItem] {
        let paths = entry.paths
        var items: [MenuItem] = [
            .command("Open") { open(entry, in: context) },
            .command("Open in New Window") { openInNewWindow(entry, from: context) },
            .separator,
        ]
        if paths.count == 1 {
            items.append(.command("Reveal in Finder") {
                NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: paths[0])])
            })
        }
        items += [
            .command(paths.count == 1 ? "Copy Path" : "Copy Paths") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(paths.joined(separator: "\n"), forType: .string)
                context?.toasts.show(.success, "Path copied")
            },
            .separator,
            .command("Remove from Recent Projects") { RecentProjectsStore.shared.remove(entry) },
        ]
        return items
    }

    /// A recent project in a new window (repoPicker.ts openRecentInNewWindow), or the window showing it already.
    static func openInNewWindow(_ entry: RecentEntry, from context: WindowContext?) {
        switch entry.kind {
        case .folder(let folderPath):
            WindowOpener.openNew(folders: [folderPath], from: context)
        case .workspace(let folderPaths):
            WindowOpener.openNew(folders: folderPaths, from: context)
        case .workspaceFile(let filePath):
            WindowOpener.openNew(workspaceFile: filePath, from: context)
        }
    }

    static func notBuilt(_ action: String, in context: WindowContext?) {
        context?.toasts.show(.info, "\(action) is not in the native app yet")
    }
}
