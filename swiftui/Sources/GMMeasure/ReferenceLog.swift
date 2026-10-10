// gm-measure reference: the Log screen (src/lib/views/LogView.svelte, src/lib/log/CommitDetails.svelte) as it opens
// from the History activity: the toolbar, the column heads, the commit rows with their graph and labels, the newest
// commit's details and its first file's read-only diff.

import Foundation
import MeasureKit

extension Reference {
    static let logScreen = Screen(name: "log", parts: chrome + [
        Part(name: "log toolbar", selector: ".log-view > .toolbar, .log-view > .toolbar *"),
        Part(name: "log columns", selector: ".log-view .columns, .log-view .columns *"),
        Part(name: "log rows", selector: ".log-view .row, .log-view .row > div"),
        Part(
            name: "log labels",
            selector: ".log-view .row .ref, .log-view .row .ref *, .log-view .row .summary"
        ),
        Part(name: "log nodes", selector: ".log-view .col-graph svg, .log-view .col-graph circle"),
        Part(name: "log lines", selector: ".log-view .col-graph path"),
        Part(name: "log split", selector: ".log-view .split, .log-view .details-pane, .log-view .details", limit: 10),
        Part(name: "commit info", selector: ".details .left, .details .left *", limit: 100),
        Part(name: "commit diff toolbar", selector: ".details .right .toolbar, .details .right .toolbar *"),
        Part(
            name: "commit diff header",
            selector: ".details .right .diff-view > :not(.body), .details .right .labels, .details .right .labels *"
        ),
        Part(
            name: "commit diff layout",
            selector: ".details .cm-mergeView, .details .cm-editor, .details .cm-gutters, .details .cm-scroller, "
                + ".details .cm-scroll-markers, .details .cm-scroll-markers *",
            limit: 30
        ),
        Part(
            name: "commit diff widgets",
            selector: ".details .cm-diffFold, .details .cm-diffFold *, .details .cm-changedLine, "
                + ".details .cm-changedText, .details .cm-gm-indentGuide",
            limit: 80
        ),
        Part(name: "commit diff lines", selector: ".details .cm-line", limit: 80),
        Part(name: "commit diff gutters", selector: ".details .cm-gutterElement", limit: 80),
    ])

    /// The screens `reference` captures, in order: the Log comes right after Changes, before a diff is open.
    static var allScreens: [Screen] {
        var list = screens
        list.insert(logScreen, at: min(1, list.count))
        return list
    }

    /// Shows or hides the Log before a screen: shown for the Log, hidden again for the screens after it.
    static func prepare(_ screen: Screen, _ app: RunningApp, logShown: inout Bool) async throws {
        if screen.name == "log" {
            try await Measure.showLog(app)
            logShown = true
        } else if logShown {
            let hidden = try await app.client.call("show_panel", ["panel": "log", "visible": false])
            if hidden.isError {
                throw ToolError("show_panel log: \(hidden.text)")
            }
            logShown = false
        }
    }
}
