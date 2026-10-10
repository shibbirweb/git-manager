// The toasts in the window's corner and the bell's unread count (src/lib/ui/toast.svelte.ts and the notification
// history behind the status bar's bell). The native app keeps no history list yet, only the unread count.

import Foundation
import NativeCore

struct Toast: Identifiable {
    let id: Int
    let kind: Notices.Kind
    let title: String
    let detail: String?
    let action: ToastAction?
}

/// A button in a toast, such as Undo: clicking it closes the toast and runs `run`.
struct ToastAction {
    let label: String
    let run: @MainActor () -> Void
}

@MainActor
final class ToastCenter: ObservableObject {
    /// The window this belongs to (WindowContext).
    weak var context: WindowContext!

    @Published private(set) var items: [Toast] = []
    /// Unread errors and warnings, on the bell's badge until the bell is clicked.
    @Published private(set) var unread = 0
    /// Whether an unread one is an error (a red badge) rather than only warnings (amber).
    @Published private(set) var unreadError = false
    private var nextID = 1

    func show(_ kind: Notices.Kind, _ title: String, detail: String? = nil, action: ToastAction? = nil) {
        if Notices.countsAsAlert(kind) {
            unread += 1
            unreadError = unreadError || kind == .error
        }
        let id = nextID
        nextID += 1
        items.append(Toast(id: id, kind: kind, title: title, detail: Notices.detail(detail), action: action))
        let seconds = Notices.timeout(kind, hasAction: action != nil)
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            self?.dismiss(id)
        }
    }

    func dismiss(_ id: Int) {
        items.removeAll { $0.id == id }
    }

    func runAction(_ id: Int) {
        let action = items.first { $0.id == id }?.action
        dismiss(id)
        action?.run()
    }

    func markRead() {
        unread = 0
        unreadError = false
    }
}

/// The commit box's text and Amend, kept by the model so the control server can type and commit like a user.
@MainActor
final class CommitDraft: ObservableObject {
    @Published var message = ""
    @Published var amend = false
    /// HEAD's message as Amend put it in the box, taken out again when Amend is turned off untouched.
    var prefilled: String?
    /// HEAD's message is being read for Amend.
    @Published var loadingMessage = false

    func clear() {
        message = ""
        amend = false
        prefilled = nil
    }
}
