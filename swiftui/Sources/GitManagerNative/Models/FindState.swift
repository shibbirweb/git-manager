// One file's find bar (findPanel.svelte.ts FindPanel and FindBarState): open or not, the Replace row, the fields,
// the toggles, the counter, the matches skipped with Exclude (kept in place through edits until the search changes)
// and where typing jumps from (the cursor before the search moved it).

import Foundation
import NativeCore

@MainActor
final class FindState: ObservableObject {
    enum Field {
        case find, replace
    }

    @Published var open = false
    @Published var replaceOpen = false
    /// The find field's text. Set from outside (Cmd+F seeding) it is published; typed, the field already shows it
    /// (typed(_:)), and the bar renders again only when it turns empty or back, or the regex turns invalid or back.
    var search = "" {
        willSet {
            if !typing {
                objectWillChange.send()
            }
        }
    }
    private var typing = false

    /// Text typed in the find field.
    func typed(_ text: String) {
        let before = (search.isEmpty, error != nil)
        typing = true
        search = text
        typing = false
        if before != (search.isEmpty, error != nil) {
            objectWillChange.send()
        }
    }
    @Published var replace = ""
    @Published var options = FindOptions()
    /// The counter and Replace All's notice, published on their own so a new count renders only the counter. The
    /// bar itself follows them only when it turns red or back (no results, an invalid regex).
    let label = FindLabel()
    /// The latest count; the label shows it after the frame (AfterFrame), so the code paints first.
    private(set) var counter = FindModel.Counter(text: "", problem: false)
    /// Shown in place of the counter until the next change ("3 replaced" after Replace All).
    var notice: String? {
        get {
            label.notice
        }
        set {
            guard newValue != label.notice else {
                return
            }
            if (newValue == nil) != (label.notice == nil) {
                objectWillChange.send()
            }
            label.notice = newValue
        }
    }
    /// A field to take the keyboard (and select its text), with a count so the same one can be asked again.
    @Published private(set) var focusRequest: (field: Field, select: Bool, count: Int) = (.find, true, 0)
    var excluded: [Range<Int>] = []
    /// Typing jumps to the first match from here.
    var anchor = 0
    var readOnly = false
    private var countTask: Task<Void, Never>?

    /// The user event of the jump while typing, which keeps the anchor in place.
    static let typingEvent = "select.search.typing"
    /// Larger documents count after a pause instead of on every change.
    static let syncCountLength = 200_000

    var query: FindQuery {
        FindQuery(search: search, replace: replace, options: options, excluded: excluded)
    }

    var error: String? {
        FindModel.regexError(search, regex: options.regex)
    }

    func focus(_ field: Field, select: Bool) {
        let target: Field = field == .replace && replaceOpen ? .replace : .find
        focusRequest = (target, select, focusRequest.count + 1)
    }

    /// After a change of the text or the selection: exclusions follow the text, the anchor follows the cursor, and
    /// the counter is worked out again.
    func follow(_ transaction: Transaction, state: EditorState) {
        if transaction.docChanged && !excluded.isEmpty {
            excluded = excluded.compactMap { span in
                guard let from = transaction.changes.mapPos(span.lowerBound, assoc: 1),
                      let to = transaction.changes.mapPos(span.upperBound, assoc: -1), to > from else {
                    return nil
                }
                return from..<to
            }
        }
        if transaction.selection != nil && transaction.userEvent != Self.typingEvent {
            anchor = state.selection.main.from
        }
        if open {
            scheduleCount(state)
        }
    }

    func scheduleCount(_ state: EditorState) {
        countTask?.cancel()
        if state.doc.length <= Self.syncCountLength {
            count(state)
            return
        }
        countTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 120_000_000)
            if !Task.isCancelled {
                self?.count(state)
            }
        }
    }

    func count(_ state: EditorState) {
        notice = nil
        let next = FindModel.counter(search, FindModel.count(state, query), error: error)
        guard counter != next else {
            return
        }
        counter = next
        AfterFrame.run { [weak self] in
            guard let self, self.label.counter != self.counter else {
                return
            }
            if self.label.counter.problem != self.counter.problem {
                self.objectWillChange.send()
            }
            self.label.counter = self.counter
        }
    }
}

/// FindState's counter and notice (FindBar's FindCounterText follows them).
@MainActor
final class FindLabel: ObservableObject {
    @Published var counter = FindModel.Counter(text: "", problem: false)
    @Published var notice: String?
}
