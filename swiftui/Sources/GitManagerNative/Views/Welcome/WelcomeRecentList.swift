// The Projects page with recent projects (Welcome.svelte .toolbar and .projects): the focused search field, Open,
// Clone and "...", 18 points above the list; a 56-point row per project (its colored initials badge, its name in
// 13.5-point semibold over its paths in 12-point --text-dim) 8 points wider than the page on each side, the selected
// one on --hover with its "..." button. The search field keeps the keys: arrows pick a project, Enter opens it,
// Escape clears the search, Delete forgets the project.

import AppKit
import NativeCore
import SwiftUI

struct WelcomeRecentList: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var store = RecentProjectsStore.shared
    @State private var query = ""
    @State private var selected = 0
    @State private var monitor: Any?

    var body: some View {
        let shown = WelcomeList.filter(RecentProjects.entries(store.lists), query: query)
        VStack(spacing: 0) {
            toolbar
                .padding(.bottom, 18)
            VStack(spacing: 0) {
                ForEach(Array(shown.enumerated()), id: \.element.key) { index, entry in
                    WelcomeProjectRow(entry: entry, selected: index == selected) {
                        selected = index
                    }
                }
                if shown.isEmpty && !query.isEmpty {
                    ExactText(text: "No recent project matches \"\(query)\".", size: 13)
                        .foregroundStyle(theme.ink("--text-dim"))
                        .padding(.vertical, 16)
                        .padding(.horizontal, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.horizontal, -8)
            Spacer(minLength: 0)
        }
        .onChange(of: query) { _ in selected = 0 }
        .onAppear { installKeys() }
        .onDisappear { removeKeys() }
    }

    private var toolbar: some View {
        HStack(spacing: 10) {
            searchField
            ToolbarButton(title: "Open") {
                if let folderPath = HeaderMenus.pickFolder() {
                    Task {
                        await AppModel.shared.openFolder(folderPath)
                    }
                }
            }
            ToolbarButton(title: "Clone") { CloneCenter.shared.open() }
            MenuButton(size: 32, iconSize: 15) {
                [.command("Open Workspace from File...") { AppModel.shared.pickAndOpenWorkspaceFile() },
                 WelcomeActions.notBuiltItem("Open Folder in New Window...")]
            }
        }
    }

    /// .search: 32 points tall, 12 in, the 15-point icon 8 points before the input; focused from the start, so its
    /// border is --accent with a 2-point ring of --accent at 25%.
    private var searchField: some View {
        HStack(spacing: 8) {
            Icon(name: "search", size: 15)
                .foregroundStyle(theme.ink("--text-dim"))
            ZStack(alignment: .topLeading) {
                if query.isEmpty {
                    ExactText(text: "Search projects", size: 13)
                        .foregroundStyle(Color(nsColor: Theme.parse(WebKitDefaults.placeholder) ?? .gray))
                        .frame(height: 30)
                    theme.ink("--text")
                        .frame(width: 2, height: 15.29)
                        .offset(y: 7.11)
                }
                SearchInput(text: $query, textColor: theme.textColor("--text"), caretColor: theme.textColor("--text"))
                    .frame(height: 30)
            }
        }
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity)
        .frame(height: 30)
        .background(RoundedRectangle(cornerRadius: 5, style: .circular).fill(theme.color("--editor-bg")))
        .padding(1)
        .borderRing(theme.color("--accent"), cornerRadius: 6)
        .background {
            RoundedRectangle(cornerRadius: 8, style: .circular)
                .fill(theme.over("--accent", 0.25, on: "--panel"))
                .padding(-2)
        }
    }

    // The search field's keys, as onSearchKeydown handles them.
    private func installKeys() {
        guard monitor == nil else {
            return
        }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            if SettingsStore.shared.dialogOpen || ContextMenuCenter.shared.visible {
                return event
            }
            let shown = WelcomeList.filter(RecentProjects.entries(store.lists), query: query)
            let keys: [UInt16: String] = [125: "ArrowDown", 126: "ArrowUp", 115: "Home", 119: "End"]
            if let key = keys[event.keyCode], key.hasPrefix("Arrow") || query.isEmpty,
               let next = WelcomeList.moveSelection(selected, key: key, count: shown.count) {
                selected = next
                return nil
            }
            let entry = selected < shown.count ? shown[selected] : nil
            switch event.keyCode {
            case 36, 76:
                if let entry {
                    WelcomeActions.open(entry)
                    return nil
                }
            case 53 where !query.isEmpty:
                query = ""
                return nil
            case 117 where query.isEmpty, 51 where query.isEmpty && event.modifierFlags.contains(.command):
                if let entry {
                    store.remove(entry)
                    return nil
                }
            default:
                break
            }
            return event
        }
    }

    private func removeKeys() {
        if let monitor {
            NSEvent.removeMonitor(monitor)
        }
        monitor = nil
    }
}

/// .toolbar .btn: 32 points tall, 16 points of padding inside a 1-point --border-strong ring (17 in all), 6-point
/// corners, on --panel.
private struct ToolbarButton: View {
    @Environment(\.theme) private var theme
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ExactText(text: title, size: 13)
                .foregroundStyle(theme.ink("--text"))
                .padding(.horizontal, 17)
                .frame(height: 32)
                .background(RoundedRectangle(cornerRadius: 6, style: .circular).fill(theme.color("--panel")))
                .borderRing(theme.color("--border-strong"), cornerRadius: 6)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}
