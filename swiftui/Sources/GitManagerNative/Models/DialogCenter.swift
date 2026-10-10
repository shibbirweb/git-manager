// The window's own dialogs (src/lib/ui/dialog.svelte.ts and DialogHost.svelte): a prompt asks for one line of text
// and answers it trimmed, or nil when cancelled. One at a time, as the page's dialog host shows one.

import Foundation

@MainActor
final class DialogCenter: ObservableObject {
    struct Prompt {
        let title: String
        var label: String?
        var initial = ""
        var confirmLabel = "OK"
        /// Why the text cannot be used, or nil when it can.
        var validate: (String) -> String? = { _ in nil }
    }

    @Published private(set) var prompt: Prompt?
    @Published var value = ""
    private var answer: CheckedContinuation<String?, Never>?

    /// Shows `prompt` and waits for the text (trimmed), or nil when it was cancelled.
    func ask(_ prompt: Prompt) async -> String? {
        answer?.resume(returning: nil)
        value = prompt.initial
        self.prompt = prompt
        return await withCheckedContinuation { continuation in
            answer = continuation
        }
    }

    var validationError: String? {
        prompt?.validate(value)
    }

    /// The submit button is off while the text is empty or not valid.
    var canSubmit: Bool {
        validationError == nil && !value.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func submit() {
        guard canSubmit else {
            return
        }
        finish(value.trimmingCharacters(in: .whitespaces))
    }

    func cancel() {
        finish(nil)
    }

    private func finish(_ text: String?) {
        prompt = nil
        let waiting = answer
        answer = nil
        waiting?.resume(returning: text)
    }
}
