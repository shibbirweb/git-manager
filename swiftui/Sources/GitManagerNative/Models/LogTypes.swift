// Mirrors of the Log's types in src/lib/types.ts (from src-tauri/src/git/log.rs and commands/history.rs), and the
// arguments of the bridge's get_log, get_commit_details and get_commit_file_diff.

struct GetLogArgs: Encodable {
    let repoPath: String
    let offset: Int
    let limit: Int
    let allRefs: Bool
    let knownTips: String?
}

struct CommitIdArgs: Encodable {
    let repoPath: String
    let commitId: String
}

struct CommitFileArgs: Encodable {
    let repoPath: String
    let commitId: String
    let filePath: String
    let origPath: String?
}

struct LogPage: Decodable {
    let tips: String
    /// Nil when the tips the caller knows still match: nothing was walked.
    let commits: [CommitSummary]?
}

struct RefLabel: Decodable, Equatable {
    let name: String
    /// "head", "local", "remote" or "tag".
    let kind: String
}

struct CommitSummary: Decodable {
    let id: String
    let shortId: String
    let summary: String
    let authorName: String
    let authorEmail: String
    /// Seconds since the epoch.
    let time: Int
    let parents: [String]
    let refs: [RefLabel]
}

struct ChangedFile: Decodable, Equatable {
    let path: String
    let origPath: String?
    let status: String
}

struct CommitDetails: Decodable {
    let id: String
    let message: String
    let authorName: String
    let authorEmail: String
    let authorTime: Int
    let committerName: String
    let committerTime: Int
    let parents: [String]
    let files: [ChangedFile]
}
