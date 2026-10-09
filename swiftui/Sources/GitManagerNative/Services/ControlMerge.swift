// The control server's merge actions, run through the window like a click:
//   open_conflicts                  the conflicts list (the current app's run_menu_command git.resolveConflicts)
//   open_merge filePath             the merge tool for one conflicted file
//   close_dialog                    closes the conflicts list or, unedited, the merge tool
//   merge step next|previous, apply|ignore chunkId with side ours|theirs, nonConflicting all|ours|theirs,
//         undo, redo, accept ours|theirs (the whole file, then saves)
// Each answers with the merge state (get_state's "merge").

import Foundation
import NativeCore

extension Control {
    static func merge(_ action: String, _ args: [String: Any]) -> String {
        switch action {
        case "open_conflicts":
            onMain { WindowContext.focused.merge.openConflicts() }
        case "open_merge":
            guard let filePath = args["filePath"] as? String else {
                return reply(ok: false, text: "filePath is required")
            }
            let semaphore = DispatchSemaphore(value: 0)
            Task { @MainActor in
                await WindowContext.focused.merge.openMerge(filePath)
                semaphore.signal()
            }
            semaphore.wait()
        case "close_dialog":
            let closed = onMain { () -> Bool in
                let center = WindowContext.focused.merge
                if center.mergePath != nil {
                    if center.session?.canUndo == true {
                        return false
                    }
                    center.closeMerge()
                } else {
                    center.conflictsOpen = false
                }
                return true
            }
            if !closed {
                return reply(ok: false, text: "The merge tool holds unsaved resolutions; close it in the app")
            }
        default:
            if let failure = onMain({ mergeStep(args) }) {
                return reply(ok: false, text: failure)
            }
        }
        // SwiftUI draws the new state on its next update.
        Thread.sleep(forTimeInterval: 0.3)
        return reply(ok: true, structured: onMain { mergeState() })
    }

    @MainActor
    private static func mergeStep(_ args: [String: Any]) -> String? {
        guard let session = WindowContext.focused.merge.session else {
            return "No merge is open"
        }
        let side: MergeSide = args["side"] as? String == "theirs" ? .theirs : .ours
        if let step = args["step"] as? String {
            session.navigate(step == "previous" ? -1 : 1)
        }
        if let chunkId = args["apply"] as? Int {
            session.apply(chunkId, side: side)
        }
        if let chunkId = args["ignore"] as? Int {
            session.ignore(chunkId, side: side)
        }
        if let which = args["nonConflicting"] as? String {
            session.applyNonConflicting(only: which == "all" ? nil : (which == "theirs" ? .theirs : .ours))
        }
        if args["undo"] as? Bool == true {
            session.undo()
        }
        if args["redo"] as? Bool == true {
            session.redo()
        }
        if let accept = args["accept"] as? String {
            session.acceptWhole(accept == "theirs" ? .theirs : .ours)
            WindowContext.focused.merge.apply(skipChecks: true)
        }
        return nil
    }

    @MainActor
    static func mergeState() -> [String: Any] {
        let center = WindowContext.focused.merge
        var state: [String: Any] = [
            "conflictsOpen": center.conflictsOpen,
            "path": orNull(center.mergePath),
            "error": orNull(center.loadError),
            "mergetool": center.mergetool != nil,
        ]
        if let session = center.session {
            let counts = session.counts
            state["loaded"] = true
            state["status"] = counts.statusText
            state["changes"] = counts.changes
            state["conflicts"] = counts.conflicts
            state["cursorLine"] = session.cursorLine
            state["resultLines"] = session.lines.count
            state["highlighted"] = session.resultSpans != nil
            state["panes"] = MergeScrollSync.shown?.panesState ?? [:]
            state["chunks"] = session.chunks.map { chunk -> [String: Any] in
                ["id": chunk.id, "kind": chunk.kind.rawValue, "resolved": chunk.isResolved,
                 "result": [chunk.result.start, chunk.result.end]]
            }
        } else {
            state["loaded"] = false
        }
        return state
    }
}
