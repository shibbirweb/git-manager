// The editor's find and replace bar (src/lib/editor/FindBar.svelte) above the code: 3 points of padding (4 on the
// left, 6 on the right) on --panel with a --border-strong line below, 12-point text. A row of the Replace chevron,
// the field (360 points when there is room: the magnifier, the text and the Cc / W / .* toggles), the counter with
// Previous, Next and Select All, and Close; the Replace row below it holds the second field and Replace, Replace All
// and Exclude. Rows 3 points apart, columns 6. Its keys are in FindBarKeys.swift.

import NativeCore
import SwiftUI

struct FindBar: View {
    @Environment(\.theme) private var theme
    @ObservedObject var find: FindState
    let editor: EditorModel
    @State private var keys = FindBarKeys()
    /// The field with the keyboard (.field:focus-within takes the --accent border).
    @State private var focused: FindState.Field?

    var body: some View {
        GeometryReader { proxy in
            let fieldWidth = min(360, max(90, proxy.size.width - 4 - 6 - 24 - 6 - 6 - 6 - 24 - 140))
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    chevron
                    findField.frame(width: fieldWidth)
                    tools.frame(maxWidth: .infinity, alignment: .leading)
                    icon("x", title: "Close", action: editor.closeFind)
                }
                if find.replaceOpen && !find.readOnly {
                    HStack(spacing: 6) {
                        Color.clear.frame(width: 24, height: 24)
                        replaceField.frame(width: fieldWidth)
                        replaceActions
                    }
                }
            }
            .padding(.top, 3)
            .padding(.leading, 4)
            .padding(.trailing, 6)
        }
        .frame(height: find.replaceOpen && !find.readOnly ? 57 : 30)
        .padding(.bottom, 1)
        .background(alignment: .bottom) {
            VStack(spacing: 0) {
                theme.color("--panel")
                theme.color("--border-strong").frame(height: 1)
            }
        }
        .onAppear {
            keys.start(window: nil, find: find, editor: editor)
        }
        .onDisappear {
            keys.stop()
        }
    }

    private var searchable: Bool {
        !find.search.isEmpty && find.error == nil
    }

    private var problem: Bool {
        find.notice == nil && find.counter.problem
    }

    @ViewBuilder private var chevron: some View {
        if find.readOnly {
            Color.clear.frame(width: 0, height: 24)
        } else {
            icon(find.replaceOpen ? "chevron-down" : "chevron-right",
                 title: find.replaceOpen ? "Hide Replace Field" : "Show Replace Field", action: editor.toggleReplaceRow)
        }
    }

    private var findField: some View {
        let request = find.focusRequest
        return HStack(spacing: 4) {
            Icon(name: "search", size: 13)
                .foregroundStyle(theme.ink("--text-faint"))
            input(Binding(get: { find.search }, set: { editor.setFindSearch($0) }), placeholder: "Find", field: .find,
                  focusToken: request.field == .find ? request.count : 0, selects: request.select)
            FindToggles(options: find.options) { editor.toggleFind($0) }
        }
        .padding(.leading, 6)
        .padding(.trailing, 2)
        .frame(height: 22)
        .background(RoundedRectangle(cornerRadius: 3, style: .circular)
            .fill(problem ? theme.mix("--danger", 0.13, "--editor-bg") : theme.color("--editor-bg")))
        .padding(1)
        .borderRing(fieldBorder, cornerRadius: 4)
    }

    private var fieldBorder: Color {
        if problem {
            return theme.mix("--danger", 0.55, "--border-strong")
        }
        return theme.color(focused == .find ? "--accent" : "--border-strong")
    }

    private var replaceField: some View {
        let request = find.focusRequest
        return input(Binding(get: { find.replace }, set: { editor.setFindReplace($0) }), placeholder: "Replace",
                     field: .replace, focusToken: request.field == .replace ? request.count : 0,
                     selects: request.select)
            .padding(.leading, 6)
            .padding(.trailing, 2)
            .frame(height: 22)
            .background(RoundedRectangle(cornerRadius: 3, style: .circular).fill(theme.color("--editor-bg")))
            .padding(1)
            .borderRing(theme.color(focused == .replace ? "--accent" : "--border-strong"), cornerRadius: 4)
    }

    private func input(_ text: Binding<String>, placeholder: String, field: FindState.Field, focusToken: Int,
                       selects: Bool) -> some View {
        ZStack(alignment: .leading) {
            if text.wrappedValue.isEmpty {
                ExactText(text: placeholder, size: 12)
                    .foregroundStyle(theme.ink("--text-faint"))
            }
            SearchInput(text: text, textColor: theme.textColor("--text"), caretColor: theme.textColor("--text"),
                        font: PageFont.ui(12), autofocus: false, onFocus: { focused = field }, selectsAll: selects,
                        focusToken: focusToken,
                        identifier: field == .find ? FindBarKeys.findField : FindBarKeys.replaceField,
                        onBlur: {
                            if focused == field {
                                focused = nil
                            }
                        })
        }
        .frame(maxWidth: .infinity)
    }

    /// The counter (or Replace All's notice) and Previous, Next and Select All, 1 point apart.
    private var tools: some View {
        HStack(spacing: 1) {
            FindCounterText(label: find.label, problem: problem)
                .padding(.leading, 2)
                .padding(.trailing, 6)
                .frame(minWidth: 56, alignment: .leading)
            icon("arrow-up", title: "Previous Occurrence", disabled: !searchable) { editor.findNext(forward: false) }
            icon("arrow-down", title: "Next Occurrence", disabled: !searchable) { editor.findNext() }
            icon("carets", title: "Select All Occurrences", disabled: !searchable, action: editor.selectAllMatches)
        }
    }

    private var replaceActions: some View {
        HStack(spacing: 2) {
            text("Replace", action: editor.replaceOne)
            text("Replace All", action: editor.replaceAll)
            text("Exclude", action: editor.excludeMatch)
        }
    }

    /// .icon: 24 x 24, the 14-point icon in --text-dim, at 40% while off.
    private func icon(_ name: String, title: String, disabled: Bool = false,
                      action: @escaping () -> Void) -> some View {
        Icon(name: name, size: 14)
            .foregroundStyle(disabled ? theme.over("--text-dim", 0.4, on: "--panel") : theme.ink("--text-dim"))
            .frame(width: 24, height: 24)
            .contentShape(Rectangle())
            .onTapGesture {
                if !disabled {
                    action()
                }
            }
            .accessibilityLabel(title)
            .accessibilityAddTraits(.isButton)
    }

    /// .text: 24 points tall, 8 in, --text, at 40% while off.
    private func text(_ label: String, action: @escaping () -> Void) -> some View {
        ExactText(text: label, size: 12)
            .foregroundStyle(searchable ? theme.ink("--text") : theme.over("--text", 0.4, on: "--panel"))
            .padding(.horizontal, 8)
            .frame(height: 24)
            .contentShape(Rectangle())
            .onTapGesture {
                if searchable {
                    action()
                }
            }
            .accessibilityLabel(label)
            .accessibilityAddTraits(.isButton)
    }
}

/// SearchToggles.svelte, compact: Cc, W and .* as 18-point boxes (20 wide at least, 3 in), 10.5-point text in the
/// UI font (the editor theme's ".cm-panels button" rule outranks the toggles' code font); on: --accent text and
/// border on --selected.
struct FindToggles: View {
    @Environment(\.theme) private var theme
    let options: FindOptions
    let toggle: (WritableKeyPath<FindOptions, Bool>) -> Void

    var body: some View {
        HStack(spacing: 2) {
            item("Cc", \.matchCase, title: "Match Case")
            item("W", \.wholeWords, title: "Words")
            item(".*", \.regex, title: "Regex")
        }
    }

    private func item(_ label: String, _ option: WritableKeyPath<FindOptions, Bool>, title: String) -> some View {
        let on = options[keyPath: option]
        return Text(label)
            .font(PageFont.font(10.5))
            .foregroundStyle(theme.ink(on ? "--accent" : "--text-dim"))
            .padding(.horizontal, 3)
            .frame(minWidth: 20, minHeight: 18, maxHeight: 18)
            .background(RoundedRectangle(cornerRadius: 3, style: .circular)
                .fill(on ? theme.color("--selected") : .clear))
            .borderRing(on ? theme.color("--accent") : .clear, cornerRadius: 3)
            .contentShape(Rectangle())
            .onTapGesture {
                toggle(option)
            }
            .accessibilityLabel(title)
            .accessibilityAddTraits(.isButton)
    }
}

/// The counter or the notice: a view of its own that follows FindLabel, so a new count renders only this text.
private struct FindCounterText: View {
    @Environment(\.theme) private var theme
    @ObservedObject var label: FindLabel
    let problem: Bool

    var body: some View {
        ExactText(text: label.notice ?? label.counter.text, size: 12)
            .foregroundStyle(theme.ink(problem ? "--danger" : "--text-dim"))
    }
}
