// The popups' keys and clicks, as QuickOpen.svelte and FileSearch.svelte handle them: arrows and Ctrl+N/P step over
// the selectable rows (wrapping), Page Up and Down move ten (stopping at the ends), Return runs the row, Escape
// closes. A file joins the recent files and opens in a kept tab of the file view, as Go to File does.

import NativeCore
import SwiftUI

extension SearchPopups {
    static let page = 10

    func key(_ key: QueryField.Key) {
        switch key {
        case .up:
            step(-1)
        case .down:
            step(1)
        case .pageUp:
            step(-SearchPopups.page)
        case .pageDown:
            step(SearchPopups.page)
        case .enter:
            activate(selected)
        case .escape:
            close()
        case .tab:
            // Quick Open keeps the focus in the field; Search Everywhere has only its Text tab here.
            break
        }
    }

    private func step(_ amount: Int) {
        switch kind {
        case .quickOpen:
            selected = QuickOpenModel.moveSelectable(quickRows, selected: selected, step: amount)
            follow(firstIndex: QuickOpenModel.firstSelectable(quickRows))
        case .search:
            let lines = text.rows.indices.filter { if case .line = text.rows[$0] { return true }; return false }
            guard !lines.isEmpty else {
                return
            }
            let position = lines.firstIndex { $0 >= selected } ?? (lines.count - 1)
            selected = lines[SearchRows.moveSelection(position, count: lines.count, step: amount)]
            follow(firstIndex: lines[0])
        case nil:
            break
        }
    }

    /// Scrolls the list so the selected row shows (popupRows.ts scrollToShow).
    private func follow(firstIndex: Int) {
        scrollTop = PopupRows.scrollToShow(
            index: selected, scrollTop: scrollTop, viewportHeight: listViewport, rowHeight: 26, firstIndex: firstIndex
        )
    }

    /// The list's visible height for keyboard scrolling: its 468 points less the padding.
    var listViewport: Double {
        460
    }

    func activate(_ index: Int) {
        switch kind {
        case .quickOpen:
            let rows = quickRows
            guard rows.indices.contains(index), rows[index].isSelectable else {
                return
            }
            activate(rows[index])
        case .search:
            guard text.rows.indices.contains(index), case .line(_, let path, _, _, _) = text.rows[index] else {
                return
            }
            close()
            open(filePath: path)
        case nil:
            break
        }
    }

    private func activate(_ row: QuickRow) {
        switch row {
        case .file(_, let file):
            close()
            open(filePath: file.path)
        case .command(_, let command):
            run(command)
        case .help(_, let prefix, _):
            value = prefix
            valueChanged()
        default:
            break
        }
    }

    private func run(_ command: PaletteItem) {
        if command.commandId == "edit.goToFile" {
            value = ""
            valueChanged()
            return
        }
        guard command.enabled else {
            return
        }
        close()
        if command.commandId != "commands.clearRecent" {
            recent.ranCommand(command.commandId)
        }
        switch command.commandId {
        case "edit.findInFiles", "edit.searchEverywhere":
            openSearch("")
        default:
            context.toasts.show(.info, "Not in the native app yet", detail: command.titleParts.map(\.text).joined())
        }
    }

    private func open(filePath: String) {
        recent.opened(filePath)
        Task { await context.editor.open(filePath, pin: true) }
    }
}
