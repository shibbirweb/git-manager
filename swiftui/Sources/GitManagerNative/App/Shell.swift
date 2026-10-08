// The window's layout, measured from the current app (swiftui/Reference/*.json, "layout" part):
// header, then activity bar, Changes sidebar, main area, Files panel, activity bar, then the status bar.
// The 1-point gaps between the sidebars and the main area are where the resize handles sit; they show
// the window background, as in the current app.

import SwiftUI

enum ShellMetrics {
    static let headerHeight: CGFloat = 42
    static let activityWidth: CGFloat = 44
    static let sidebarWidth: CGFloat = 260
    static let filesWidth: CGFloat = 260
    static let statusHeight: CGFloat = 24
    static let gap: CGFloat = 1
    static let border: CGFloat = 1
    /// The main area's breadcrumb strip ("storefront" above the welcome screen), its bottom line included.
    static let breadcrumbHeight: CGFloat = 29
}

/// The main area: the breadcrumb strip on --panel, a line, then the editor background (--editor-bg; white in
/// light mode like --panel, but darker in dark mode).
struct EditorArea<Breadcrumb: View, Content: View>: View {
    @Environment(\.theme) private var theme

    let breadcrumb: Breadcrumb
    let content: Content

    init(@ViewBuilder breadcrumb: () -> Breadcrumb, @ViewBuilder content: () -> Content) {
        self.breadcrumb = breadcrumb()
        self.content = content()
    }

    var body: some View {
        VStack(spacing: 0) {
            breadcrumb
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(height: ShellMetrics.breadcrumbHeight - ShellMetrics.border)
                .background(theme.color("--panel"))
            theme.color("--border-strong").frame(height: ShellMetrics.border)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(theme.color("--editor-bg"))
        }
    }
}

struct Shell<Header: View, LeftBar: View, Sidebar: View, Main: View, Files: View, RightBar: View, Status: View>: View {
    @Environment(\.theme) private var theme

    let header: Header
    let leftBar: LeftBar
    let sidebar: Sidebar
    let main: Main
    let files: Files
    let rightBar: RightBar
    let status: Status

    init(
        @ViewBuilder header: () -> Header,
        @ViewBuilder leftBar: () -> LeftBar,
        @ViewBuilder sidebar: () -> Sidebar,
        @ViewBuilder main: () -> Main,
        @ViewBuilder files: () -> Files,
        @ViewBuilder rightBar: () -> RightBar,
        @ViewBuilder status: () -> Status
    ) {
        self.header = header()
        self.leftBar = leftBar()
        self.sidebar = sidebar()
        self.main = main()
        self.files = files()
        self.rightBar = rightBar()
        self.status = status()
    }

    var body: some View {
        VStack(spacing: 0) {
            header
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(height: ShellMetrics.headerHeight - ShellMetrics.border)
                .background(theme.color("--panel"))
            horizontalLine
            HStack(spacing: 0) {
                activityBar(leftBar)
                verticalLine
                sidebar
                    .frame(width: ShellMetrics.sidebarWidth - ShellMetrics.border)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .background(theme.color("--panel"))
                verticalLine
                Color.clear.frame(width: ShellMetrics.gap)
                main
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(theme.color("--panel"))
                Color.clear.frame(width: ShellMetrics.gap)
                verticalLine
                files
                    .frame(width: ShellMetrics.filesWidth - ShellMetrics.border)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .background(theme.color("--panel"))
                verticalLine
                activityBar(rightBar)
            }
            horizontalLine
            status
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(height: ShellMetrics.statusHeight - ShellMetrics.border)
                .background(theme.color("--panel-alt"))
        }
        .background(theme.color("--bg"))
    }

    private var horizontalLine: some View {
        theme.color("--border-strong").frame(height: ShellMetrics.border)
    }

    private var verticalLine: some View {
        theme.color("--border-strong").frame(width: ShellMetrics.border)
    }

    private func activityBar(_ content: some View) -> some View {
        content
            .frame(width: ShellMetrics.activityWidth - ShellMetrics.border)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(theme.color("--panel-alt"))
    }
}
