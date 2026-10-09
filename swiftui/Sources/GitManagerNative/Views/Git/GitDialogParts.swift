// The pieces the Git dialogs' bodies share (GitDialogFrame.svelte's global styles): .field (a 12-point --text-dim
// label 5 above its control), .hint and .error lines, .check (a checkbox 6 before its label), the Create Gist
// visibility switch and the progress line with its spinner.

import AppKit
import SwiftUI

/// .field: the label 5 points above its control.
struct GitDialogField<Content: View>: View {
    @Environment(\.theme) private var theme

    let label: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            ExactText(text: label, size: 12)
                .foregroundStyle(theme.ink("--text-dim"))
            content()
        }
    }
}

/// A .hint or .error line of the Git dialogs: 12 points in its color.
struct GitDialogText: View {
    @Environment(\.theme) private var theme

    let text: String
    let token: String
    var selectable = false

    var body: some View {
        let line = Text(text)
            .font(PageFont.font(12))
            .foregroundStyle(theme.ink(token))
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
        if selectable {
            line.textSelection(.enabled)
        } else {
            line
        }
    }
}

/// .check: WebKit's checkbox 6 points before its 13-point label; the whole row toggles.
struct GitDialogCheck: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.theme) private var theme

    let label: String
    @Binding var checked: Bool
    var disabled = false

    var body: some View {
        HStack(spacing: 6) {
            // WebKit's checkbox margin, as drawn: 2 points at each side.
            WebKitCheckbox(checked: checked, dark: colorScheme == .dark, disabled: disabled)
                .padding(.horizontal, 2)
            ExactText(text: label, size: 13)
                .foregroundStyle(theme.ink("--text"))
        }
        .padding(.vertical, 1)
        .contentShape(Rectangle())
        .onTapGesture {
            if !disabled {
                checked.toggle()
            }
        }
    }
}

/// Create Gist's .segmented: 28 tall in a --border-strong box, each choice 12 points in, the chosen one --selected.
struct GitDialogSegments: View {
    @Environment(\.theme) private var theme

    let labels: [String]
    @Binding var selected: Int
    var disabled = false

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(labels.enumerated()), id: \.offset) { index, label in
                if index > 0 {
                    theme.color("--border-strong").frame(width: 1)
                }
                let on = index == selected
                ExactText(text: label, size: 13)
                    .foregroundStyle(theme.ink(on ? "--text" : "--text-dim"))
                    .padding(.horizontal, 12)
                    .frame(maxHeight: .infinity)
                    // Converted unrounded, as WebKit fills a button (measured one unit off otherwise).
                    .background(Color(nsColor: theme.textColor(on ? "--selected" : "--panel")))
                    .contentShape(Rectangle())
                    .onTapGesture {
                        if !disabled {
                            selected = index
                        }
                    }
            }
        }
        .frame(height: 26)
        .clipShape(RoundedRectangle(cornerRadius: 5, style: .circular))
        .padding(1)
        .borderRing(theme.color("--border-strong"), cornerRadius: 6)
        .fixedSize()
    }
}

/// .progress: the spinner 8 points before the step, 12-point --text-dim on one line.
struct GitDialogProgress: View {
    @Environment(\.theme) private var theme

    let line: String

    var body: some View {
        HStack(spacing: 8) {
            BusyLabel(label: line, spinnerSize: 12, gap: 8)
        }
        .font(.system(size: 12))
        .foregroundStyle(theme.ink("--text-dim"))
    }
}

enum GitDialogConfirm {
    /// dialogs.confirm({ danger: true }): true when the user chose `button`.
    @MainActor
    static func danger(title: String, message: String, button: String) -> Bool {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .critical
        alert.addButton(withTitle: button)
        alert.addButton(withTitle: "Cancel")
        return alert.runModal() == .alertFirstButtonReturn
    }
}
