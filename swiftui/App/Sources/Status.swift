// Mirrors of the status types in src/lib/types.ts (from src-tauri/src/git/status.rs).
// Only the fields the app shows so far; JSONDecoder skips the rest.

struct GetStatusArgs: Encodable {
    let repoPath: String
    let knownHash: String?
}

struct StatusSnapshot: Decodable {
    let hash: String
    let status: RepoStatus?
}

struct RepoStatus: Decodable {
    let head: HeadInfo
    let files: [FileStatus]
}

struct HeadInfo: Decodable {
    let branch: String?
    let shortId: String?
    let unborn: Bool
    let upstream: String?
    let ahead: Int
    let behind: Int
}

struct FileStatus: Decodable {
    let path: String
    let staged: String?
    let unstaged: String?
    let conflicted: Bool
}

struct MemoryUsage: Decodable {
    let totalBytes: UInt64
}
