// The Settings dialog's left column (.nav in SettingsDialog.svelte): 190 points of --panel-alt with a 1-point
// --border-strong edge, padding 16 / 10 / 12. The title (15 points, bold), the search field (28 tall, focused when the
// dialog opens, so it shows the --accent border and its 2-point ring), the sections that match the search (28 tall,
// 2 apart; the open one --selected at weight 500) and Reset to Defaults at the bottom.

import SwiftUI

struct SettingsNav: View {
    @Environment(\.theme) private var theme

    @Binding var query: String
    let sections: [(id: String, label: String)]
    let current: String
    let choose: (String) -> Void
    let reset: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ExactText(text: "Settings", size: 15, weight: .bold)
                .frame(height: 18)
                // Measured: the page sets the title half a point lower.
                .offset(y: 0.5)
                .padding(.leading, 8)
                .padding(.bottom, 14)
            searchField
                .padding(.bottom, 10)
            if sections.isEmpty {
                ExactText(text: "Nothing found", size: 13)
                    .foregroundStyle(theme.ink("--text-dim"))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
            }
            VStack(alignment: .leading, spacing: 2) {
                ForEach(sections, id: \.id) { section in
                    navItem(section.label, active: section.id == current) {
                        choose(section.id)
                    }
                }
            }
            Spacer(minLength: 0)
            Button(action: reset) {
                ExactText(text: "Reset to Defaults", size: 12)
                    .foregroundStyle(theme.ink("--danger"))
                    .padding(.horizontal, 10)
                    .frame(width: 169, height: 27, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(EdgeInsets(top: 16, leading: 10, bottom: 12, trailing: 10))
        .frame(width: 189, alignment: .topLeading)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(theme.color("--panel-alt"))
    }

    private func navItem(_ label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ExactText(text: label, size: 13, weight: active ? .medium : .regular)
                .foregroundStyle(theme.ink("--text"))
                .padding(.horizontal, 10)
                .frame(width: 169, height: 28, alignment: .leading)
                .background {
                    if active {
                        LayerFill(color: theme.srgbLayerColor("--selected"), cornerRadius: 6)
                    }
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// The search field, focused while the dialog is open: --accent border with a 2-point ring of --accent at 25%.
    private var searchField: some View {
        HStack(spacing: 6) {
            Icon(name: "search", size: 13)
                .foregroundStyle(theme.ink("--text-faint"))
            ZStack(alignment: .topLeading) {
                if query.isEmpty {
                    ExactText(text: "Search settings", size: 13)
                        .foregroundStyle(Color(nsColor: Theme.parse(WebKitDefaults.placeholder) ?? .gray))
                        .frame(height: 26)
                    theme.ink("--text")
                        .frame(width: 2, height: 15.29)
                        .offset(y: 5.11)
                }
                SearchInput(text: $query, textColor: theme.textColor("--text"), caretColor: theme.textColor("--text"))
                    .frame(height: 26)
            }
            if !query.isEmpty {
                IconButton(width: 16, height: 16, cornerRadius: 4, action: { query = "" }) {
                    Icon(name: "x", size: 12)
                        .foregroundStyle(theme.ink("--text-dim"))
                }
            }
        }
        .padding(.leading, 8)
        .padding(.trailing, 6)
        .frame(width: 167, height: 26)
        .background(RoundedRectangle(cornerRadius: 5, style: .circular).fill(theme.color("--panel")))
        .padding(1)
        .borderRing(theme.color("--accent"), cornerRadius: 6)
        .background {
            // box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent), over the nav.
            RoundedRectangle(cornerRadius: 8, style: .circular)
                .fill(theme.over("--accent", 0.25, on: "--panel-alt"))
                .padding(-2)
        }
    }
}
