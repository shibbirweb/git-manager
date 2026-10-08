// The Log's commit list (LogView.svelte .list): the 24-point column heads, then the rows. Only the rows around the
// viewport are built (LogList.visibleRange, 12 rows of overscan, as the page does), placed at their offset under a
// transparent scroll view that takes the wheel, the clicks, the hover and the keys, so a long history costs no more
// than a short one.

import AppKit
import NativeCore
import SwiftUI

struct LogListView: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var model = LogModel.shared
    @State private var scrollTop: CGFloat = 0
    @State private var viewportHeight: CGFloat = 0
    @State private var hovered: Int?
    @State private var scrollRequest = LogScrollHost.Request(token: 0, offset: 0)
    /// The minute the relative dates were worked out at; they move on once a minute, like the page's timer.
    @State private var now = Date()

    var body: some View {
        let filtered = model.filtered
        let count = filtered?.count ?? model.commits.count
        let nodeOnly = !model.query.isEmpty
        let graphWidth = CGFloat(LogGraphCell.columnWidth(laneCount: nodeOnly ? 1 : model.laneCount))
        VStack(spacing: 0) {
            columns(graphWidth: graphWidth)
            GeometryReader { proxy in
                let range = LogList.visibleRange(
                    scrollTop: Double(scrollTop), viewportHeight: Double(proxy.size.height), count: count
                )
                ZStack(alignment: .topLeading) {
                    ForEach(Array(range), id: \.self) { position in
                        if let commit = model.commit(at: position), let index = model.index(of: commit.id) {
                            LogRowView(
                                commit: commit, row: model.rows[index], graphWidth: graphWidth,
                                selected: commit.id == model.selectedId, hovered: hovered == position,
                                nodeOnly: nodeOnly, date: LogFormat.relativeTime(commit.time, now: now)
                            )
                            .offset(y: CGFloat(position) * LogList.rowHeight - scrollTop)
                        }
                    }
                    LogScrollHost(
                        contentHeight: CGFloat(count) * LogList.rowHeight, request: scrollRequest,
                        onScroll: { scrollTop = $0 }, onHover: { hovered = $0 }, onClick: select, onKey: key
                    )
                }
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
                .clipped()
                .overlay(alignment: .topTrailing) {
                    scrollbar(count: count, height: proxy.size.height)
                }
                .onAppear { viewportHeight = proxy.size.height }
                .onChange(of: proxy.size.height) { viewportHeight = $0 }
                .onChange(of: range.upperBound) { _ in
                    if LogList.nearEnd(range, count: count), model.hasMore, !model.loading, !nodeOnly {
                        Task {
                            await model.loadMore()
                        }
                    }
                }
            }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60_000_000_000)
                now = Date()
            }
        }
    }

    /// .columns: --panel-alt with a --border line below, 11.5-point dim heads; 20 points of padding at the end, so
    /// the heads sit 10 points left of the row columns, as on the page.
    private func columns(graphWidth: CGFloat) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                head("Subject").padding(.leading, graphWidth + 4).frame(maxWidth: .infinity, alignment: .leading)
                head("Author").padding(.leading, 12).frame(width: 150, alignment: .leading)
                head("Date").padding(.leading, 12).frame(width: 110, alignment: .leading)
                head("Hash").padding(.leading, 12).frame(width: 82, alignment: .leading)
            }
            .padding(.trailing, 20)
            .frame(height: 23)
            theme.color("--border").frame(height: 1)
        }
        .background(theme.color("--panel-alt"))
    }

    private func head(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11.5))
            .foregroundStyle(theme.ink("--text-dim"))
            .lineLimit(1)
            // 11.5-point text with the normal line height: WebKit sets it half a point lower (measured elsewhere).
            .offset(y: 0.5)
    }

    /// The page's ::-webkit-scrollbar thumb: 10 points wide with a 2-point transparent border, --text-dim at 35%.
    @ViewBuilder
    private func scrollbar(count: Int, height: CGFloat) -> some View {
        let total = CGFloat(count) * LogList.rowHeight
        if total > height, height > 0 {
            let thumb = max(20, height * height / total)
            let top = (height - thumb) * min(1, max(0, scrollTop / (total - height)))
            Capsule(style: .circular)
                .fill(theme.over("--text-dim", 0.35, on: "--panel"))
                .frame(width: 6, height: thumb - 4)
                .padding(2)
                .offset(y: top)
                .allowsHitTesting(false)
        }
    }

    private func select(_ position: Int) {
        guard let commit = model.commit(at: position) else {
            return
        }
        Task {
            await model.select(commit.id)
        }
    }

    private func key(_ key: LogList.Key) {
        let count = model.filtered?.count ?? model.commits.count
        guard count > 0 else {
            return
        }
        let target = LogList.target(key, current: model.selectedPosition, count: count,
                                    viewportHeight: Double(viewportHeight))
        let position = LogList.clamp(target, count: count)
        let offset = LogList.ensureVisible(
            position: position, scrollTop: Double(scrollTop), viewportHeight: Double(viewportHeight)
        )
        scrollRequest = LogScrollHost.Request(token: scrollRequest.token + 1, offset: CGFloat(offset))
        select(position)
    }
}
