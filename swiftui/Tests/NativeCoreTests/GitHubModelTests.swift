import NativeCore
import Testing

@Suite struct GitHubModelTests {
    @Test func repositoryNamesFollowGitHubsRules() {
        #expect(GitHubModel.validateRepositoryName("hello-world") == nil)
        #expect(GitHubModel.validateRepositoryName(" my_repo.v2 ") == nil)
        #expect(GitHubModel.validateRepositoryName(String(repeating: "a", count: 100)) == nil)
        #expect(GitHubModel.validateRepositoryName("") == "Enter a repository name")
        #expect(GitHubModel.validateRepositoryName("   ") == "Enter a repository name")
        #expect(GitHubModel.validateRepositoryName(String(repeating: "a", count: 101))?.contains("100") == true)
        #expect(GitHubModel.validateRepositoryName(".")?.contains("reserved") == true)
        #expect(GitHubModel.validateRepositoryName("..")?.contains("reserved") == true)
        #expect(GitHubModel.validateRepositoryName("repo.git")?.contains(".git") == true)
        for name in ["has space", "a/b", "café"] {
            #expect(GitHubModel.validateRepositoryName(name)?.contains("letters, digits") == true)
        }
    }

    @Test func aFolderNameBecomesARepositoryName() {
        #expect(GitHubModel.suggestRepositoryName("git-merger") == "git-merger")
        #expect(GitHubModel.suggestRepositoryName("My Project (copy)") == "My-Project-copy")
        #expect(GitHubModel.suggestRepositoryName("thing.git") == "thing")
        #expect(GitHubModel.suggestRepositoryName("..") == "")
        #expect(GitHubModel.validateRepositoryName(GitHubModel.suggestRepositoryName("Ünïcode Folder")) == nil)
    }

    @Test func remoteNames() {
        #expect(GitHubModel.defaultShareRemoteName([]) == "origin")
        #expect(GitHubModel.defaultShareRemoteName(["upstream"]) == "origin")
        #expect(GitHubModel.defaultShareRemoteName(["origin"]) == "github")
        #expect(GitHubModel.defaultShareRemoteName(["origin", "github", "github-2"]) == "github-3")
        #expect(GitHubModel.validateShareRemoteName("github", ["origin"]) == nil)
        #expect(GitHubModel.validateShareRemoteName("origin", ["origin"])?.contains("already exists") == true)
        #expect(GitHubModel.validateShareRemoteName("", [])?.contains("Enter") == true)
        #expect(GitHubModel.validateShareRemoteName("-x", [])?.contains("valid") == true)
        #expect(GitHubModel.validateShareRemoteName("a b", [])?.contains("valid") == true)
    }

    @Test func gists() {
        #expect(GitHubModel.gistFileName("/Users/me/repo/src/main.rs") == "main.rs")
        #expect(GitHubModel.gistFileName("notes.md") == "notes.md")
        #expect(GitHubModel.gistFileName(nil) == "")
        #expect(GitHubModel.validateGistFileName("main.rs") == nil)
        #expect(GitHubModel.validateGistFileName(" ")?.contains("Enter") == true)
        #expect(GitHubModel.validateGistFileName("src/main.rs")?.contains("slashes") == true)
    }

    @Test func syncFork() {
        #expect(GitHubModel.syncForkBranch(branch: "feature", upstream: "origin/feature", remoteName: "origin",
                                           defaultBranch: "main") == "feature")
        #expect(GitHubModel.syncForkBranch(branch: "feature", upstream: "upstream/feature", remoteName: "origin",
                                           defaultBranch: "main") == "main")
        #expect(GitHubModel.syncForkBranch(branch: "feature", upstream: nil, remoteName: "origin",
                                           defaultBranch: nil) == "feature")
        #expect(GitHubModel.syncForkBranch(branch: nil, upstream: nil, remoteName: "origin", defaultBranch: nil)
                    == nil)
        #expect(GitHubModel.syncForkTitle("fastForward").contains("fast-forward"))
        #expect(GitHubModel.syncForkTitle("upToDate").contains("up to date"))
        #expect(GitHubModel.syncForkTitle("conflict").contains("conflicts"))
        #expect(GitHubModel.forkCompareURL(fork: ("me", "fork"), parent: ("octo", "original"), branchName: "main")
                    == "https://github.com/me/fork/compare/main...octo:original:main?expand=1")
        #expect(GitHubModel.forkCompareURL(fork: ("me", "fork"), parent: ("octo", "original"), branchName: "feat/a b",
                                           parentBranch: "trunk")
                    == "https://github.com/me/fork/compare/feat/a%20b...octo:original:trunk?expand=1")
    }

    @Test func accountLabels() {
        #expect(GitHubModel.accountInitials(login: "octocat", name: "The Octocat") == "TO")
        #expect(GitHubModel.accountInitials(login: "octocat", name: nil) == "OC")
        #expect(GitHubModel.accountInitials(login: "octocat", name: "Mona") == "MO")
        #expect(GitHubModel.missingScopesHint([]) == nil)
        #expect(GitHubModel.missingScopesHint(["gist"])?.contains("gist scope:") == true)
        #expect(GitHubModel.missingScopesHint(["repo", "gist"])?.contains("repo and gist scopes") == true)
    }
}
