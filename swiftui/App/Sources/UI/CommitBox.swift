// The commit box (src/lib/views/changes/CommitBox.svelte), measured in
// swiftui/Reference/changes-<mode>/commit-box.json: 10 points of padding under a 1-point line, the 96-point message
// field, then Amend, the summary, the gear and the split Commit button, then Sync Changes; 8 points apart.

import SwiftUI

struct CommitBox: View {
    @Environment(\.theme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    @State private var message = ""
    @State private var amend = false

    let stagedCount: Int
    let ahead: Int

    var body: some View {
        VStack(spacing: 0) {
            theme.color("--border-strong").frame(height: 1)
            VStack(spacing: 8) {
                messageField
                footer
                syncButton
            }
            .padding(10)
        }
        .background(theme.color("--panel"))
    }

    /// The message: 6-point corners, a --border-strong line, 8 and 6 points of padding, room for two tool buttons.
    private var messageField: some View {
        ZStack(alignment: .topLeading) {
            TextEditor(text: $message)
                .font(.system(size: 13))
                .scrollContentBackground(.hidden)
                .padding(.leading, 3)
                .padding(.trailing, 53)
                .padding(.vertical, 6)
            if message.isEmpty {
                // WebKit's own placeholder color (CSS darkgray), in light and dark alike.
                Text("Commit message")
                    .foregroundStyle(Color(nsColor: Theme.parse(WebKitDefaults.placeholder) ?? .gray))
                    .padding(.leading, 9)
                    .padding(.top, 8)
                    .allowsHitTesting(false)
            }
            HStack(spacing: 1) {
                Icon(name: "history", size: 13).frame(width: 22, height: 22)
                Icon(name: "file", size: 13).frame(width: 22, height: 22)
            }
            .foregroundStyle(theme.color("--text-dim"))
            .frame(maxWidth: .infinity, alignment: .topTrailing)
            .padding(3)
        }
        .frame(height: 96)
        .background(RoundedRectangle(cornerRadius: 6).fill(theme.color("--panel")))
        .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(theme.color("--border-strong"), lineWidth: 1))
    }

    private var footer: some View {
        HStack(spacing: 10) {
            Button {
                amend.toggle()
            } label: {
                HStack(spacing: 5) {
                    WebKitCheckbox(checked: amend, dark: colorScheme == .dark)
                    Text("Amend")
                }
            }
            .buttonStyle(.plain)
            // Amend keeps its width; the summary next to it is the part that gives way.
            .fixedSize()
            Text(stagedCount == 1 ? "1 file staged" : "\(stagedCount) files staged")
                .font(.system(size: 12))
                .foregroundStyle(theme.color("--text-dim"))
                .lineLimit(1)
                .truncationMode(.tail)
                // The summary takes the room left between Amend and the buttons, cut off with an ellipsis.
                .frame(maxWidth: .infinity, alignment: .leading)
            bordered(width: 27) {
                Icon(name: "settings", size: 13)
            }
            commitButton
        }
        .frame(height: 28)
    }

    /// The accent Commit button and its chevron, joined, at half opacity while there is nothing to commit.
    private var commitButton: some View {
        HStack(spacing: 1) {
            Text("Commit")
                .foregroundStyle(Color.white)
                .padding(.horizontal, 12)
                .frame(width: 73, height: 28)
                .background(HalfRoundedRectangle(roundedSide: .leading).fill(theme.color("--accent")))
                .opacity(message.isEmpty ? 0.5 : 1)
            Icon(name: "chevron-down", size: 13)
                .foregroundStyle(Color.white)
                .frame(width: 25, height: 28)
                .background(HalfRoundedRectangle(roundedSide: .trailing).fill(theme.color("--accent")))
        }
    }

    private var syncButton: some View {
        bordered(width: nil) {
            HStack(spacing: 6) {
                Icon(name: "sync", size: 13)
                Text("Sync Changes")
                    .padding(.trailing, ahead > 0 ? 4 : 0)
                if ahead > 0 {
                    HStack(spacing: 1) {
                        Text("\(ahead)")
                        Icon(name: "arrow-up", size: 11)
                    }
                }
            }
        }
    }

    /// A .btn: 28 points tall, 6-point corners, a --border-strong line on --panel.
    private func bordered(width: CGFloat?, @ViewBuilder content: () -> some View) -> some View {
        content()
            .frame(maxWidth: width == nil ? .infinity : nil)
            .frame(width: width, height: 28)
            .background(RoundedRectangle(cornerRadius: 6).fill(theme.color("--panel")))
            .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(theme.color("--border-strong"), lineWidth: 1))
    }
}

/// A rectangle with 6-point corners on one side only (the split button's halves); UnevenRoundedRectangle needs
/// macOS 14.
struct HalfRoundedRectangle: Shape {
    let roundedSide: HorizontalEdge
    var radius: CGFloat = 6

    func path(in rect: CGRect) -> Path {
        let leading = roundedSide == .leading ? radius : 0
        let trailing = roundedSide == .trailing ? radius : 0
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + leading, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - trailing, y: rect.minY))
        path.addArc(tangent1End: CGPoint(x: rect.maxX, y: rect.minY), tangent2End: CGPoint(x: rect.maxX, y: rect.maxY),
                    radius: trailing)
        path.addArc(tangent1End: CGPoint(x: rect.maxX, y: rect.maxY), tangent2End: CGPoint(x: rect.minX, y: rect.maxY),
                    radius: trailing)
        path.addArc(tangent1End: CGPoint(x: rect.minX, y: rect.maxY), tangent2End: CGPoint(x: rect.minX, y: rect.minY),
                    radius: leading)
        path.addArc(tangent1End: CGPoint(x: rect.minX, y: rect.minY), tangent2End: CGPoint(x: rect.maxX, y: rect.minY),
                    radius: leading)
        path.closeSubpath()
        return path
    }
}

/// The look WebKit gives form controls in the current app: not theme tokens, so they are kept here, as measured.
enum WebKitDefaults {
    static let placeholder = "#a9a9a9"
    static let checkboxBorderLight = "#808080"
    static let checkboxBorderDark = "#9a9a9a"
    static let checkboxFillLight = "#ffffff"
    static let checkboxFillDark = "#1e1e1e"
}

/// WebKit's 12-point checkbox: a 1.5-point border with slightly rounded corners and a check mark when on.
struct WebKitCheckbox: View {
    @Environment(\.theme) private var theme

    let checked: Bool
    let dark: Bool

    var body: some View {
        let border = Theme.parse(dark ? WebKitDefaults.checkboxBorderDark : WebKitDefaults.checkboxBorderLight)
        let fill = Theme.parse(dark ? WebKitDefaults.checkboxFillDark : WebKitDefaults.checkboxFillLight)
        ZStack {
            RoundedRectangle(cornerRadius: 2.5)
                .fill(checked ? theme.color("--accent") : Color(nsColor: fill ?? .white))
            RoundedRectangle(cornerRadius: 2.5)
                .strokeBorder(checked ? theme.color("--accent") : Color(nsColor: border ?? .gray), lineWidth: 1.5)
            if checked {
                Icon(name: "check", size: 10, strokeWidth: 3)
                    .foregroundStyle(Color.white)
            }
        }
        .frame(width: 12, height: 12)
    }
}
