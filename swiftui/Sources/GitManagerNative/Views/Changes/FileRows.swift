// The Changes list's group headers and file rows (src/lib/views/changes/RepoSection.svelte, FileRow.svelte), measured
// in swiftui/Reference/changes-<mode>/group-headers.json and file-rows.json.

import AppKit
import SwiftUI

/// The staged and unstaged files of a status, as the Changes list groups them.
struct FileGroups {
    let staged: [FileStatus]
    let unstaged: [FileStatus]
    let conflicts: [FileStatus]

    init(_ files: [FileStatus]) {
        let sorted = files.sorted { $0.path < $1.path }
        conflicts = sorted.filter(\.conflicted)
        staged = sorted.filter { !$0.conflicted && $0.staged != nil }
        unstaged = sorted.filter { !$0.conflicted && $0.unstaged != nil }
    }

    var isEmpty: Bool {
        staged.isEmpty && unstaged.isEmpty && conflicts.isEmpty
    }

    /// The branch button's markers: * for changes, + for staged files, ! for conflicts.
    var decorations: String {
        (unstaged.isEmpty ? "" : "*") + (staged.isEmpty ? "" : "+") + (conflicts.isEmpty ? "" : "!")
    }
}

/// "Staged 1": a 13-point chevron, the semibold label and the dim count; 26 points tall. On hover it shows
/// --hover and its actions (Unstage all; Discard all and Stage all), which are off while a write runs.
struct GroupHeader: View {
    @Environment(\.theme) private var theme
    @State private var hovered = false

    let title: String
    let count: Int
    var actions: [RowAction] = []
    var busy = false

    var body: some View {
        HStack(spacing: 0) {
            HStack(spacing: 5) {
                Icon(name: "chevron-down", size: 13)
                ExactText(text: title, size: 13, weight: .semibold)
                ExactText(text: "\(count)", size: 12)
                    .foregroundStyle(theme.ink("--text-dim"))
                Spacer(minLength: 0)
            }
            // The toggle's own 4 points, then the header's gap of 4 before the actions.
            .padding(.trailing, 4)
            if hovered && !actions.isEmpty {
                RowActions(actions: actions, disabled: busy, surface: "--hover")
                    .padding(.leading, 4)
            }
        }
        .padding(.leading, 8)
        .padding(.trailing, 6)
        .frame(height: 26)
        .background(hovered ? theme.color("--hover") : Color.clear)
        .contentShape(Rectangle())
        .onHover { hovered = $0 }
    }
}

/// A row's or a group header's buttons (Discard, Stage, Unstage): 20 x 20 with 4-point corners, 1 point apart.
struct RowAction {
    let icon: String
    let title: String
    var danger = false
    let run: () -> Void
}

struct RowActions: View {
    let actions: [RowAction]
    var disabled = false
    /// What the buttons sit on, for the disabled look (40% opacity, drawn as the solid color WebKit blends).
    var surface = "--hover"

    var body: some View {
        HStack(spacing: 1) {
            ForEach(actions, id: \.title) { action in
                RowActionButton(action: action, disabled: disabled, surface: surface)
            }
        }
    }
}

private struct RowActionButton: View {
    @Environment(\.theme) private var theme
    @State private var hovered = false

    let action: RowAction
    let disabled: Bool
    let surface: String

    var body: some View {
        let active = hovered && !disabled
        Button(action: action.run) {
            Icon(name: action.icon, size: 13)
                .frame(width: 20, height: 20)
                .background(
                    RoundedRectangle(cornerRadius: 4, style: .circular)
                        .fill(active ? theme.color("--border-strong") : .clear)
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .allowsHitTesting(!disabled)
        .foregroundStyle(color(active: active))
        .help(action.title)
        .onHover { hovered = $0 }
    }

    private func color(active: Bool) -> Color {
        if disabled {
            return theme.over("--text-dim", 0.4, on: surface)
        }
        if active {
            return theme.ink(action.danger ? "--danger" : "--text")
        }
        return theme.ink("--text-dim")
    }
}

/// One file: its status letter, name and folder; 24 points tall, 28 points in. On hover it shows --hover (unless
/// selected) and its actions at the right end.
struct FileRow: View {
    @Environment(\.theme) private var theme
    @State private var hovered = false

    let file: FileStatus
    /// The change shown in this group: the staged one in Staged, the unstaged one in Changes.
    let kind: String?
    var selected = false
    var actions: [RowAction] = []

    var body: some View {
        content
            .background(background)
            .contentShape(Rectangle())
            .onHover { hovered = $0 }
    }

    /// .row.selected comes after .row:hover in the page's CSS, so a selected row keeps its color under the mouse.
    private var background: Color {
        if selected {
            return theme.color("--selected-inactive")
        }
        return hovered ? theme.color("--hover") : .clear
    }

    @ViewBuilder
    private var content: some View {
        let parts = Self.split(file.path)
        HStack(spacing: 8) {
            Text(Self.letter(kind))
                .font(Font(NSFont(name: "JetBrainsMono-Regular_Bold", size: 11.5) ?? .boldSystemFont(ofSize: 11.5)))
                .foregroundStyle(letterColor)
                .frame(width: 12)
            // One text line on the page: the smaller folder name sits on the file name's baseline.
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                // The name, then the space the page puts between the two spans (13-point, not struck through).
                let name = parts.name + (parts.directory.isEmpty ? "" : " ")
                // The color as a style on the view: Text's own foregroundColor dithered --text-dim (measured).
                Text(name)
                    .foregroundStyle(kind == "deleted" ? theme.ink("--text-dim") : theme.ink("--text"))
                    .exactWidth(ExactText.width(name, font: .systemFont(ofSize: 13)))
                    .overlay(alignment: .topLeading) {
                        // line-through: 1 point thick, 8.5 points down the 16-point line box (measured), across
                        // the name only; SwiftUI's strikethrough sits half a point lower.
                        if kind == "deleted" {
                            theme.color("--text-faint")
                                .frame(width: ExactText.width(parts.name, font: .systemFont(ofSize: 13)), height: 1)
                                .offset(y: 8.5)
                        }
                    }
                if !parts.directory.isEmpty {
                    ExactText(text: parts.directory, size: 12)
                        .foregroundStyle(theme.ink("--text-dim"))
                }
            }
            .lineLimit(1)
            .truncationMode(.tail)
            Spacer(minLength: 0)
            if hovered && !actions.isEmpty {
                RowActions(actions: actions, surface: selected ? "--selected-inactive" : "--hover")
            }
        }
        .font(.system(size: 13))
        .padding(.leading, 28)
        .padding(.trailing, 6)
        .frame(height: 24)
    }

    private var letterColor: Color {
        switch kind {
        case "added":
            return theme.ink("--success")
        case "modified", "typechange":
            return theme.ink("--accent")
        case "deleted":
            // 80% opacity in the current app, blended as WebKit does.
            return theme.over("--danger", 0.8, on: "--panel")
        case "renamed":
            return theme.ink("--tok-property")
        case "untracked":
            return theme.mix("--success", 0.6, "--text-faint")
        default:
            return theme.ink("--danger")
        }
    }

    static func letter(_ kind: String?) -> String {
        let letters = [
            "added": "A", "modified": "M", "deleted": "D", "renamed": "R", "typechange": "T", "untracked": "U",
        ]
        return kind.flatMap { letters[$0] } ?? "C"
    }

    static func split(_ filePath: String) -> (name: String, directory: String) {
        guard let slash = filePath.lastIndex(of: "/") else {
            return (filePath, "")
        }
        return (String(filePath[filePath.index(after: slash)...]), String(filePath[..<slash]))
    }
}
