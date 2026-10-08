// What the commit box and the Changes heading's Commit (check) button allow, as the current app decides it
// (src/lib/views/changes/CommitBox.svelte and repoMenu.ts commitBlocked, commitPlan).

import Foundation

/// The repository and commit box as the commit controls see them.
public struct CommitBoxState: Sendable, Equatable {
    public var stagedCount: Int
    public var unstagedCount: Int
    public var conflictCount: Int
    public var message: String
    public var amend: Bool
    public var busy: Bool
    /// HEAD's message is being read for Amend.
    public var loadingMessage: Bool
    /// A fresh repository: there is no commit to amend yet.
    public var unborn: Bool

    public init(
        stagedCount: Int, unstagedCount: Int = 0, conflictCount: Int = 0, message: String = "", amend: Bool = false,
        busy: Bool = false, loadingMessage: Bool = false, unborn: Bool = false
    ) {
        self.stagedCount = stagedCount
        self.unstagedCount = unstagedCount
        self.conflictCount = conflictCount
        self.message = message
        self.amend = amend
        self.busy = busy
        self.loadingMessage = loadingMessage
        self.unborn = unborn
    }

    /// A message of only spaces is no message, as in git.
    public var messageBlank: Bool {
        message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

/// What the Commit (check) button in the heading does.
public enum CommitPlan: Equatable, Sendable {
    case blocked(String)
    /// No message yet: the button puts the cursor in the message box.
    case focus
    case commit(amend: Bool)
    /// Nothing staged but tracked changes: the current app asks to commit them all.
    case confirmAll
}

public enum CommitRules {
    /// Why the Commit button is off, or nil when it may commit (busy aside).
    public static func disabledReason(_ state: CommitBoxState) -> String? {
        if state.conflictCount > 0 {
            return "Resolve conflicts before committing"
        }
        if !state.amend && state.stagedCount == 0 {
            return "Stage changes to commit"
        }
        if !state.amend && state.messageBlank {
            return "Enter a commit message"
        }
        return nil
    }

    public static func canCommit(_ state: CommitBoxState) -> Bool {
        disabledReason(state) == nil && !state.busy && !state.loadingMessage
    }

    /// The Amend checkbox: off before the first commit and while anything runs.
    public static func amendEnabled(_ state: CommitBoxState) -> Bool {
        !state.unborn && !state.busy
    }

    /// The text between Amend and the buttons.
    public static func summary(_ state: CommitBoxState) -> String {
        if state.conflictCount > 0 {
            return state.conflictCount == 1 ? "1 conflicted file" : "\(state.conflictCount) conflicted files"
        }
        if state.stagedCount == 0 {
            return state.amend ? "Amend message only" : "Nothing staged"
        }
        return state.stagedCount == 1 ? "1 file staged" : "\(state.stagedCount) files staged"
    }

    public static func buttonTitle(_ state: CommitBoxState) -> String {
        state.amend ? "Amend Commit" : "Commit"
    }

    /// The Commit button's tooltip: why it is off, or what it does.
    public static func buttonHelp(_ state: CommitBoxState, keys: String) -> String {
        disabledReason(state) ?? "Commit (\(keys))"
    }

    /// Why the heading's Commit (check) button cannot run, or nil.
    public static func blocked(_ state: CommitBoxState) -> String? {
        if state.conflictCount > 0 {
            return "Resolve conflicts before committing"
        }
        if state.amend {
            return state.unborn ? "There is no commit to amend yet" : nil
        }
        return state.stagedCount == 0 && state.unstagedCount == 0 ? "There are no changes to commit" : nil
    }

    /// The heading's Commit (check) button.
    public static func plan(_ state: CommitBoxState, trackedCount: Int) -> CommitPlan {
        if let reason = blocked(state) {
            return .blocked(reason)
        }
        if state.messageBlank {
            return .focus
        }
        if state.amend || state.stagedCount > 0 {
            return .commit(amend: state.amend)
        }
        if trackedCount > 0 {
            return .confirmAll
        }
        return .blocked("Stage the new files to commit them")
    }

    /// What Amend puts in the box: HEAD's message when the box is blank, without its trailing newlines.
    public static func amendPrefill(message: String, headMessage: String) -> String? {
        let blank = message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        guard blank else {
            return nil
        }
        var text = headMessage
        while let last = text.last, last.isWhitespace {
            text.removeLast()
        }
        return text
    }
}
