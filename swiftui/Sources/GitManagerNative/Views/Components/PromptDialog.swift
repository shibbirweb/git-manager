// The page's prompt (DialogHost.svelte): 460 points wide at 14% of the window's height, the title, the field's
// label 6 points above the input (which takes the keyboard with its text selected), the validation message 6 below
// it in 12-point --danger once something is typed, and 18 points lower Cancel and the main button, which is off
// while the text is empty or not valid. Return submits, Escape and the overlay cancel.

import SwiftUI

struct PromptDialogHost: View {
    @ObservedObject var center: DialogCenter

    var body: some View {
        if let prompt = center.prompt {
            PromptDialog(center: center, prompt: prompt)
        }
    }
}

private struct PromptDialog: View {
    @Environment(\.theme) private var theme
    @ObservedObject var center: DialogCenter
    let prompt: DialogCenter.Prompt
    @State private var focused = true

    var body: some View {
        GitDialogFrame(title: prompt.title, width: 460, onCancel: center.cancel, onSubmit: center.submit,
                       topShare: 0.14, actionsGap: 18) {
            VStack(alignment: .leading, spacing: 6) {
                if let label = prompt.label {
                    ExactText(text: label, size: 13)
                        .foregroundStyle(theme.ink("--text"))
                }
                PageInput(text: $center.value, focused: focused, autofocus: true, onFocus: { focused = true },
                          onSubmit: center.submit, selectsAll: true)
                if let error = center.validationError, !center.value.isEmpty {
                    ExactText(text: error, size: 12)
                        .foregroundStyle(theme.ink("--danger"))
                }
            }
        } footer: {
            DialogButton(title: "Cancel", hug: true, action: center.cancel)
            DialogButton(title: prompt.confirmLabel, primary: true, disabled: !center.canSubmit, hug: true,
                         action: center.submit)
        }
    }
}
