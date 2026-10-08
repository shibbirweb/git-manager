// Arguments and results of the bridge's write commands (swiftui/bridge/src/commands/write.rs), shaped like
// `stageFiles`, `unstageFiles`, `commit`, `getHeadMessage`, `lastAction` and `moveHeadBack` in src/lib/api.ts.

import NativeCore

struct FilesArgs: Encodable {
    let repoPath: String
    let filePaths: [String]
}

struct RepoArgs: Encodable {
    let repoPath: String
}

struct CommitArgs: Encodable {
    let repoPath: String
    let message: String
    let amend: Bool
}

struct MoveHeadBackArgs: Encodable {
    let repoPath: String
    let headId: String
    let commitId: String
    let mode: String
}

/// What a git command printed (src-tauri/src/git/cli.rs GitOutput).
struct GitOutput: Decodable {
    let stdout: String
    let stderr: String
    let success: Bool
}

/// The latest HEAD movement (src-tauri/src/git/reflog.rs LastAction), for the commit toast's Undo.
struct LastAction: Decodable {
    let entry: ReflogMove?
    let branch: String?
    let pushed: Bool
}

/// A command that answers nothing (`()` in Rust, null in JSON).
struct NoValue: Decodable {
    init(from decoder: Decoder) throws {}
}
