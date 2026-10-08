// The Undo button of the "Committed" and "Commit amended" toasts (src/lib/views/git/undoPlan.ts and
// undoActions.ts): it undoes only the action it was made for, and the undone changes stay staged.

import Foundation

/// One reflog entry, as the bridge's last_action returns it.
public struct ReflogMove: Decodable, Equatable, Sendable {
    public let action: String
    public let oldId: String
    public let newId: String
    public let oldShortId: String
    public let detail: String

    public init(action: String, oldId: String, newId: String, oldShortId: String, detail: String) {
        self.action = action
        self.oldId = oldId
        self.newId = newId
        self.oldShortId = oldShortId
        self.detail = detail
    }
}

public struct CommitUndo: Equatable, Sendable {
    public let title: String
    public let success: String
    public let headId: String
    public let commitId: String
    /// The commit is on a remote already: the current app asks first, as undoing rewrites published history.
    public let pushed: Bool
    public let question: String

    public enum Outcome: Equatable, Sendable {
        case undo(CommitUndo)
        /// An info toast instead: its title and detail.
        case refuse(String, String?)
    }

    /// The latest HEAD movement in, what the button does out. `expected` is "commit" or "amend".
    public static func plan(expected: String, last: ReflogMove?, branch: String?, pushed: Bool) -> Outcome {
        guard let last else {
            return .refuse("Nothing to undo", nil)
        }
        if last.oldId.allSatisfy({ $0 == "0" }) || last.action == "initialCommit" {
            return .refuse("The first commit cannot be undone", nil)
        }
        if last.oldId == last.newId {
            return .refuse("The last action did not move HEAD", nil)
        }
        guard last.action == expected else {
            return .refuse("Nothing to undo", "The repository changed since then.")
        }
        let place = branch ?? "HEAD"
        if expected == "amend" {
            let question = "Put \(place) back to the commit before the amend (\(last.oldShortId))? The amended "
                + "changes stay staged."
            return .undo(CommitUndo(
                title: "Undo Amend", success: "Amend undone", headId: last.newId, commitId: last.oldId,
                pushed: pushed, question: question
            ))
        }
        let question = "Undo the commit \"\(last.detail)\" on \(place)? Its changes stay staged."
        return .undo(CommitUndo(
            title: "Undo Commit", success: "Commit undone", headId: last.newId, commitId: last.oldId,
            pushed: pushed, question: question
        ))
    }
}
