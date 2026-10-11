// Asking completion's sources and taking their answers (the plugin's startQuery and accept): the words are found at
// once, the language's sources in one JavaScriptCore call for all of them. An answer is replayed over the edits made
// while it was asked; one still valid is shown, one the edits made stale is asked again. Picking an option inserts
// its text, or runs its snippet in JavaScriptCore and starts the snippet's fields.

import Foundation
import NativeCore

/// One query: the sources asked, where, the edits since, and the answers once they came (nil per source: nothing).
@MainActor
final class CompletionQuery {
    let sources: [Int]
    let explicit: Bool
    let pos: Int
    var updates: [Transaction] = []
    var done: [Int: CompletionResult?]?

    init(sources: [Int], explicit: Bool, pos: Int) {
        self.sources = sources
        self.explicit = explicit
        self.pos = pos
    }
}

extension EditorCompletion {
    var document: SyntaxHighlighter.CompletionDocument? {
        guard let session else {
            return nil
        }
        let config = session.state.config
        return .init(filePath: session.file.path, text: session.state.doc.string, indentUnit: config.indentUnit,
                     tabSize: config.tabSize)
    }

    func startQuery(_ active: [ActiveCompletion]) {
        guard let session else {
            return
        }
        let editorState = session.state
        let pos = editorState.selection.main.from
        let query = CompletionQuery(sources: active.map(\.source), explicit: active.first?.explicit ?? false,
                                    pos: pos)
        running.append(query)
        if query.sources == [Self.wordsSource] {
            let language = editorState.config.language
            let whileTyping = language.syntax && EditorInfo.languageName(filePath: session.file.path) != "Markdown"
            let words = WordCompletion.result(doc: editorState.doc, pos: pos, explicit: query.explicit,
                                              whileTyping: whileTyping, wordChars: language.wordChars)
            query.done = [Self.wordsSource: words]
            scheduleAccept()
            return
        }
        guard let document else {
            return
        }
        Task { [weak self] in
            let answers = await SyntaxHighlighter.shared.completions(document, pos: pos, explicit: query.explicit)
            self?.answered(query, answers ?? [])
        }
    }

    private func answered(_ query: CompletionQuery, _ answers: [CompletionResult?]) {
        guard running.contains(where: { $0 === query }) else {
            return
        }
        if answers.count != languageSources, let editorState = session?.state {
            // The language has this many sources: they join (or leave) the list, as the page's sources do.
            languageSources = answers.count
            var next = state
            next.sources = Self.sources(language: answers.count)
            state = next.update(nil, state: editorState, now: Self.now())
        }
        var done: [Int: CompletionResult?] = [:]
        for (index, answer) in answers.enumerated() {
            done[index] = answer
        }
        query.done = done
        scheduleAccept()
    }

    private func scheduleAccept() {
        if running.allSatisfy({ $0.done != nil }) {
            accept()
        } else {
            scheduleAcceptTimer()
        }
    }

    /// Takes every finished query's answers: a still valid result is shown, a stale one asked again.
    func accept() {
        acceptTimer?.cancel()
        acceptTimer = nil
        guard let editorState = session?.state else {
            return
        }
        var updated: [ActiveCompletion] = []
        var restart: [ActiveCompletion] = []
        for query in running {
            guard let done = query.done else {
                continue
            }
            running.removeAll { $0 === query }
            // Sources the language turned out to have beyond the ones asked answered too.
            let answered = query.sources == [Self.wordsSource] ? query.sources
                : Array(Set(query.sources).union(done.keys)).sorted()
            for source in answered where state.sources.contains(source) {
                let result = done[source] ?? nil
                if let result {
                    let pos = query.updates.first?.startState.selection.main.from ?? editorState.selection.main.from
                    let limit = min(pos, result.from + (query.explicit ? 0 : 1))
                    var active = ActiveCompletion(
                        source: source, explicit: query.explicit, limit: limit, result: result, from: result.from,
                        to: result.to ?? pos, resultID: nextResultID
                    )
                    nextResultID += 1
                    for transaction in query.updates {
                        active = active.update(transaction, effects: [], activateOnTyping: state.activateOnTyping)
                    }
                    if active.hasResult {
                        updated.append(active)
                        continue
                    }
                }
                guard let current = state.active.first(where: { $0.source == source }), current.isPending else {
                    continue
                }
                if result == nil {
                    var active = ActiveCompletion(source: source, phase: .inactive)
                    for transaction in query.updates {
                        active = active.update(transaction, effects: [], activateOnTyping: state.activateOnTyping)
                    }
                    if !active.isPending {
                        updated.append(active)
                    }
                } else {
                    restart.append(current)
                }
            }
        }
        let language = restart.filter { $0.source != Self.wordsSource }
        if !language.isEmpty {
            startQuery(language)
        }
        if let words = restart.first(where: { $0.source == Self.wordsSource }) {
            startQuery([words])
        }
        if !updated.isEmpty || state.open?.disabled == true {
            send([.setActive(updated)])
        }
    }

    // MARK: - Picking

    /// applyCompletion: the option's text over the range its result completes, or its snippet.
    func pick(_ option: CompletionOption) {
        guard let session, let result = CompletionCommands.result(of: option, in: state) else {
            return
        }
        let completion = option.completion
        switch completion.apply {
        case .handle(let handle):
            guard let document else {
                return
            }
            let selection = session.state.selection, doc = session.state.doc
            Task { [weak self] in
                let edits = await SyntaxHighlighter.shared.applyCompletion(
                    document, handle: handle, label: completion.label, from: result.from, to: result.to,
                    selection: selection
                )
                guard let self, let session = self.session, session.state.doc.sameText(doc) else {
                    return
                }
                session.scrollRequests += 1
                for edit in edits {
                    self.startingSnippet = .some(edit.snippet)
                    session.dispatch(edit.spec(session.state))
                }
            }
        case .text(let text):
            session.scrollRequests += 1
            session.dispatch(CompletionCommands.insertText(session.state, text, from: result.from, to: result.to))
        case nil:
            session.scrollRequests += 1
            session.dispatch(CompletionCommands.insertText(session.state, completion.label, from: result.from,
                                                           to: result.to))
        }
    }
}
