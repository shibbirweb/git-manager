// The control server's `diff` action: drives the diff on screen as its toolbar and fold bars do, so gm-measure
// smoke can check them without clicking. Arguments (all optional, applied in this order): collapse "toggle", step
// "next" or "previous", fold (an index among the original text's folds) with edge "top", "bottom" or "all".
// Answers with the counter, the collapse choice, the folds and the change count.

import Foundation
import NativeCore

extension Control {
    static func diff(_ args: [String: Any]) -> String {
        let shown = onMain { DiffState.shown != nil }
        guard shown else {
            return reply(ok: false, text: "No diff is open")
        }
        onMain {
            if args["collapse"] as? String == "toggle" {
                DiffPrefs.shared.toggleCollapse()
            }
        }
        // SwiftUI rebuilds the diff for the new choice on its next update.
        Thread.sleep(forTimeInterval: 0.3)
        onMain {
            guard let state = DiffState.shown else {
                return
            }
            switch args["step"] as? String {
            case "next":
                state.go(1)
            case "previous":
                state.go(-1)
            default:
                break
            }
            if let fold = args["fold"] as? Int {
                let edges: [String: FoldEdge] = ["top": .top, "bottom": .bottom, "all": .all]
                state.stepFold(fold, edge: edges[args["edge"] as? String ?? "all"] ?? .all)
            }
        }
        Thread.sleep(forTimeInterval: 0.3)
        let answer = onMain { () -> [String: Any] in
            guard let state = DiffState.shown else {
                return [:]
            }
            return [
                "changeCount": state.changeCount,
                "current": state.current,
                "counter": DiffNavigation.counterLabel(count: state.changeCount, current: state.current),
                "collapseUnchanged": DiffPrefs.shared.collapseUnchanged,
                "folds": state.shownFolds,
            ]
        }
        return reply(ok: true, structured: answer)
    }
}
