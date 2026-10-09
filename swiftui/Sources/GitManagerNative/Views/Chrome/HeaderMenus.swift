// The header's folder and repository menus (Header.svelte workspaceMenu and repoPickerMenu) and the pill that opens
// one. The current app opens them at the click (contextMenu.open), so a pill pressed without the pointer
// (Accessibility) opens it where WebKit puts that click: WebKit hit-tests the button's center and clicks the center of
// the innermost element there, the pill's name (marked with menuPillTarget, MenuNav.simulatedClickPoint).
// Not built yet: recent folders, New Window, Open Folder in New Window, workspace files and Close Folder (their rows
// show and do nothing).

import AppKit
import NativeCore
import SwiftUI

/// A header pill that opens a context menu.
struct MenuPill<Label: View>: View {
    /// What Accessibility reads, as the page's button title.
    let title: String
    let items: () -> [MenuItem]
    @ViewBuilder let label: () -> Label

    @State private var pageFrame = CGRect.zero
    @State private var windowFrame = CGRect.zero
    @State private var targetFrame: CGRect?

    var body: some View {
        PillButton(action: open, label: label)
            .accessibilityLabel(title)
            .onPreferenceChange(MenuPillTargetKey.self) { targetFrame = $0 }
            .background(GeometryReader { proxy in
                let frames = [proxy.frame(in: .named(HeaderMenus.pageSpace)), proxy.frame(in: .global)]
                Color.clear
                    .onAppear { remember(frames) }
                    .onChange(of: frames) { remember($0) }
            })
    }

    private func remember(_ frames: [CGRect]) {
        pageFrame = frames[0]
        windowFrame = frames[1]
    }

    private func open() {
        let center = ContextMenuCenter.shared
        center.pageTop = windowFrame.minY - pageFrame.minY
        var point = MenuNav.simulatedClickPoint(targetFrame ?? pageFrame)
        // A click of the pointer opens it there; Accessibility presses come with no event of their own.
        if let event = NSApp.currentEvent, event.type == .leftMouseUp,
           ProcessInfo.processInfo.systemUptime - event.timestamp < 1,
           let height = event.window?.contentView?.bounds.height {
            let inWindow = CGPoint(x: event.locationInWindow.x, y: height - event.locationInWindow.y)
            if windowFrame.contains(inWindow) {
                point = CGPoint(x: inWindow.x.rounded(.down), y: (inWindow.y - center.pageTop).rounded(.down))
            }
        }
        center.open(items(), at: point)
    }
}

/// The frame of the part of a MenuPill that WebKit's simulated click lands on.
struct MenuPillTargetKey: PreferenceKey {
    static var defaultValue: CGRect?

    static func reduce(value: inout CGRect?, nextValue: () -> CGRect?) {
        value = value ?? nextValue()
    }
}

extension View {
    /// Marks the pill's name as where a press without the pointer clicks.
    func menuPillTarget() -> some View {
        background(GeometryReader { proxy in
            Color.clear.preference(key: MenuPillTargetKey.self, value: proxy.frame(in: .named(HeaderMenus.pageSpace)))
        })
    }
}

@MainActor
enum HeaderMenus {
    /// The coordinate space of the page: the window below the title bar, where menus and popups are placed.
    static let pageSpace = "page"

    static func folderMenu(chooseFolder: @escaping () -> Void) -> [MenuItem] {
        let workspace = WorkspaceModel.shared
        let model = AppModel.shared
        let roots = workspace.folders.map(\.root)
        var items: [MenuItem] = [
            .command("New Window") {},
            .command("Open Folder...", action: chooseFolder),
            .command("Open Folder in New Window...") {},
            .command("Open Workspace from File...") {},
            .command("Add Folder to Workspace...") {
                if let folderPath = pickFolder() {
                    Task {
                        await model.openFolders(roots + [folderPath])
                    }
                }
            },
            .command("Save Workspace to File...") {},
        ]
        if roots.count > 1 {
            items.append(.separator)
            for folder in workspace.folders {
                items.append(.command("Remove \"\(folder.name)\" from Workspace", hint: shortPath(folder.root)) {
                    Task {
                        await model.openFolders(roots.filter { $0 != folder.root })
                    }
                })
            }
        }
        items += [
            .separator,
            .command("Scan for Repositories") {
                Task {
                    await model.openFolders(roots)
                }
            },
            .command(roots.count > 1 ? "Close Workspace" : "Close Folder") {},
        ]
        return items
    }

    static func repoMenu() -> [MenuItem] {
        let workspace = WorkspaceModel.shared
        let model = AppModel.shared
        var items: [MenuItem] = workspace.repos.map { repo in
            let row = WorkspaceRules.repoMenuRow(repo, active: repo.root == model.repoPath,
                                                 changes: workspace.changeCount(repo.root))
            return .command(row.label, hint: row.hint) {
                Task {
                    await model.setActive(repo.root)
                }
            }
        }
        items += [
            .separator,
            .command("Scan for Repositories") {
                Task {
                    await model.openFolders(workspace.folders.map(\.root))
                }
            },
        ]
        return items
    }

    /// A path with /Users/<name> as "~" (recentEntries.ts shortPath).
    static func shortPath(_ path: String) -> String {
        path.replacingOccurrences(of: #"^/Users/[^/]+"#, with: "~", options: .regularExpression)
    }

    static func pickFolder() -> String? {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        return panel.runModal() == .OK ? panel.url?.path : nil
    }
}
