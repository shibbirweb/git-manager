// The conflicts dialog's wording (src/lib/merge/ConflictsDialog.svelte): what each side did to a file, and the
// operation's name on the Continue button.

import Foundation

public enum ConflictLabels {
    /// "Added", "Deleted" or "Modified" for one side of a conflict of `kind` (bothModified, bothAdded,
    /// deletedByUs, deletedByThem).
    public static func sideStatus(kind: String, side: MergeSide) -> String {
        if kind == "bothAdded" {
            return "Added"
        }
        if (kind == "deletedByUs" && side == .ours) || (kind == "deletedByThem" && side == .theirs) {
            return "Deleted"
        }
        return "Modified"
    }

    public static func opLabel(_ kind: String) -> String {
        switch kind {
        case "merge":
            return "Merge"
        case "rebase":
            return "Rebase"
        case "cherryPick":
            return "Cherry-Pick"
        case "revert":
            return "Revert"
        default:
            return "Operation"
        }
    }

    /// A path split for its row: the file name, and the folder (nil at the top level).
    public static func split(_ conflictPath: String) -> (name: String, folder: String?) {
        guard let slash = conflictPath.lastIndex(of: "/") else {
            return (conflictPath, nil)
        }
        return (String(conflictPath[conflictPath.index(after: slash)...]), String(conflictPath[..<slash]))
    }

    /// The selection after a click (ConflictsDialog.svelte select): Cmd toggles a row, Shift takes the run from the
    /// anchor, a plain click picks one. Returns the selected paths and the new anchor.
    public static func select(
        _ conflictPath: String, in paths: [String], selected: [String], anchor: String?, command: Bool, shift: Bool
    ) -> (selected: [String], anchor: String?) {
        if command {
            let next = selected.contains(conflictPath)
                ? selected.filter { $0 != conflictPath }
                : selected + [conflictPath]
            return (next, conflictPath)
        }
        if shift, let anchor, let from = paths.firstIndex(of: anchor), let to = paths.firstIndex(of: conflictPath) {
            return (Array(paths[min(from, to)...max(from, to)]), anchor)
        }
        return ([conflictPath], conflictPath)
    }
}
