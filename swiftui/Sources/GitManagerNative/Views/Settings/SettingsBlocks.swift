// A section's blocks in page order (group titles, their hints, rows, sub-rows), each with the words the search finds
// it by (settingsSearch.ts's index). While a search is typed, only the blocks SettingsSearch.visibleBlocks keeps show.

import NativeCore
import SwiftUI

struct SettingsBlock {
    let kind: SearchBlockKind
    let label: String
    let keywords: String
    let view: AnyView

    static func row<V: View>(_ label: String, _ keywords: String = "", @ViewBuilder _ view: () -> V) -> Self {
        SettingsBlock(kind: .row, label: label, keywords: keywords, view: AnyView(view()))
    }

    static func subRow<V: View>(_ label: String, _ keywords: String = "", @ViewBuilder _ view: () -> V) -> Self {
        SettingsBlock(kind: .subRow, label: label, keywords: keywords, view: AnyView(view()))
    }

    static func group(_ label: String, _ keywords: String = "", first: Bool = false) -> Self {
        SettingsBlock(kind: .group, label: label, keywords: keywords,
                      view: AnyView(SettingsGroupTitle(text: label, first: first)))
    }

    static func other<V: View>(@ViewBuilder _ view: () -> V) -> Self {
        SettingsBlock(kind: .other, label: "", keywords: "", view: AnyView(view()))
    }
}

struct SettingsBlocks: View {
    @Environment(\.settingsSearchWords) private var searchWords
    @Environment(\.settingsSectionLabel) private var sectionLabel

    let blocks: [SettingsBlock]

    var body: some View {
        let visible = searchWords.isEmpty ? blocks.map { _ in true } : SettingsSearch.visibleBlocks(blocks.map {
            (kind: $0.kind, matched: !$0.label.isEmpty
                && SettingsSearch.matches("\($0.label) \($0.keywords) \(sectionLabel)", searchWords))
        })
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { index, block in
                if visible[index] {
                    block.view
                }
            }
        }
    }

    /// The search entries of `blocks`, for the section list.
    static func entries(_ blocks: [SettingsBlock], section: String) -> [SettingsSearchEntry] {
        blocks.filter { !$0.label.isEmpty }.map {
            SettingsSearchEntry(section: section, label: $0.label, keywords: $0.keywords)
        }
    }
}

private struct SettingsSectionLabelKey: EnvironmentKey {
    static let defaultValue = ""
}

extension EnvironmentValues {
    /// The open section's name, which the search also matches ("appearance" finds every row there).
    var settingsSectionLabel: String {
        get { self[SettingsSectionLabelKey.self] }
        set { self[SettingsSectionLabelKey.self] = newValue }
    }
}
