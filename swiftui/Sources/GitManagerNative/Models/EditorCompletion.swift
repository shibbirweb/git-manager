// Code completion of one open file (features.ts completionExtension and @codemirror/autocomplete's plugin): the
// popup's state (NativeCore CompletionState) follows every transaction; pending sources are asked (the document's
// words here, the language's keywords, snippets and scope names in JavaScriptCore), their answers replayed over the
// edits made meanwhile and shown. The page waits 100 ms after a typed key before asking (activateOnTypingDelay);
// the native sources are asked at once, after the key's own paint, so the popup comes sooner. Ctrl+Space waits
// 50 ms as there. The keys (EditorCompletionKeys.swift) and snippet fields are handled here too.

import Foundation
import NativeCore

@MainActor
final class EditorCompletion {
    /// The words source's id; the language's sources are 0, 1, ... in the page's order, after the words.
    static let wordsSource = 1_000_000
    /// updateSyncTime: how long finished answers wait for the others before showing.
    static let syncDelay = 0.1

    weak var session: EditorSession?
    var state = CompletionState(sources: [wordsSource])
    /// The inserted snippet's fields while Tab moves through them.
    private(set) var snippet: ActiveSnippet?
    /// The popup's view follows these (EditorCompletionPopup).
    var changed: () -> Void = {}
    /// Settings > Editor: completion on, and on while typing.
    var enabled = true {
        didSet {
            if !enabled && state.isActive {
                send([.close])
            }
        }
    }

    /// How many sources the language has, learned from its first answer (one until then; none without a grammar).
    var languageSources = 0
    var running: [CompletionQuery] = []
    private var updateTimer: DispatchWorkItem?
    var acceptTimer: DispatchWorkItem?
    private var pendingStart = false
    var nextResultID = 1
    /// The snippet an accepted option starts, set by the transaction that inserts it.
    var startingSnippet: ActiveSnippet??

    init(hasGrammar: Bool, onTyping: Bool) {
        languageSources = hasGrammar ? 1 : 0
        state = CompletionState(sources: Self.sources(language: languageSources), activateOnTyping: onTyping)
    }

    /// The page asks the words first (its global language data comes before the language's own), so a word ties
    /// ahead of a snippet with the same label.
    static func sources(language: Int) -> [Int] {
        [wordsSource] + Array(0..<language)
    }

    var onTyping: Bool {
        get { state.activateOnTyping }
        set { state.activateOnTyping = newValue }
    }

    static func now() -> Double {
        Date().timeIntervalSince1970 * 1000
    }

    // MARK: - Following the editor

    /// After each transaction of the editor (EditorSession.apply).
    func follow(_ transaction: Transaction, editorState: EditorState) {
        if let starting = startingSnippet {
            snippet = starting
            startingSnippet = nil
        } else {
            snippet = ActiveSnippet.follow(snippet, transaction)
        }
        guard enabled else {
            return
        }
        let old = state
        state = state.update(transaction, state: editorState, now: Self.now())
        pluginUpdate([transaction], completionChanged: state != old, started: false)
        if state.open != old.open {
            changed()
        }
    }

    /// Completion's own effects in a transaction of their own (the keys, a finished query).
    func send(_ effects: [CompletionEffect]) {
        guard let editorState = session?.state else {
            return
        }
        let old = state
        state = state.update(nil, effects: effects, state: editorState, now: Self.now())
        let started = effects.contains { if case .start = $0 { return true } else { return false } }
        pluginUpdate([], completionChanged: state != old, started: started)
        if state.open != old.open {
            changed()
        }
    }

    func setSnippet(_ value: ActiveSnippet?) {
        snippet = value
    }

    /// The plugin's update: drops the queries a reset makes stale, keeps the edits for the others' replay, and
    /// asks the pending sources after the delay.
    private func pluginUpdate(_ transactions: [Transaction], completionChanged: Bool, started: Bool) {
        let moved = transactions.contains { $0.selection != nil || $0.docChanged }
        guard moved || completionChanged else {
            return
        }
        let doesReset = transactions.contains { transaction in
            let type = CompletionUpdate.of(transaction, activateOnTyping: state.activateOnTyping)
            return type.contains(.reset) || (transaction.selection != nil || transaction.docChanged)
                && type.intersection(.simpleInteraction).isEmpty
        }
        if doesReset {
            running.removeAll()
        } else {
            for query in running {
                query.updates += transactions
            }
        }
        updateTimer?.cancel()
        updateTimer = nil
        if started {
            pendingStart = true
        }
        let waiting = state.active.contains { active in
            active.isPending && !running.contains { $0.sources.contains(active.source) }
        }
        guard waiting else {
            return
        }
        let work = DispatchWorkItem { [weak self] in
            self?.startUpdate()
        }
        updateTimer = work
        DispatchQueue.main.asyncAfter(deadline: .now() + (pendingStart ? 0.05 : 0), execute: work)
    }

    private func startUpdate() {
        updateTimer = nil
        pendingStart = false
        let waiting = state.active.filter { active in
            active.isPending && !running.contains { $0.sources.contains(active.source) }
        }
        let language = waiting.filter { $0.source != Self.wordsSource }
        if !language.isEmpty {
            startQuery(language)
        }
        if let words = waiting.first(where: { $0.source == Self.wordsSource }) {
            startQuery([words])
        }
        if !running.isEmpty, state.open?.disabled == true {
            scheduleAcceptTimer()
        }
    }

    func scheduleAcceptTimer() {
        guard acceptTimer == nil else {
            return
        }
        let work = DispatchWorkItem { [weak self] in
            self?.accept()
        }
        acceptTimer = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.syncDelay, execute: work)
    }

    /// The editor lost the keyboard: the popup closes (closeOnBlur), a moment later as on the page.
    func blurred() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.01) { [weak self] in
            if let self, self.state.open != nil {
                self.send([.close])
            }
        }
    }
}
