// The selection after a refresh and the paths sent to unstage, as the current app's sections.ts and
// fileStatus.ts work them out; and the commit toast's Undo plan (undoPlan.ts).

import NativeCore
import Testing

private let rows = ChangeSelection.rows(staged: ["src/cart.ts", "src/shipping.ts"], unstaged: ["src/wishlist.ts"])

@Test func aStagedFileKeepsItsSelectionInTheOtherGroup() {
    #expect(rows.count == 3)
    #expect(rows[0] == ChangeRow(path: "src/cart.ts", staged: true))
    let before = ChangeRow(path: "src/cart.ts", staged: false)
    #expect(ChangeSelection.follow(before, rows: rows, lastIndex: 2) == ChangeRow(path: "src/cart.ts", staged: true))
    let same = ChangeRow(path: "src/wishlist.ts", staged: false)
    #expect(ChangeSelection.follow(same, rows: rows, lastIndex: 0) == same)
}

@Test func aVanishedFileHandsTheSelectionToItsPlace() {
    let gone = ChangeRow(path: "src/legacy.ts", staged: false)
    #expect(ChangeSelection.follow(gone, rows: rows, lastIndex: 1) == rows[1])
    #expect(ChangeSelection.follow(gone, rows: rows, lastIndex: 9) == rows[2])
    #expect(ChangeSelection.follow(gone, rows: [], lastIndex: 0) == nil)
    #expect(ChangeSelection.follow(nil, rows: rows, lastIndex: 0) == nil)
}

@Test func unstagingARenameSendsBothPaths() {
    let paths = ChangeSelection.unstagePaths([
        (path: "src/new.ts", origPath: "src/old.ts"),
        (path: "a.txt", origPath: nil),
        (path: "src/old.ts", origPath: nil),
    ])
    #expect(paths == ["src/new.ts", "src/old.ts", "a.txt"])
}

private func move(_ action: String, old: String = "aaaa1111", new: String = "bbbb2222") -> ReflogMove {
    ReflogMove(action: action, oldId: old, newId: new, oldShortId: String(old.prefix(7)), detail: "Fix the cart")
}

@Test func undoTakesBackOnlyTheActionItWasMadeFor() {
    let commit = CommitUndo.plan(expected: "commit", last: move("commit"), branch: "main", pushed: false)
    guard case .undo(let undo) = commit else {
        Issue.record("expected an undo, got \(commit)")
        return
    }
    #expect(undo.title == "Undo Commit" && undo.success == "Commit undone")
    #expect(undo.headId == "bbbb2222" && undo.commitId == "aaaa1111")
    #expect(undo.question == "Undo the commit \"Fix the cart\" on main? Its changes stay staged.")

    let amend = CommitUndo.plan(expected: "amend", last: move("amend"), branch: nil, pushed: true)
    guard case .undo(let undoAmend) = amend else {
        Issue.record("expected an undo, got \(amend)")
        return
    }
    #expect(undoAmend.pushed && undoAmend.success == "Amend undone")
    #expect(undoAmend.question.hasPrefix("Put HEAD back to the commit before the amend (aaaa111)?"))

    let changed = CommitUndo.plan(expected: "commit", last: move("checkout"), branch: "main", pushed: false)
    #expect(changed == .refuse("Nothing to undo", "The repository changed since then."))
}

@Test func someCommitsCannotBeUndone() {
    let first = CommitUndo.plan(expected: "commit", last: move("initialCommit"), branch: "main", pushed: false)
    #expect(first == .refuse("The first commit cannot be undone", nil))
    let zero = CommitUndo.plan(expected: "commit", last: move("commit", old: "0000"), branch: "main", pushed: false)
    #expect(zero == .refuse("The first commit cannot be undone", nil))
    let still = CommitUndo.plan(expected: "commit", last: move("commit", new: "aaaa1111"), branch: nil, pushed: false)
    #expect(still == .refuse("The last action did not move HEAD", nil))
    let none = CommitUndo.plan(expected: "commit", last: nil, branch: nil, pushed: false)
    #expect(none == .refuse("Nothing to undo", nil))
}
