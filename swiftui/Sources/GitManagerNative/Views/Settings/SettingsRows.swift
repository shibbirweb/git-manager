// A row of the Settings dialog (.row in SettingsDialog.svelte): the title (13 points, weight 500) and its hint
// (12 points, --text-dim) on the left, the control on the right, 20 points apart, centered; 12 points above and below
// and a 1-point --border line under it. The label takes its natural width unless the control needs the room: then the
// hint wraps, as a flex item that may shrink. A sub-row is indented 18 points.

import AppKit
import NativeCore
import SwiftUI

enum RowControl {
    case segmented([String], selected: Int?, choose: ((Int) -> Void)?)
    case toggle(Bool, toggle: (() -> Void)?)
    case range(fraction: Double, value: String, valueWidth: CGFloat)
    case field(StaticField.Kind, String)
    case none

    /// The control's width as the page lays it out.
    var width: CGFloat {
        switch self {
        case .segmented(let labels, _, _):
            let font = PageFont.ui(13)
            return labels.reduce(6) { $0 + ExactText.width($1, font: font) + 24 }
        case .toggle:
            return 34
        case .range(_, _, let valueWidth):
            return 174 + valueWidth
        case .field(let kind, let text):
            let textWidth = ExactText.width(text, font: PageFont.ui(12)) + 16 + (kind == .select ? 18 : 0)
            return kind == .input ? max(120, textWidth) : textWidth
        case .none:
            return 0
        }
    }
}

/// The width of the rows: the content's 568 points less the scrollbar's 10 and 22 points of padding on each side.
let settingsRowWidth: CGFloat = 514

struct SettingsRow: View {
    @Environment(\.theme) private var theme
    @Environment(\.settingsSearchWords) private var searchWords

    let title: String
    var hint: [TextRun] = []
    var control: RowControl = .none
    var sub = false
    /// A memory mark after the title (MemoryFlag.svelte), such as "up to +25 MB".
    var flag: String?

    init(_ title: String, hint: String = "", control: RowControl = .none, sub: Bool = false, flag: String? = nil) {
        self.title = title
        self.hint = hint.isEmpty ? [] : [TextRun(text: hint)]
        self.control = control
        self.sub = sub
        self.flag = flag
    }

    init(_ title: String, hintRuns: [TextRun], control: RowControl = .none, sub: Bool = false) {
        self.title = title
        hint = hintRuns
        self.control = control
        self.sub = sub
    }

    var body: some View {
        let available = settingsRowWidth - (sub ? 18 : 0)
        let hintText = hint.map(\.text).joined()
        let natural = max(ExactText.width(title, font: PageFont.ui(13, weight: .medium)),
                          ExactText.width(hintText, font: PageFont.ui(12)))
        let labelWidth = control.width > 0 ? min(natural, available - 20 - control.width) : available
        VStack(spacing: 0) {
            HStack(alignment: .center, spacing: 0) {
                VStack(alignment: .leading, spacing: 3) {
                    if !title.isEmpty {
                        HStack(spacing: 6) {
                            RowTitle(text: title, highlights: SettingsSearch.highlightRanges(title, searchWords))
                            if let flag {
                                MemoryFlag(text: flag)
                            }
                        }
                    }
                    if !hint.isEmpty {
                        WrappedText(runs: hint, width: labelWidth,
                                    highlights: SettingsSearch.highlightRanges(hintText, searchWords))
                    }
                }
                .frame(width: labelWidth, alignment: .leading)
                Spacer(minLength: 20)
                controlView
            }
            .padding(.leading, sub ? 18 : 0)
            .padding(.vertical, 12)
            theme.color("--border").frame(height: 1)
        }
        .frame(width: settingsRowWidth)
    }

    @ViewBuilder
    private var controlView: some View {
        switch control {
        case .segmented(let labels, let selected, let choose):
            SegmentedChoice(labels: labels, selected: selected, enabled: choose != nil, choose: choose ?? { _ in })
        case .toggle(let isOn, let toggle):
            SettingsSwitch(isOn: isOn, enabled: toggle != nil, toggle: toggle ?? {})
        case .range(let fraction, let value, let valueWidth):
            RangeReadout(fraction: fraction, value: value, valueWidth: valueWidth)
        case .field(let kind, let text):
            StaticField(kind: kind, text: text)
        case .none:
            EmptyView()
        }
    }
}

/// A memory mark (MemoryFlag.svelte): 10.5 points, weight 500, --warning on a 12% tint with a 45% border.
struct MemoryFlag: View {
    @Environment(\.theme) private var theme

    let text: String

    var body: some View {
        Text(text)
            .font(Font(PageFont.ui(10.5, weight: .medium)))
            .foregroundStyle(theme.ink("--warning"))
            .padding(.horizontal, 7)
            .frame(height: 18)
            .background(Capsule(style: .circular).fill(theme.over("--warning", 0.12, on: "--panel")))
            .overlay(BorderRing(cornerRadius: 9).fill(theme.over("--warning", 0.45, on: "--panel"),
                                                     style: FillStyle(eoFill: true)))
            .fixedSize()
    }
}

/// A group title (.group-title): 11 points, weight 600, upper case, 0.06em apart, --text-dim.
struct SettingsGroupTitle: View {
    @Environment(\.theme) private var theme

    let text: String
    var first = false

    var body: some View {
        ExactText(text: text.uppercased(), size: 11, weight: .semibold, tracking: 11 * 0.06)
            .foregroundStyle(theme.ink("--text-dim"))
            .padding(.top, first ? 6 : 18)
            .padding(.bottom, 2)
            .frame(width: settingsRowWidth, alignment: .leading)
    }
}

private struct SettingsSearchWordsKey: EnvironmentKey {
    static let defaultValue: [String] = []
}

extension EnvironmentValues {
    /// The words typed in the Settings search, for the rows' highlights.
    var settingsSearchWords: [String] {
        get { self[SettingsSearchWordsKey.self] }
        set { self[SettingsSearchWordsKey.self] = newValue }
    }
}
