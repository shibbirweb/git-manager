// What the Log shows (src/lib/views/LogView.svelte and src/lib/log/CommitDetails.svelte): the loaded history with its
// graph rows, page after page, the filter, the selected commit, its details and the diff of its selected file. The
// history lives in plain arrays, not published ones; `version` tells the views that they changed.

import Foundation
import NativeCore

@MainActor
final class LogModel: ObservableObject {
    static let shared = LogModel()

    /// The Log replaces the main area while it shows (the History activity, or `app action=show_log`).
    @Published private(set) var shown = false
    @Published var version = 0
    @Published private(set) var loading = false
    @Published private(set) var initialLoaded = false
    @Published private(set) var hasMore = true
    @Published private(set) var loadError: String?
    @Published var filterText = ""
    /// Every local and remote branch (the toolbar's All branches, on by default like settings.logAllRefs).
    @Published private(set) var allRefs = true
    @Published var selectedId: String?
    @Published var details: CommitDetails?
    @Published var selectedPath: String?
    @Published var diff: OpenDiff?
    /// The selected file's diff is on screen with its colors (or failed): what `app action=show_log` waits for.
    var diffSettled = false

    private(set) var commits: [CommitSummary] = []
    private(set) var rows: [GraphRow] = []
    private var indexById: [String: Int] = [:]
    private var builder = GraphBuilder(colorCount: LogGraphCell.laneColors.count)
    private(set) var laneCount = 1
    private var loadedRepoPath: String?
    private var generation = 0

    var query: String {
        filterText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// Indices into `commits` matching the filter, or nil when unfiltered.
    var filtered: [Int]? {
        let text = query
        if text.isEmpty {
            return nil
        }
        return commits.indices.filter { index in
            let commit = commits[index]
            return LogList.matches(
                query: text, commitId: commit.id, summary: commit.summary, authorName: commit.authorName,
                authorEmail: commit.authorEmail
            )
        }
    }

    func index(of commitId: String) -> Int? {
        indexById[commitId]
    }

    func toggle(repoPath: String?) {
        if shown {
            shown = false
            return
        }
        show(repoPath: repoPath)
    }

    func show(repoPath: String?) {
        shown = true
        if let repoPath, repoPath != loadedRepoPath || !initialLoaded {
            Task {
                await reload(repoPath: repoPath)
            }
        }
    }

    func hide() {
        shown = false
    }

    func toggleAllRefs(repoPath: String?) {
        allRefs.toggle()
        if let repoPath {
            Task {
                await reload(repoPath: repoPath)
            }
        }
    }

    /// Reads the first page again and selects the newest commit, or keeps the selection when it is still loaded.
    func reload(repoPath: String) async {
        generation += 1
        let token = generation
        let sameRepo = repoPath == loadedRepoPath
        let count = sameRepo ? min(max(commits.count, LogList.pageSize), 3000) : LogList.pageSize
        let keepId = sameRepo ? selectedId : nil
        loading = true
        loadError = nil
        let args = GetLogArgs(repoPath: repoPath, offset: 0, limit: count, allRefs: allRefs, knownTips: nil)
        let result = await Task.detached { () -> Result<LogPage, BackendError> in
            Self.read { try Backend.call("get_log", args) as LogPage }
        }.value
        guard token == generation else {
            return
        }
        loading = false
        initialLoaded = true
        loadedRepoPath = repoPath
        resetData()
        switch result {
        case .success(let page):
            let fresh = page.commits ?? []
            append(fresh)
            hasMore = fresh.count >= count
            let keep = keepId.flatMap { indexById[$0] == nil ? nil : $0 }
            await select(keep ?? commits.first?.id, repoPath: repoPath)
        case .failure(let error):
            loadError = error.message
            version += 1
        }
    }

    /// The next page, once the drawn rows come close to the end (never while filtering).
    func loadMore() async {
        guard let repoPath = loadedRepoPath, !loading, hasMore, initialLoaded, query.isEmpty, loadError == nil else {
            return
        }
        let token = generation
        loading = true
        let args = GetLogArgs(
            repoPath: repoPath, offset: commits.count, limit: LogList.pageSize, allRefs: allRefs, knownTips: nil
        )
        let result = await Task.detached { () -> Result<LogPage, BackendError> in
            Self.read { try Backend.call("get_log", args) as LogPage }
        }.value
        guard token == generation else {
            return
        }
        loading = false
        switch result {
        case .success(let page):
            let next = page.commits ?? []
            append(next)
            hasMore = next.count >= LogList.pageSize
        case .failure(let error):
            loadError = error.message
            ToastCenter.shared.show(.error, "Could not load more history", detail: error.message)
        }
    }

    private func resetData() {
        commits = []
        rows = []
        indexById = [:]
        builder = GraphBuilder(colorCount: LogGraphCell.laneColors.count)
        laneCount = 1
    }

    private func append(_ page: [CommitSummary]) {
        let pageRows = builder.push(page.map { GraphCommit(commitId: $0.id, parents: $0.parents) })
        for (offset, commit) in page.enumerated() {
            indexById[commit.id] = commits.count
            commits.append(commit)
            rows.append(pageRows[offset])
        }
        laneCount = max(1, builder.maxWidth)
        version += 1
    }

    nonisolated static func read<Value>(_ work: () throws -> Value) -> Result<Value, BackendError> {
        do {
            return .success(try work())
        } catch let error as BackendError {
            return .failure(error)
        } catch {
            return .failure(BackendError(kind: "bridge", message: error.localizedDescription))
        }
    }
}
