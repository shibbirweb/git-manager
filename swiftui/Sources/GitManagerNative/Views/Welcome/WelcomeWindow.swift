// The window without a folder (src/lib/views/Welcome.svelte), laid out like the JetBrains welcome screen: a 240-point
// sidebar on --panel-alt (brand, Projects, Customize and Learn, the GitHub links and the gear) and the page on
// --panel, which shows the Projects, Customize or Learn page.

import AppKit
import NativeCore
import SwiftUI

/// The sidebar's pages.
enum WelcomeSection {
    case projects, customize, learn
}

struct WelcomeWindow: View {
    @Environment(\.theme) private var theme
    @State private var section = WelcomeSection.projects

    var body: some View {
        HStack(spacing: 0) {
            WelcomeSidebar(section: $section)
            Group {
                switch section {
                case .projects:
                    ProjectsPage()
                case .customize:
                    WelcomeCustomize()
                case .learn:
                    WelcomeLearn()
                }
            }
            .padding(.top, 22)
            .padding(.horizontal, 26)
            .padding(.bottom, 16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .background(theme.color("--panel"))
    }
}

/// Projects: the recent projects, or the hello page while there are none.
private struct ProjectsPage: View {
    @ObservedObject private var store = RecentProjectsStore.shared

    var body: some View {
        if RecentProjects.entries(store.lists).isEmpty {
            WelcomeProjects()
        } else {
            WelcomeRecentList()
        }
    }
}

/// .sidebar: 20 points down, 12 in and 14 up from the bottom, a 1-point --border on the right.
private struct WelcomeSidebar: View {
    @Environment(\.windowContext) private var windowContext
    @Environment(\.theme) private var theme
    @Binding var section: WelcomeSection

    private static let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            brand
            // .sections: 36-point rows 2 apart; Projects is the page shown.
            VStack(spacing: 2) {
                SidebarRow(label: "Projects", active: section == .projects) { section = .projects }
                SidebarRow(label: "Customize", active: section == .customize) { section = .customize }
                SidebarRow(label: "Learn", active: section == .learn) { section = .learn }
            }
            Spacer(minLength: 0)
            // .sidebar-links: 30-point rows 2 apart, 10 points above the foot.
            VStack(spacing: 2) {
                SidebarLink(icon: "star", label: "Star on GitHub") { open(GitHubLinks.repository) }
                SidebarLink(icon: "bug", label: "Report a Bug") {
                    open(GitHubLinks.bugReport(version: Self.version, platform: Self.platform))
                }
                SidebarLink(icon: "lightbulb", label: "Request a Feature") { open(GitHubLinks.featureRequest()) }
            }
            .padding(.bottom, 10)
            // .sidebar-foot: a --border line, then the 30-point gear 10 points below it, 6 in.
            VStack(alignment: .leading, spacing: 0) {
                theme.color("--border").frame(height: 1)
                IconButton(width: 30, height: 30, surface: "--panel-alt",
                           action: { SettingsStore.shared.openDialog() }) {
                    Icon(name: "settings", size: 15)
                }
                .padding(.top, 10)
                .padding(.horizontal, 6)
            }
        }
        .padding(.top, 20)
        .padding(.horizontal, 12)
        .padding(.bottom, 14)
        .frame(width: 239)
        .frame(maxHeight: .infinity)
        .background(theme.color("--panel-alt"))
        .overlay(alignment: .trailing) {
            theme.color("--border").frame(width: 1).offset(x: 1)
        }
        .padding(.trailing, 1)
    }

    /// .brand: the 40-point logo, 12 points before the name (15 points, semibold) over the version (12, dim).
    private var brand: some View {
        HStack(spacing: 12) {
            Icon(name: "merge", size: 22)
                .foregroundStyle(theme.ink("--accent-text"))
                .frame(width: 40, height: 40)
                .background(RoundedRectangle(cornerRadius: 10, style: .circular).fill(theme.color("--accent")))
            VStack(alignment: .leading, spacing: 2) {
                ExactText(text: "Git Manager", size: 15, weight: .semibold)
                    .foregroundStyle(theme.ink("--text"))
                if let version = Self.version {
                    ExactText(text: version, size: 12)
                        .foregroundStyle(theme.ink("--text-dim"))
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.bottom, 26)
    }

    /// "macOS 26.4" for bug reports, as osLabel words it.
    private static var platform: String {
        let os = ProcessInfo.processInfo.operatingSystemVersion
        let patch = os.patchVersion > 0 ? ".\(os.patchVersion)" : ""
        return "macOS \(os.majorVersion).\(os.minorVersion)\(patch)"
    }

    private func open(_ url: String) {
        if let link = URL(string: url) {
            NSWorkspace.shared.open(link)
        }
    }

    private func notBuilt(_ page: String) {
        windowContext?.toasts.show(.info, "\(page) is not in the native app yet")
    }
}

/// .section: 36 points tall, 12 in, --text; --selected when shown, --hover under the mouse.
private struct SidebarRow: View {
    @Environment(\.theme) private var theme
    @State private var hovered = false

    let label: String
    var active = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ExactText(text: label, size: 13)
                .foregroundStyle(theme.ink("--text"))
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(height: 36)
                .background {
                    // --selected as the page fills it: an sRGB layer macOS converts (as in the Settings dialog).
                    if active {
                        LayerFill(color: theme.srgbLayerColor("--selected"), cornerRadius: 6)
                    } else if hovered {
                        RoundedRectangle(cornerRadius: 6, style: .circular)
                            .fill(theme.solid("--hover", on: "--panel-alt"))
                    }
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .pageHover { hovered = $0 }
    }
}

/// .sidebar-link: 30 points tall, 12 in, the 14-point icon 10 points before the label, --text-dim (--text under the
/// mouse, on --hover).
private struct SidebarLink: View {
    @Environment(\.theme) private var theme
    @State private var hovered = false

    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Icon(name: icon, size: 14)
                ExactText(text: label, size: 13)
            }
            .foregroundStyle(theme.ink(hovered ? "--text" : "--text-dim"))
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: 30)
            .background(RoundedRectangle(cornerRadius: 6, style: .circular)
                .fill(hovered ? theme.color("--hover") : .clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .pageHover { hovered = $0 }
    }
}
