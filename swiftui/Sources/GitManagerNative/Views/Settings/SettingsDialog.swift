// The Settings dialog (src/lib/views/SettingsDialog.svelte) over the window: the overlay and the dialog's shadow
// (DialogBackdrop), then the dialog, 760 x 520 (or less in a small window), centered, 8% of the height from the top,
// with 12-point corners and a 1-point --border-strong frame. The section list on the left, the open section's title,
// close button and rows on the right. Escape empties the search first, then closes; a click outside closes.

import AppKit
import NativeCore
import SwiftUI

struct SettingsDialog: View {
    @Environment(\.theme) private var theme
    @Environment(\.displayScale) private var displayScale
    @ObservedObject var settings: SettingsStore

    @State private var query = ""
    @State private var keyMonitor: Any?

    var body: some View {
        GeometryReader { proxy in
            let frame = Self.dialogFrame(in: proxy.size, scale: displayScale)
            ZStack(alignment: .topLeading) {
                DialogBackdrop(dialog: frame, cornerRadius: 12, overlayAlpha: theme.alpha("--overlay"),
                               shadow: DialogBackdrop.parseShadow(theme.raw("--shadow") ?? ""))
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { close() }
                dialog
                    // The page lays the dialog out 8% down, unrounded (67.84 in an 848-point window); its icons
                    // snap to whole points from there.
                    .svgBias(proxy.size.height * 0.08 - frame.minY)
                    .frame(width: frame.width, height: frame.height)
                    .offset(x: frame.minX, y: frame.minY)
            }
        }
        .onAppear {
            keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
                // Escape (53): the search first, then the dialog.
                guard event.keyCode == 53 else {
                    return event
                }
                if !query.isEmpty {
                    query = ""
                } else {
                    close()
                }
                return nil
            }
        }
        .onDisappear {
            if let keyMonitor {
                NSEvent.removeMonitor(keyMonitor)
            }
            keyMonitor = nil
        }
    }

    /// The dialog's box in the view: min(760, width - 32) by min(520, 84% of the height), centered, 8% down,
    /// on whole device pixels as WebKit places the dialog's layer.
    static func dialogFrame(in size: CGSize, scale: CGFloat) -> CGRect {
        let width = min(760, size.width - 32), height = min(520, size.height * 0.84)
        let snap = { (value: CGFloat) in (value * scale).rounded() / scale }
        return CGRect(x: snap((size.width - width) / 2), y: snap(size.height * 0.08), width: width, height: height)
    }

    private var searchWords: [String] {
        SettingsSearch.words(query)
    }

    /// The sections with a match: by name, by one of their rows, or all of them without a search.
    private var visibleSections: [(id: String, label: String)] {
        let words = searchWords
        if words.isEmpty {
            return SettingsSearchIndex.sections
        }
        let found = SettingsSearch.matchingEntries(words, sectionLabels: SettingsSearchIndex.sectionLabels,
                                                   index: SettingsSearchIndex.entries)
        return SettingsSearchIndex.sections.filter { section in
            SettingsSearch.matches(section.label, words) || found.contains { $0.section == section.id }
        }
    }

    private var dialog: some View {
        let sections = visibleSections
        // Stay on the open section while it matches; otherwise show the first one that does.
        let current = sections.contains { $0.id == settings.dialogSection } ? settings.dialogSection
            : (sections.first?.id ?? settings.dialogSection)
        let label = SettingsSearchIndex.sectionLabels[current] ?? ""
        return HStack(spacing: 0) {
            SettingsNav(query: $query, sections: sections, current: current,
                        choose: { settings.dialogSection = $0 }, reset: resetToDefaults)
            theme.color("--border-strong").frame(width: 1)
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    ExactText(text: label, size: 14, weight: .bold)
                    Spacer(minLength: 0)
                    IconButton(action: close) {
                        Icon(name: "x", size: 15)
                    }
                }
                .padding(EdgeInsets(top: 14, leading: 22, bottom: 8, trailing: 12))
                if let error = settings.loadError {
                    SettingsErrorBanner(message: error, retry: settings.reload)
                }
                SettingsScroll(resetKey: current + "\n" + query, reportsMetrics: true) {
                    SettingsSectionView(settings: settings, section: current,
                                        showSection: { settings.dialogSection = $0 })
                        .environment(\.settingsSearchWords, searchWords)
                        .environment(\.settingsSectionLabel, label)
                        .padding(EdgeInsets(top: 4, leading: 22, bottom: 20, trailing: 22))
                        .opacity(sections.isEmpty ? 0 : 1)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .background(theme.color("--panel"))
        .clipShape(RoundedRectangle(cornerRadius: 11, style: .circular))
        .padding(1)
        .background(RoundedRectangle(cornerRadius: 12, style: .circular).fill(theme.color("--border-strong")))
        .contentShape(Rectangle())
        .onTapGesture {}
    }

    private func close() {
        settings.dialogOpen = false
    }

    /// Reset to Defaults asks first, as the current app does, and puts back the settings the native app owns.
    private func resetToDefaults() {
        let alert = NSAlert()
        alert.messageText = "Reset all settings to their defaults?"
        alert.informativeText = "Your color themes, layout and editor choices go back to how they were at install."
        alert.addButton(withTitle: "Reset")
        alert.addButton(withTitle: "Cancel")
        alert.buttons.first?.hasDestructiveAction = true
        if alert.runModal() == .alertFirstButtonReturn {
            settings.update { $0 = NativePreferences() }
        }
    }
}

/// The open section's rows: Appearance and the color themes work; the rest come from SettingsCatalog.
struct SettingsSectionView: View {
    @ObservedObject var settings: SettingsStore
    let section: String
    let showSection: (String) -> Void

    var body: some View {
        switch section {
        case "appearance":
            AppearanceSection(settings: settings, showSection: showSection)
        case "editor":
            VStack(alignment: .leading, spacing: 0) {
                ColorThemeRow(settings: settings)
                SettingsBlocks(blocks: SettingsCatalog.blocks(SettingsCatalog.items("editor"), section: section,
                                                              settings: settings))
            }
        case "merge":
            SettingsBlocks(blocks: gitBlocks)
        default:
            SettingsBlocks(blocks: SettingsCatalog.blocks(SettingsCatalog.items(section), section: section,
                                                          settings: settings))
        }
    }

    /// Git, with the Commit box row (it works: the Changes header's layout button follows it) under Commit messages.
    private var gitBlocks: [SettingsBlock] {
        var blocks = SettingsCatalog.blocks(SettingsCatalog.items("merge"), section: "merge", settings: settings)
        let index = (blocks.firstIndex { $0.label == "Commit messages" } ?? blocks.count - 1) + 1
        let layouts = [("single", "Single"), ("perRepo", "Per repository")]
        let keywords = SettingsSearchIndex.keywords(section: "merge", label: "Commit box")
        blocks.insert(.row("Commit box", keywords) {
            SettingsRow("Commit box", hint: "Single puts one commit box under the Changes list, with a picker for the "
                + "repository, like JetBrains IDEs. Per repository puts a commit box at the top of each repository, "
                + "like VS Code. The button in the Changes header switches it too.", control: .segmented(
                    layouts.map(\.1),
                    selected: layouts.firstIndex { $0.0 == settings.preferences.commitBoxLayout },
                    choose: { choice in settings.update { $0.commitBoxLayout = layouts[choice].0 } }
                ))
        }, at: min(index, blocks.count))
        return blocks
    }
}
