// The commit box (src/lib/views/changes/CommitBox.svelte), measured in
// swiftui/Reference/changes-<mode>/commit-box.json: 10 points of padding under a 1-point line, the 96-point message
// field, then Amend, the summary, the gear and the split Commit button, then Sync Changes; 8 points apart.

import AppKit
import NativeCore
import SwiftUI

struct CommitBox: View {
    @Environment(\.theme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    @ObservedObject private var model = AppModel.shared
    @ObservedObject private var draft = AppModel.shared.draft
    @FocusState private var messageFocused: Bool
    @State private var keys = CommitKeys()

    /// The commit rules' view of the repository and this box (AppModel.commitState).
    let state: CommitBoxState
    let ahead: Int

    var body: some View {
        VStack(spacing: 0) {
            theme.color("--border-strong").frame(height: 1)
            VStack(spacing: 8) {
                messageField
                footer
                syncButton
            }
            .padding(10)
        }
        .background(theme.color("--panel"))
        .onChange(of: model.messageFocusRequests) { _ in
            messageFocused = true
        }
        .onChange(of: messageFocused) { focused in
            keys.watch(focused) {
                Task { await model.commit() }
            }
        }
    }

    /// The message: 6-point corners, a --border-strong line (--accent and a 2-point ring while typing), 8 and 6
    /// points of padding, room for two tool buttons.
    private var messageField: some View {
        ZStack(alignment: .topLeading) {
            TextEditor(text: $draft.message)
                .font(.system(size: 13))
                .scrollContentBackground(.hidden)
                .focused($messageFocused)
                .padding(.leading, 3)
                .padding(.trailing, 53)
                .padding(.vertical, 6)
            if draft.message.isEmpty {
                // WebKit's own placeholder color (CSS darkgray), in light and dark alike.
                Text("Commit message")
                    .foregroundStyle(Color(nsColor: Theme.parse(WebKitDefaults.placeholder) ?? .gray))
                    .padding(.leading, 9)
                    .padding(.top, 8)
                    .allowsHitTesting(false)
            }
            HStack(spacing: 1) {
                Icon(name: "history", size: 13).frame(width: 22, height: 22)
                Icon(name: "file", size: 13).frame(width: 22, height: 22)
            }
            .foregroundStyle(theme.color("--text-dim"))
            .frame(maxWidth: .infinity, alignment: .topTrailing)
            .padding(3)
        }
        .frame(height: 96)
        .background(RoundedRectangle(cornerRadius: 6).fill(theme.color("--panel")))
        .overlay(RoundedRectangle(cornerRadius: 6)
            .strokeBorder(theme.color(messageFocused ? "--accent" : "--border-strong"), lineWidth: 1))
        // box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent), outside the border.
        .background(RoundedRectangle(cornerRadius: 8)
            .fill(messageFocused ? theme.over("--accent", 0.25, on: "--panel") : .clear)
            .padding(-2))
    }

    private var footer: some View {
        HStack(spacing: 10) {
            Button {
                Task { await model.setAmend(!draft.amend) }
            } label: {
                HStack(spacing: 5) {
                    WebKitCheckbox(
                        checked: draft.amend, dark: colorScheme == .dark, disabled: !CommitRules.amendEnabled(state)
                    )
                    Text("Amend")
                }
            }
            .buttonStyle(.plain)
            .allowsHitTesting(CommitRules.amendEnabled(state))
            .help(state.unborn ? "There is no commit to amend yet" : "Amend the last commit")
            // Amend keeps its width; the summary next to it is the part that gives way.
            .fixedSize()
            Text(CommitRules.summary(state))
                .font(.system(size: 12))
                .foregroundStyle(theme.color("--text-dim"))
                .lineLimit(1)
                .truncationMode(.tail)
                // The summary takes the room left between Amend and the buttons, cut off with an ellipsis.
                .frame(maxWidth: .infinity, alignment: .leading)
            BorderedButton(width: 27, disabled: state.busy) {
                Icon(name: "settings", size: 13)
            }
            commitButton
        }
        .frame(height: 28)
    }

    /// The accent Commit button and its chevron, joined; each at half opacity while it is off (.btn:disabled), as
    /// one solid color the way WebKit blends it.
    private var commitButton: some View {
        let enabled = CommitRules.canCommit(state)
        let title = CommitRules.buttonTitle(state)
        return HStack(spacing: 1) {
            Button {
                Task { await model.commit() }
            } label: {
                Text(title)
                    .foregroundStyle(enabled ? Color.white : theme.over("#ffffff", 0.5, on: "--panel"))
                    // 12 points of padding inside a 1-point border. "Commit" is 73 points wide in the current app,
                    // where SwiftUI's text width lands a fraction off, so that one keeps the measured width.
                    .padding(.horizontal, title == "Commit" ? 12 : 13)
                    .frame(width: title == "Commit" ? 73 : nil, height: 28)
                    .background(HalfRoundedRectangle(roundedSide: .leading).fill(fill(enabled)))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .allowsHitTesting(enabled)
            .help(CommitRules.buttonHelp(state, keys: "⌘↩"))
            Icon(name: "chevron-down", size: 13)
                .foregroundStyle(state.busy ? theme.over("#ffffff", 0.5, on: "--panel") : Color.white)
                .frame(width: 25, height: 28)
                .background(HalfRoundedRectangle(roundedSide: .trailing).fill(fill(!state.busy)))
        }
    }

    private func fill(_ enabled: Bool) -> Color {
        enabled ? theme.color("--accent") : theme.over("--accent", 0.5, on: "--panel")
    }

    private var syncButton: some View {
        BorderedButton(width: nil, disabled: state.busy) {
            HStack(spacing: 6) {
                Icon(name: "sync", size: 13)
                Text("Sync Changes")
                    .padding(.trailing, ahead > 0 ? 4 : 0)
                if ahead > 0 {
                    HStack(spacing: 1) {
                        Text("\(ahead)")
                        Icon(name: "arrow-up", size: 11)
                    }
                }
            }
        }
    }

}

/// Cmd+Return in the message commits, as in the current app. A key monitor that lives only while the message has
/// the focus: a hidden shortcut button cost about 21 MB from the moment the window became active.
@MainActor
final class CommitKeys {
    private var monitor: Any?

    func watch(_ focused: Bool, commit: @escaping () -> Void) {
        if focused, monitor == nil {
            monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
                let modifiers = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
                // 36 is Return, 76 the keypad's Enter.
                if modifiers == .command, event.keyCode == 36 || event.keyCode == 76 {
                    commit()
                    return nil
                }
                return event
            }
        } else if !focused, let monitor {
            NSEvent.removeMonitor(monitor)
            self.monitor = nil
        }
    }
}
