// Mirrors of the merge tool's backend types (src/lib/types.ts MergeDocument, ConflictSummary), decoded from the
// bridge's merge commands (swiftui/bridge/src/commands/merge.rs).

import Foundation
import NativeCore

struct MergeDocumentDTO: Decodable, Equatable {
    let path: String
    /// bothModified, bothAdded, deletedByUs or deletedByThem.
    let kind: String
    let binary: Bool
    let base: String
    let ours: String
    let theirs: String
    let oursLabel: String
    let theirsLabel: String
    /// "lf" or "crlf", handed back when saving.
    let eol: String
    let ignoreWhitespace: Bool
    let chunks: [MergeChunk]
}

struct ConflictFileDTO: Decodable, Equatable, Identifiable {
    let path: String
    let kind: String
    let binary: Bool

    var id: String {
        path
    }
}

struct OpStateDTO: Decodable, Equatable {
    /// none, merge, rebase, cherryPick, revert or other.
    let kind: String
    let description: String?
    let oursLabel: String?
    let theirsLabel: String?
}

struct ConflictSummaryDTO: Decodable, Equatable {
    let op: OpStateDTO
    let files: [ConflictFileDTO]
}

struct RepoPathArgs: Encodable {
    let repoPath: String
}

struct LoadConflictArgs: Encodable {
    let repoPath: String
    let conflictPath: String
    let ignoreWhitespace: Bool
}

struct SaveResolutionArgs: Encodable {
    let repoPath: String
    let conflictPath: String
    let content: String
    let eol: String
}

struct AcceptSideArgs: Encodable {
    let repoPath: String
    let conflictPaths: [String]
    /// "ours" or "theirs".
    let side: String
}

/// `git mergetool`'s four files, from the launch arguments (-mergeBase, -mergeLocal, -mergeRemote, -mergeMerged).
struct MergetoolFiles: Encodable, Equatable {
    let basePath: String
    let localPath: String
    let remotePath: String
    let mergedPath: String
    var ignoreWhitespace = false

    static func fromLaunch() -> MergetoolFiles? {
        let defaults = UserDefaults.standard
        guard let base = defaults.string(forKey: "mergeBase"), let local = defaults.string(forKey: "mergeLocal"),
              let remote = defaults.string(forKey: "mergeRemote"), let merged = defaults.string(forKey: "mergeMerged")
        else {
            return nil
        }
        return MergetoolFiles(basePath: base, localPath: local, remotePath: remote, mergedPath: merged)
    }
}

struct SaveMergetoolArgs: Encodable {
    let mergedPath: String
    let content: String
    let eol: String
}
