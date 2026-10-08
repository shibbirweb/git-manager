// The editor's file tabs (src/lib/stores/tabs.ts): a single click opens (or replaces) the one preview tab, a
// double click or an explicit open keeps it; closing moves to the right neighbour, else the left one; a tab's
// label is its file name, with its folder when another tab has the same name. Paths are absolute.

import Foundation

public struct FileTab: Equatable, Sendable {
    public let path: String
    /// Shown in italics and replaced by the next single-click open.
    public var preview: Bool

    public init(path: String, preview: Bool) {
        self.path = path
        self.preview = preview
    }
}

public struct EditorTabs: Equatable, Sendable {
    public private(set) var tabs: [FileTab] = []
    public private(set) var active: String?

    public init(tabs: [FileTab] = [], active: String? = nil) {
        self.tabs = tabs
        self.active = active
    }

    /// Activates an existing tab (keeping it when `pin`), reuses the preview tab, or adds a tab after the active one.
    public mutating func open(_ path: String, pin: Bool) {
        if let index = tabs.firstIndex(where: { $0.path == path }) {
            if pin {
                tabs[index].preview = false
            }
            active = path
            return
        }
        let opened = FileTab(path: path, preview: !pin)
        if let previewIndex = tabs.firstIndex(where: \.preview) {
            tabs[previewIndex] = opened
        } else {
            let activeIndex = tabs.firstIndex { $0.path == active }
            tabs.insert(opened, at: activeIndex.map { $0 + 1 } ?? tabs.count)
        }
        active = path
    }

    /// A double click on a tab keeps it open.
    public mutating func keep(_ path: String) {
        if let index = tabs.firstIndex(where: { $0.path == path }) {
            tabs[index].preview = false
        }
    }

    public mutating func activate(_ path: String?) {
        active = path.flatMap { path in tabs.contains { $0.path == path } ? path : nil }
    }

    /// Closes `paths`; when the active tab goes, its right neighbour becomes active, else its left one.
    public mutating func close(_ paths: [String]) {
        let closing = Set(paths)
        let remaining = tabs.filter { !closing.contains($0.path) }
        if let active, closing.contains(active), let oldIndex = tabs.firstIndex(where: { $0.path == active }) {
            let right = tabs[(oldIndex + 1)...].first { !closing.contains($0.path) }
            let left = tabs[..<oldIndex].last { !closing.contains($0.path) }
            self.active = right?.path ?? left?.path
        }
        tabs = remaining
    }

    /// Each tab's name, and its folder's name when another tab shows a file of the same name.
    public static func labels(_ tabs: [FileTab]) -> [String: (name: String, hint: String?)] {
        func name(_ path: String) -> String {
            path.split(separator: "/", omittingEmptySubsequences: false).last.map(String.init) ?? path
        }
        var counts: [String: Int] = [:]
        for tab in tabs {
            counts[name(tab.path), default: 0] += 1
        }
        var labels: [String: (name: String, hint: String?)] = [:]
        for tab in tabs {
            let fileName = name(tab.path)
            guard (counts[fileName] ?? 0) > 1, let slash = tab.path.lastIndex(of: "/") else {
                labels[tab.path] = (fileName, nil)
                continue
            }
            let folder = String(tab.path[..<slash])
            let folderName = folder.split(separator: "/").last.map(String.init) ?? folder
            labels[tab.path] = (fileName, folderName.isEmpty ? (folder.isEmpty ? nil : folder) : folderName)
        }
        return labels
    }
}
