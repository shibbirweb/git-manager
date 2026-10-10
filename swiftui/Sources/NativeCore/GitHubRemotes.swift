// Which remote points to github.com (src/lib/views/git/github.ts parseGitHubUrl and pickGitHubRemote), for the Git
// menu's GitHub submenu: Share Project is refused once one does, Sync Fork works on it. No API, no login.

import Foundation

public enum GitHubRemotes {
    public struct Repo: Equatable, Sendable {
        public let owner: String
        public let repo: String

        public init(owner: String, repo: String) {
            self.owner = owner
            self.repo = repo
        }
    }

    public struct Remote: Equatable, Sendable {
        public let owner: String
        public let repo: String
        public let remoteName: String
        public let defaultBranch: String?
    }

    /// A configured remote as list_remotes reports it.
    public struct RemoteURLs: Equatable, Sendable {
        public let name: String
        public let fetchURL: String?
        public let pushURL: String?
        public let defaultBranch: String?

        public init(name: String, fetchURL: String?, pushURL: String?, defaultBranch: String?) {
            self.name = name
            self.fetchURL = fetchURL
            self.pushURL = pushURL
            self.defaultBranch = defaultBranch
        }
    }

    static let host = "github.com"

    /// The owner and repository of a github.com remote URL in the forms git accepts (https, http, ssh, git and the
    /// scp-like git@github.com:OWNER/REPO.git); nil for any other host or path.
    public static func parse(_ url: String?) -> Repo? {
        let text = (url ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            return nil
        }
        let host: String
        let path: String
        if let scheme = match(#"^([a-z][a-z0-9+.-]*)://(?:[^@/]*@)?([^/:]+)(?::\d+)?/(.*)$"#, text) {
            let allowed = ["https", "http", "ssh", "git", "git+ssh", "ssh+git"]
            guard allowed.contains(scheme[1].lowercased()) else {
                return nil
            }
            host = scheme[2]
            path = scheme[3]
        } else if let scp = match(#"^(?:[^@/]+@)?([^/:]+):(?!/)(.*)$"#, text) {
            host = scp[1]
            path = scp[2]
        } else {
            return nil
        }
        guard host.lowercased() == Self.host || host.lowercased() == "www.\(Self.host)" else {
            return nil
        }
        let cleaned = path.replacingOccurrences(of: #"[?#].*$"#, with: "", options: .regularExpression)
        let parts = cleaned.split(separator: "/").map(String.init)
        guard parts.count == 2 else {
            return nil
        }
        let repo = parts[1].replacingOccurrences(of: #"\.git$"#, with: "", options: [.regularExpression,
                                                                                         .caseInsensitive])
        guard !parts[0].isEmpty, !repo.isEmpty else {
            return nil
        }
        return Repo(owner: parts[0], repo: repo)
    }

    /// The GitHub remote to use: the branch's upstream remote, else origin, else the first github.com one.
    public static func pick(_ remotes: [RemoteURLs], preferred: String? = nil) -> Remote? {
        let found = remotes.compactMap { remote -> Remote? in
            guard let parsed = parse(remote.fetchURL) ?? parse(remote.pushURL) else {
                return nil
            }
            return Remote(owner: parsed.owner, repo: parsed.repo, remoteName: remote.name,
                          defaultBranch: remote.defaultBranch)
        }
        return found.first { $0.remoteName == preferred } ?? found.first { $0.remoteName == "origin" } ?? found.first
    }

    private static func match(_ pattern: String, _ text: String) -> [String]? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
              let result = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else {
            return nil
        }
        return (0..<result.numberOfRanges).map { index in
            Range(result.range(at: index), in: text).map { String(text[$0]) } ?? ""
        }
    }
}
