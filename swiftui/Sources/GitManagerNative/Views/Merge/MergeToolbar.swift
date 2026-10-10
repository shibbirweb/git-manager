// The merge tool's toolbar and footer (MergeEditor.svelte .toolbar, .footer): apply non-conflicting changes (from
// the left, all, from the right), previous and next change, undo and redo, the Ignore whitespace toggle and the
// status; below the panes Accept Left, Accept Right, the hint, Cancel and Apply.

import NativeCore
import SwiftUI

struct MergeToolbar: View {
    @Environment(\.windowContext) private var windowContext
    @Environment(\.theme) private var theme
    @ObservedObject var session: MergeSession

    var body: some View {
        let counts = session.counts
        let noneToApply = session.nonConflicting == 0
        VStack(spacing: 0) {
            HStack(spacing: 4) {
                HStack(spacing: 2) {
                    icon("chevrons-right", disabled: noneToApply) {
                        session.applyNonConflicting(only: .ours)
                    }
                    wandButton(disabled: noneToApply)
                    icon("chevrons-left", disabled: noneToApply) {
                        session.applyNonConflicting(only: .theirs)
                    }
                }
                divider
                HStack(spacing: 2) {
                    icon("arrow-up", disabled: counts.changes == 0) {
                        session.navigate(-1)
                    }
                    icon("arrow-down", disabled: counts.changes == 0) {
                        session.navigate(1)
                    }
                }
                divider
                HStack(spacing: 2) {
                    icon("undo", disabled: !session.canUndo, action: session.undo)
                    icon("redo", disabled: !session.canRedo, action: session.redo)
                }
                divider
                whitespaceToggle
                Spacer(minLength: 0)
                ExactText(text: counts.statusText, size: 13, weight: .medium)
                    .foregroundStyle(theme.ink(statusToken(counts)))
            }
            .padding(.horizontal, 10)
            .frame(height: 40)
            theme.color("--border-strong").frame(height: 1)
        }
        .background(theme.color("--panel"))
    }

    private func statusToken(_ counts: ResolutionCounts) -> String {
        if counts.changes == 0 {
            return "--success"
        }
        return counts.conflicts > 0 ? "--danger" : "--text-dim"
    }

    /// .icon-btn with a 15-point icon: 28 x 28.
    private func icon(_ name: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        IconButton(disabled: disabled, action: action) {
            Icon(name: name, size: 15)
        }
    }

    /// The wand and "Apply non-conflicting" in 12.5-point text, 4 points apart, 6 points of padding.
    private func wandButton(disabled: Bool) -> some View {
        Button {
            session.applyNonConflicting()
        } label: {
            HStack(spacing: 4) {
                Icon(name: "wand", size: 15)
                ExactText(text: "Apply non-conflicting", size: 12.5)
            }
            .padding(.horizontal, 6)
            .frame(height: 28)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .allowsHitTesting(!disabled)
        .foregroundStyle(disabled ? theme.over("--text", 0.4, on: "--panel") : theme.ink("--text"))
    }

    /// .divider: 1 x 18 with 6 points on each side.
    private var divider: some View {
        theme.color("--border-strong")
            .frame(width: 1, height: 18)
            .padding(.horizontal, 6)
    }

    /// .toggle: 26 points tall, 10 points of padding inside a 1-point --border-strong border with 6-point corners,
    /// the 13-point pilcrow 6 points from 12-point text; accent-tinted while on.
    private var whitespaceToggle: some View {
        let active = session.document.ignoreWhitespace
        return HStack(spacing: 6) {
            Icon(name: "pilcrow", size: 13)
            ExactText(text: "Ignore whitespace", size: 12)
        }
        .foregroundStyle(theme.ink(active ? "--accent" : "--text"))
        // The border is outside the padding: 1 + 10 points to the content.
        .padding(.horizontal, 11)
        .frame(height: 26)
        .background(RoundedRectangle(cornerRadius: 6, style: .circular)
            .fill(active ? theme.mix("--accent", 0.15, "--panel") : .clear))
        .borderRing(theme.color(active ? "--accent" : "--border-strong"), cornerRadius: 6)
        .contentShape(Rectangle())
        .onTapGesture {
            windowContext?.merge.toggleWhitespace()
        }
    }
}

struct MergeFooter: View {
    @Environment(\.theme) private var theme
    @ObservedObject var session: MergeSession
    /// Saves the result; true skips the questions, after Accept Left or Right.
    let onApply: (_ skipChecks: Bool) -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            theme.color("--border-strong").frame(height: 1)
            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    button("Accept Left") {
                        session.acceptWhole(.ours)
                        onApply(true)
                    }
                    button("Accept Right") {
                        session.acceptWhole(.theirs)
                        onApply(true)
                    }
                }
                Spacer(minLength: 0)
                ExactText(text: "F7 next change \u{00B7} \(Self.applyKeys) apply", size: 12)
                    .foregroundStyle(theme.ink("--text-dim"))
                    .padding(.trailing, 6)
                button("Cancel", action: onCancel)
                button(session.saving ? "Saving..." : "Apply", primary: true) {
                    onApply(false)
                }
            }
            .padding(.horizontal, 10)
            .frame(height: 40)
        }
        .background(theme.color("--panel"))
    }

    /// localKeys("CmdOrCtrl+Enter") on a Mac.
    static let applyKeys = "Cmd+Enter"

    /// .btn: 28 points tall, 12 points of padding, a --border-strong border with 6-point corners on --panel;
    /// .primary in --accent with --accent-text.
    private func button(_ title: String, primary: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ExactText(text: title, size: 13)
                .foregroundStyle(theme.ink(primary ? "--accent-text" : "--text"))
                // The border is outside the padding: 1 + 12 points to the text.
                .padding(.horizontal, 13)
                .frame(height: 28)
                .background(RoundedRectangle(cornerRadius: 6, style: .circular)
                    .fill(theme.color(primary ? "--accent" : "--panel")))
                .borderRing(theme.color(primary ? "--accent" : "--border-strong"), cornerRadius: 6)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .allowsHitTesting(!session.saving)
    }
}
