// The header's menus (Header.svelte workspaceMenu, repoPickerMenu and branchMenu), opened by MenuPill. Rows the native
// app cannot run yet (recent folders are not listed; New Window, Open Folder in New Window, workspace files, Close
// Folder and New Branch) say so in a toast.

import AppKit
import NativeCore
import SwiftUI

@MainActor
enum HeaderMenus {
    /// The coordinate space of the page: the window below the title bar, where menus and popups are placed.
    static let pageSpace = "page"

    static func folderMenu(chooseFolder: @escaping () -> Void) -> [MenuItem] {
        let workspace = WorkspaceModel.shared
        let model = AppModel.shared
        let roots = workspace.folders.map(\.root)
        var items: [MenuItem] = [
            notBuilt("New Window"),
            .command("Open Folder...", action: chooseFolder),
            notBuilt("Open Folder in New Window..."),
            notBuilt("Open Workspace from File..."),
            .command("Add Folder to Workspace...") {
                if let folderPath = pickFolder() {
                    Task {
                        await model.openFolders(roots + [folderPath])
                    }
                }
            },
            notBuilt("Save Workspace to File..."),
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
            notBuilt(roots.count > 1 ? "Close Workspace" : "Close Folder"),
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

    /// The branch pill's menu (branchMenu): New Branch..., then the local branches, the current one disabled.
    static func branchMenu() async -> [MenuItem] {
        let model = AppModel.shared
        guard let repoPath = model.repoPath else {
            return []
        }
        let refs = await Task.detached {
            try? Backend.call("get_refs", RepoArgs(repoPath: repoPath)) as BranchRefs
        }.value
        let branches: [MenuItem] = (refs?.local ?? []).map { branch in
            .command(branch.isHead ? "\(branch.name)  (current)" : branch.name, disabled: branch.isHead) {
                Task {
                    await model.run("Checkout", success: "Switched to \(branch.name)") { repoPath in
                        let args = CheckoutArgs(repoPath: repoPath, branchName: branch.name)
                        try Backend.perform("checkout_branch", args)
                    }
                }
            }
        }
        return [notBuilt("New Branch..."), .separator] + branches
    }

    /// A row the native app cannot run yet: it says so, as the Discard button does.
    static func notBuilt(_ label: String) -> MenuItem {
        .command(label) {
            let name = label.replacingOccurrences(of: "...", with: "")
            ToastCenter.shared.show(.info, "\(name) is not in the native app yet")
        }
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
