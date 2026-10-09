// The window when git mergetool starts the app (`-mergeBase BASE -mergeLocal LOCAL -mergeRemote REMOTE
// -mergeMerged MERGED`, git's four paths): only the merge tool, titled "Merge <file>", like MergeToolApp.svelte.

import AppKit
import SwiftUI

struct MergetoolRoot: View {
    @ObservedObject private var center = MergeCenter.shared
    @ObservedObject private var toasts = ToastCenter.shared
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = Theme.standard(for: colorScheme)
        MergeScreen(center: center, mergetool: true)
            .overlay(alignment: .bottomTrailing) {
                ToastStack(center: toasts)
            }
            .background(theme.color("--bg").ignoresSafeArea())
            .toolbarBackground(theme.systemColor("--bg"), for: .windowToolbar)
            .toolbarBackground(.visible, for: .windowToolbar)
            .foregroundStyle(theme.ink("--text"))
            .font(.system(size: 13))
            .environment(\.theme, theme)
            .background(WindowChrome(background: theme.nsColor("--bg")))
            .navigationTitle("Merge \(((center.mergePath ?? "") as NSString).lastPathComponent)")
            .task {
                await center.loadMergetool()
            }
    }
}
