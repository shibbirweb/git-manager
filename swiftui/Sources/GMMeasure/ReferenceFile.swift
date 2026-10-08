// gm-measure reference, the file screen: Measure.shownFile open in an editor tab (FileView.svelte), with the tab
// strip, the file bar (NavigationBar.svelte and the file actions) and CodeMirror's editor.

import Foundation
import MeasureKit

extension Reference {
    static let fileScreen = Screen(name: "file", parts: chrome + [
        Part(name: "editor tabs", selector: ".tab-strip, .tab-strip *"),
        Part(name: "file bar", selector: ".file-bar, .file-bar *"),
        Part(
            name: "file actions",
            selector: ".file-bar .actions, .file-bar .actions > *, .file-view .cm-scroll-markers, "
                + ".status-bar .right > *",
            limit: 40
        ),
        Part(
            name: "file layout",
            selector: ".file-view, .file-view .editor-area, .file-view .cm-editor, .file-view .cm-scroller, "
                + ".file-view .cm-gutters, .file-view .cm-gutter, .file-view .cm-content, .file-view .cm-layer, "
                + ".file-view .cm-layer *",
            limit: 40
        ),
        Part(
            name: "file marks",
            selector: ".file-view .cm-activeLine, .file-view .cm-activeLineGutter, .file-view .cm-selectionMatch, "
                + ".file-view [class*=\"blame\"], .file-view [class*=\"blame\"] *, .file-view .cm-gm-indentGuide, "
                + ".file-view [class*=\"bracket\"]",
            limit: 80
        ),
        Part(name: "file gutters", selector: ".file-view .cm-gutterElement", limit: 60),
        Part(name: "file lines", selector: ".file-view .cm-line", limit: 40),
    ])

    /// The screens to capture: every one, or those named by --screens.
    static func chosenScreens(_ names: [String]?) -> [Screen] {
        let all = allScreens + [fileScreen]
        guard let names else {
            return all
        }
        return all.filter { names.contains($0.name) }
    }
}
