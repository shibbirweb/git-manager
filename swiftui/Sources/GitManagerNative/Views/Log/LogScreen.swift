// The Log in the main area (src/lib/views/LogView.svelte), measured in swiftui/Reference/log-<mode>: the 40-point
// toolbar, then the list, and once a commit is selected the list takes 55% of the rest above a line and the
// commit's details.

import NativeCore
import SwiftUI

struct LogScreen: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var model = LogModel.shared
    /// The list's share of the panes while a commit is selected (dragging the line moves it).
    @State private var listFraction = 0.55

    var body: some View {
        VStack(spacing: 0) {
            LogToolbar()
            GeometryReader { proxy in
                let height = proxy.size.height
                // The list's height in whole points: the page's 408.1 paints its line on the pixel at 408.
                let listHeight = model.selectedId == nil ? height : (height * listFraction).rounded(.down)
                VStack(spacing: 0) {
                    list
                        .frame(height: listHeight)
                    if model.selectedId != nil {
                        SplitLine(vertical: false)
                            .contentShape(Rectangle().inset(by: -2))
                            .gesture(DragGesture(coordinateSpace: .named("logPanes")).onChanged { drag in
                                listFraction = LogList.listFraction(
                                    pointerY: Double(drag.location.y), top: 0, height: Double(height)
                                )
                            })
                        CommitDetailsView()
                    }
                }
            }
            .coordinateSpace(name: "logPanes")
        }
        .background(theme.color("--panel"))
    }

    @ViewBuilder
    private var list: some View {
        if !model.initialLoaded {
            state("Loading history...")
        } else if let error = model.loadError, model.commits.isEmpty {
            state("Could not load history: \(error)")
        } else if model.commits.isEmpty {
            state("No commits to show.")
        } else {
            LogListView()
        }
    }

    private func state(_ text: String) -> some View {
        VStack(spacing: 0) {
            Text(text)
                .foregroundStyle(theme.ink("--text-dim"))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

/// .toolbar: 40 points with a --border-strong line below, 8 points of padding, 6 between the items: the filter, All
/// branches, Refresh, then the count and Hide Log at the end.
struct LogToolbar: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var model = LogModel.shared

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                filter
                allBranches
                IconButton(width: 28, height: 28, disabled: model.loading, action: refresh) {
                    Icon(name: "refresh", size: 14)
                }
                Spacer(minLength: 0)
                if model.initialLoaded && !model.commits.isEmpty {
                    ExactText(
                        text: LogFormat.countLabel(
                            loaded: model.commits.count, hasMore: model.hasMore, filtered: model.filtered?.count
                        )
                    )
                    .foregroundStyle(theme.ink("--text-dim"))
                }
                IconButton(width: 28, height: 28, action: model.hide) {
                    Icon(name: "x", size: 14)
                }
            }
            .padding(.horizontal, 8)
            .frame(height: 39)
            theme.color("--border-strong").frame(height: 1)
        }
    }

    /// .filter: a 300 x 26 .input with the 13-point search icon 8 points in and the text 27 points in.
    private var filter: some View {
        ZStack(alignment: .leading) {
            TextField("", text: $model.filterText)
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .padding(.leading, 28)
                .padding(.trailing, 27)
            if model.filterText.isEmpty {
                Text("Filter by message, author or hash")
                    .foregroundStyle(Color(nsColor: Theme.parse(WebKitDefaults.placeholder) ?? .gray))
                    .padding(.leading, 28)
                    .allowsHitTesting(false)
            }
            Icon(name: "search", size: 13)
                .foregroundStyle(theme.ink("--text-dim"))
                .padding(.leading, 8)
        }
        .frame(width: 300, height: 26)
        .background(RoundedRectangle(cornerRadius: 6, style: .circular).fill(theme.color("--panel")))
        .borderRing(theme.color("--border-strong"), cornerRadius: 6)
    }

    /// .toggle: 26 points, 9 points of padding, the 13-point branch icon 5 points before the text; while on, the
    /// border is the accent mixed 55% into --border-strong and the fill 12% accent over --panel.
    private var allBranches: some View {
        let on = model.allRefs
        return HStack(spacing: 5) {
            Icon(name: "branch", size: 13)
            ExactText(text: "All branches", size: 13)
        }
        .foregroundStyle(theme.ink(on ? "--text" : "--text-dim"))
        .padding(.horizontal, 10)
        .frame(height: 26)
        .background(RoundedRectangle(cornerRadius: 6, style: .circular)
            .fill(on ? theme.mix("--accent", 0.12, "--panel") : theme.color("--panel")))
        .borderRing(on ? theme.mix("--accent", 0.55, "--border-strong") : theme.color("--border-strong"),
                    cornerRadius: 6)
        .fixedSize()
        .contentShape(Rectangle())
        .onTapGesture {
            model.toggleAllRefs(repoPath: AppModel.shared.repoPath)
        }
    }

    private func refresh() {
        if let repoPath = AppModel.shared.repoPath {
            Task {
                await model.reload(repoPath: repoPath)
            }
        }
    }
}
