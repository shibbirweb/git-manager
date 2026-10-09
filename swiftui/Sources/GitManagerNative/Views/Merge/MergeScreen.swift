// The merge screens over the window (Workspace.svelte shows ConflictsDialog, or MergeView over everything) and the
// git mergetool window (MergeToolApp.svelte): the title bar, then the editor, or a notice while loading, after an
// error, or for a file that can only be resolved by picking a side.

import AppKit
import NativeCore
import SwiftUI

/// Over the window's content: the conflicts list, or the merge tool for one file.
struct MergeOverlay: View {
    @ObservedObject private var center = MergeCenter.shared

    var body: some View {
        if center.mergePath != nil {
            MergeScreen(center: center, mergetool: false)
        } else if center.conflictsOpen {
            ConflictsDialog(center: center)
        }
    }
}

struct MergeScreen: View {
    @Environment(\.theme) private var theme
    @ObservedObject var center: MergeCenter
    let mergetool: Bool
    /// The user chose to merge a modify/delete conflict as text.
    @State private var forceText = false

    var body: some View {
        VStack(spacing: 0) {
            MergeTitleBar(path: titlePath, close: closeAction)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(theme.color("--panel"))
        .background(MergeKeys(center: center))
    }

    private var titlePath: String {
        center.session?.document.path ?? center.mergePath ?? ""
    }

    private var closeAction: (() -> Void)? {
        if mergetool {
            return nil
        }
        let center = self.center
        return { center.cancel() }
    }

    @ViewBuilder private var content: some View {
        if let loadError = center.loadError {
            notice(mergetool ? "Could not load the files passed by git mergetool." : "Could not load this conflict.",
                   detail: loadError)
        } else if let session = center.session {
            if let reason = fileLevelReason(session.document) {
                notice(reason, detail: nil)
            } else {
                MergeEditorView(session: session, onApply: { center.apply(skipChecks: $0) }, onCancel: center.cancel)
                    .id(ObjectIdentifier(session))
            }
        } else {
            ExactText(text: "Loading...", size: 13)
                .foregroundStyle(theme.ink("--text-dim"))
        }
    }

    private func fileLevelReason(_ document: MergeDocumentDTO) -> String? {
        if document.binary {
            return "This file is binary, so it can only be resolved by picking one version."
        }
        if forceText {
            return nil
        }
        if document.kind == "deletedByUs" {
            return "This file was deleted on your side and modified on theirs."
        }
        if document.kind == "deletedByThem" {
            return "This file was modified on your side and deleted on theirs."
        }
        return nil
    }

    private func notice(_ text: String, detail: String?) -> some View {
        VStack(spacing: 12) {
            Icon(name: "alert", size: 22)
            Text(text)
            if let detail {
                Text(detail)
                    .font(.system(size: 12))
                    .foregroundStyle(theme.ink("--text-dim"))
                    .textSelection(.enabled)
            }
            if let document = center.session?.document, detail == nil, !mergetool {
                HStack(spacing: 8) {
                    Button(document.kind == "deletedByUs" ? "Keep Deleted" : "Accept Yours") {
                        ConflictActions.accept([document.path], side: .ours, closeMerge: true)
                    }
                    Button(document.kind == "deletedByThem" ? "Keep Deleted" : "Accept Theirs") {
                        ConflictActions.accept([document.path], side: .theirs, closeMerge: true)
                    }
                    if !document.binary {
                        Button("Merge Text Anyway") {
                            forceText = true
                        }
                    }
                }
            }
            Button(mergetool ? "Quit" : "Cancel", action: center.cancel)
        }
        .frame(maxWidth: 560)
        .multilineTextAlignment(.center)
    }
}

/// Accept Yours or Accept Theirs on whole files, through the bridge's git CLI like the current app.
@MainActor
enum ConflictActions {
    static func accept(_ conflictPaths: [String], side: MergeSide, closeMerge: Bool = false) {
        let label = side == .ours ? "Accept yours" : "Accept theirs"
        let success = conflictPaths.count == 1
            ? "Resolved \(conflictPaths[0])" : "Resolved \(conflictPaths.count) files"
        Task {
            let done = await AppModel.shared.run(label, success: success) { repoPath in
                try Backend.perform("accept_side", AcceptSideArgs(
                    repoPath: repoPath, conflictPaths: conflictPaths, side: side.rawValue
                ))
                return true
            }
            if done == true && closeMerge {
                MergeCenter.shared.closeMerge()
            }
        }
    }
}

/// F7 and Shift+F7 (next and previous change), Cmd+Return (Apply) and Esc (Cancel), while the merge tool shows.
private struct MergeKeys: NSViewRepresentable {
    let center: MergeCenter

    func makeNSView(context: Context) -> NSView {
        context.coordinator.start(center)
        return NSView()
    }

    func updateNSView(_ view: NSView, context: Context) {}

    static func dismantleNSView(_ view: NSView, coordinator: Coordinator) {
        coordinator.stop()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator {
        private var monitor: Any?

        func start(_ center: MergeCenter) {
            monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak center] event in
                guard let center, NSApp.modalWindow == nil else {
                    return event
                }
                let keyCode = event.keyCode
                let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
                let handled = MainActor.assumeIsolated { Self.handle(keyCode, flags: flags, center: center) }
                return handled ? nil : event
            }
        }

        func stop() {
            if let monitor {
                NSEvent.removeMonitor(monitor)
            }
            monitor = nil
        }

        @MainActor
        private static func handle(_ keyCode: UInt16, flags: NSEvent.ModifierFlags, center: MergeCenter) -> Bool {
            switch keyCode {
            case 98:
                center.session?.navigate(flags.contains(.shift) ? -1 : 1)
            case 36 where flags.contains(.command):
                center.apply()
            case 53:
                center.cancel()
            default:
                return false
            }
            return true
        }
    }
}
