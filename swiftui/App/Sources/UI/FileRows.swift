// The Changes list's group headers and file rows (src/lib/views/changes/RepoSection.svelte, FileRow.svelte), measured
// in swiftui/Reference/changes-<mode>/group-headers.json and file-rows.json.

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

    /// The branch button's markers: * for changes, + for staged files, ! for conflicts.
    var decorations: String {
        (unstaged.isEmpty ? "" : "*") + (staged.isEmpty ? "" : "+") + (conflicts.isEmpty ? "" : "!")
    }
}

/// "Staged 1": a 13-point chevron, the semibold label and the dim count; 26 points tall.
struct GroupHeader: View {
    @Environment(\.theme) private var theme

    let title: String
    let count: Int

    var body: some View {
        HStack(spacing: 5) {
            Icon(name: "chevron-down", size: 13)
            Text(title)
                .font(.system(size: 13, weight: .semibold))
            Text("\(count)")
                .font(.system(size: 12))
                .foregroundStyle(theme.color("--text-dim"))
            Spacer(minLength: 0)
        }
        .padding(.leading, 8)
        .padding(.trailing, 10)
        .frame(height: 26)
    }
}

/// One file: its status letter, name and folder; 24 points tall, 28 points in.
struct FileRow: View {
    @Environment(\.theme) private var theme

    let file: FileStatus
    /// The change shown in this group: the staged one in Staged, the unstaged one in Changes.
    let kind: String?

    var body: some View {
        let parts = Self.split(file.path)
        HStack(spacing: 8) {
            Text(Self.letter(kind))
                .font(.custom("JetBrains Mono", size: 11.5).weight(.bold))
                .foregroundStyle(letterColor)
                .opacity(kind == "deleted" ? 0.8 : 1)
                .frame(width: 12)
            HStack(spacing: 6) {
                // The name, then the space the page puts between the two spans (13-point, not struck through).
                Text(parts.name)
                    .foregroundColor(kind == "deleted" ? theme.color("--text-dim") : theme.color("--text"))
                    .strikethrough(kind == "deleted", color: theme.color("--text-faint"))
                    + Text(parts.directory.isEmpty ? "" : " ")
                if !parts.directory.isEmpty {
                    Text(parts.directory)
                        .font(.system(size: 12))
                        .foregroundStyle(theme.color("--text-dim"))
                }
            }
            .lineLimit(1)
            .truncationMode(.tail)
            Spacer(minLength: 0)
        }
        .font(.system(size: 13))
        .padding(.leading, 28)
        .padding(.trailing, 6)
        .frame(height: 24)
    }

    private var letterColor: Color {
        switch kind {
        case "added":
            return theme.color("--success")
        case "modified", "typechange":
            return theme.color("--accent")
        case "deleted":
            return theme.color("--danger")
        case "renamed":
            return theme.color("--tok-property")
        case "untracked":
            return theme.mix("--success", 0.6, "--text-faint")
        default:
            return theme.color("--danger")
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
