// The Command Palette's list (paletteList in src/lib/commands/registry.ts): without a query, recently used
// commands first, then the others alphabetically with disabled ones last; with one, every match, enabled first,
// best score first, recently used ones lifted a little. The commands and their state come from the current app's
// registry (Generated/PaletteCommands*.swift, written by gm-measure commands).

import Foundation

/// One command as the palette lists it: its state is the registry's for a window with a folder open.
public struct PaletteCommand: Sendable {
    public let id: String
    public let title: String
    /// The menu it lives in, with its submenus: "Git > Current File".
    public let category: String
    /// Written for macOS ("⇧⌘P"); nil without a shortcut.
    public let shortcut: String?
    public let enabled: Bool
    /// Check items only.
    public let checked: Bool?
    public let reason: String?
    /// Place of "category: title" in the page's alphabetical order (String.localeCompare), so ties sort the same.
    public let order: Int

    public init(
        id: String, title: String, category: String, shortcut: String?, enabled: Bool, checked: Bool?,
        reason: String?, order: Int
    ) {
        self.id = id
        self.title = title
        self.category = category
        self.shortcut = shortcut
        self.enabled = enabled
        self.checked = checked
        self.reason = reason
        self.order = order
    }

    /// The text a query matches: "Git > Current File: Show History".
    public var label: String {
        "\(category): \(title)"
    }
}

public struct PaletteItem: Equatable, Sendable {
    public let key: String
    public let commandId: String
    public let categoryParts: [TextPart]
    public let titleParts: [TextPart]
    public let shortcut: String?
    public let enabled: Bool
    public let checked: Bool?
    public let reason: String?
}

public enum Palette {
    /// A small lift for recently used commands, most for the latest, so they win close calls.
    static let recentBonus = 8.0

    public static func list(
        _ commands: [PaletteCommand], query: String, recent: [String]
    ) -> (recent: [PaletteItem], other: [PaletteItem]) {
        var ranks: [String: Int] = [:]
        for (index, commandId) in recent.enumerated() {
            ranks[commandId] = index
        }
        if Fuzzy.jsTrim(query).isEmpty {
            let recentItems = commands.filter { ranks[$0.id] != nil }
                .sorted { (ranks[$0.id] ?? 0) < (ranks[$1.id] ?? 0) }
            let other = commands.filter { ranks[$0.id] == nil }
                .sorted { $0.enabled != $1.enabled ? $0.enabled : $0.order < $1.order }
            return (recentItems.map { item($0, []) }, other.map { item($0, []) })
        }
        var matches: [(command: PaletteCommand, score: Double, indices: [Int])] = []
        for command in commands {
            guard let match = Fuzzy.match(query, command.label) else {
                continue
            }
            let bonus = ranks[command.id].map { recentBonus * (1 - Double($0) / Double(max(1, recent.count))) } ?? 0
            matches.append((command, match.score + bonus, match.indices))
        }
        matches.sort { first, second in
            if first.command.enabled != second.command.enabled {
                return first.command.enabled
            }
            if first.score != second.score {
                return first.score > second.score
            }
            return first.command.order < second.command.order
        }
        return ([], matches.map { item($0.command, $0.indices) })
    }

    static func item(_ command: PaletteCommand, _ indices: [Int]) -> PaletteItem {
        PaletteItem(
            key: command.id,
            commandId: command.id,
            categoryParts: SearchRows.highlight(command.category, indices, 0),
            titleParts: SearchRows.highlight(command.title, indices, command.category.unicodeScalars.count + 2),
            shortcut: command.shortcut,
            enabled: command.enabled,
            checked: command.checked,
            reason: command.reason
        )
    }
}
