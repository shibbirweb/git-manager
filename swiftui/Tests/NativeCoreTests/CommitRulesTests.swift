// The commit box's rules, checked against what the current app's CommitBox.svelte and repoMenu.ts decide.

import NativeCore
import Testing

@Test func commitNeedsStagedFilesAndAMessage() {
    var state = CommitBoxState(stagedCount: 0, message: "Fix")
    #expect(CommitRules.disabledReason(state) == "Stage changes to commit")
    state.stagedCount = 2
    state.message = "  \n "
    #expect(CommitRules.disabledReason(state) == "Enter a commit message")
    #expect(!CommitRules.canCommit(state))
    state.message = "Fix the cart"
    #expect(CommitRules.canCommit(state))
    #expect(CommitRules.buttonHelp(state, keys: "⌘↩") == "Commit (⌘↩)")
    state.conflictCount = 1
    #expect(CommitRules.disabledReason(state) == "Resolve conflicts before committing")
}

@Test func busyAndLoadingTurnTheButtonOff() {
    var state = CommitBoxState(stagedCount: 1, message: "Fix", busy: true)
    #expect(CommitRules.disabledReason(state) == nil)
    #expect(!CommitRules.canCommit(state))
    #expect(!CommitRules.amendEnabled(state))
    state.busy = false
    state.loadingMessage = true
    #expect(!CommitRules.canCommit(state))
}

@Test func amendMayCommitWithoutStagedFilesOrMessage() {
    let state = CommitBoxState(stagedCount: 0, amend: true)
    #expect(CommitRules.canCommit(state))
    #expect(CommitRules.summary(state) == "Amend message only")
    #expect(CommitRules.buttonTitle(state) == "Amend Commit")
    #expect(!CommitRules.amendEnabled(CommitBoxState(stagedCount: 0, unborn: true)))
}

@Test func summaryCountsStagedAndConflictedFiles() {
    #expect(CommitRules.summary(CommitBoxState(stagedCount: 0)) == "Nothing staged")
    #expect(CommitRules.summary(CommitBoxState(stagedCount: 1)) == "1 file staged")
    #expect(CommitRules.summary(CommitBoxState(stagedCount: 3)) == "3 files staged")
    #expect(CommitRules.summary(CommitBoxState(stagedCount: 3, conflictCount: 2)) == "2 conflicted files")
    #expect(CommitRules.buttonTitle(CommitBoxState(stagedCount: 1)) == "Commit")
}

@Test func theHeadingsCommitButtonPlans() {
    let clean = CommitBoxState(stagedCount: 0, unstagedCount: 0)
    #expect(CommitRules.plan(clean, trackedCount: 0) == .blocked("There are no changes to commit"))
    let staged = CommitBoxState(stagedCount: 1, unstagedCount: 2)
    #expect(CommitRules.plan(staged, trackedCount: 1) == .focus)
    var typed = staged
    typed.message = "Fix"
    #expect(CommitRules.plan(typed, trackedCount: 1) == .commit(amend: false))
    var unstagedOnly = CommitBoxState(stagedCount: 0, unstagedCount: 2, message: "Fix")
    #expect(CommitRules.plan(unstagedOnly, trackedCount: 1) == .confirmAll)
    #expect(CommitRules.plan(unstagedOnly, trackedCount: 0) == .blocked("Stage the new files to commit them"))
    unstagedOnly.amend = true
    unstagedOnly.unborn = true
    #expect(CommitRules.plan(unstagedOnly, trackedCount: 0) == .blocked("There is no commit to amend yet"))
}

@Test func amendFillsOnlyABlankBox() {
    #expect(CommitRules.amendPrefill(message: " ", headMessage: "Fix the cart\n\nBody\n\n") == "Fix the cart\n\nBody")
    #expect(CommitRules.amendPrefill(message: "typed", headMessage: "Fix") == nil)
}

@Test func toastsLastByKindAndTheBellCountsAlerts() {
    #expect(Notices.timeout(.error, hasAction: false) == 9)
    #expect(Notices.timeout(.warning, hasAction: false) == 6)
    #expect(Notices.timeout(.success, hasAction: false) == 3.5)
    #expect(Notices.timeout(.success, hasAction: true) == 8)
    #expect(Notices.countsAsAlert(.error) && Notices.countsAsAlert(.warning))
    #expect(!Notices.countsAsAlert(.success) && !Notices.countsAsAlert(.info))
    #expect(Notices.badgeText(0) == "")
    #expect(Notices.badgeText(7) == "7")
    #expect(Notices.badgeText(120) == "99+")
    #expect(Notices.detail("  \n") == nil)
    #expect(Notices.detail(" fatal: no\n") == "fatal: no")
}
