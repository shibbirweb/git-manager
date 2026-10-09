// The Projects page with no recent projects (Welcome.svelte .hello), centered in the page with 32 points of padding,
// 12 apart: the 72-point logo, "Welcome to Git Manager" (22 points, semibold, 14 points further down), the two-line
// hint in --text-dim at a 1.6 line height (20 points a line on the page), then 30 points further down the Open,
// Clone Repository and Open Workspace tiles, 112 wide and 32 apart.

import AppKit
import SwiftUI

struct WelcomeProjects: View {
    @Environment(\.theme) private var theme

    var body: some View {
        VStack(spacing: 12) {
            Icon(name: "merge", size: 34)
                .foregroundStyle(theme.ink("--accent-text"))
                .frame(width: 72, height: 72)
                .background(RoundedRectangle(cornerRadius: 18, style: .circular).fill(theme.color("--accent")))
            ExactText(text: "Welcome to Git Manager", size: 22, weight: .semibold)
                .foregroundStyle(theme.ink("--text"))
                .padding(.top, 14)
            VStack(spacing: 0) {
                hintLine("Open a folder with one repository, many repositories, or none yet.")
                hintLine("Or clone one from a server.")
            }
            HStack(alignment: .top, spacing: 32) {
                WelcomeTile(icon: "folder", label: "Open") {
                    if let folderPath = HeaderMenus.pickFolder() {
                        Task {
                            await AppModel.shared.openFolder(folderPath)
                        }
                    }
                }
                WelcomeTile(icon: "cloud-download", label: "Clone Repository") { CloneCenter.shared.open() }
                WelcomeTile(icon: "folder-git", label: "Open Workspace") {
                    AppModel.shared.pickAndOpenWorkspaceFile()
                }
            }
            .padding(.top, 30)
        }
        .padding(32)
        .modifier(WholePointCenter())
    }

    /// One line of the hint: line-height 1.6 is 20.8 points, but the page's lines are 20 apart (measured).
    private func hintLine(_ text: String) -> some View {
        ExactText(text: text, size: 13)
            .foregroundStyle(theme.ink("--text-dim"))
            .frame(height: 20)
    }
}

/// .tile: a 64-point --panel-alt square with 16-point corners and a --border-strong ring around the 24-point icon,
/// the label 10 points below; under the mouse the ring and icon turn --accent.
private struct WelcomeTile: View {
    @Environment(\.theme) private var theme
    @State private var hovered = false

    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 10) {
                Icon(name: icon, size: 24)
                    .foregroundStyle(theme.ink(hovered ? "--accent" : "--text"))
                    .frame(width: 64, height: 64)
                    .background(RoundedRectangle(cornerRadius: 16, style: .circular).fill(theme.color("--panel-alt")))
                    .borderRing(theme.color(hovered ? "--accent" : "--border-strong"), cornerRadius: 16)
                ExactText(text: label, size: 13)
                    .foregroundStyle(theme.ink("--text"))
            }
            .frame(width: 112)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .pageHover { hovered = $0 }
    }
}
