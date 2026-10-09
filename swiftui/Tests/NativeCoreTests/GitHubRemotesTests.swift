import NativeCore
import Testing

@Suite struct GitHubRemotesTests {
    @Test func readsTheURLFormsGitAccepts() {
        let expected = GitHubRemotes.Repo(owner: "octo", repo: "hello-world")
        for url in [
            "https://github.com/octo/hello-world.git", "https://github.com/octo/hello-world",
            "https://github.com/octo/hello-world/", "http://github.com/octo/hello-world.git",
            "https://user:token@github.com/octo/hello-world.git", "ssh://git@github.com/octo/hello-world.git",
            "ssh://git@github.com:22/octo/hello-world.git", "git://github.com/octo/hello-world.git",
            "git@github.com:octo/hello-world.git", "git@github.com:octo/hello-world", "github.com:octo/hello-world.git",
            "  https://www.github.com/octo/hello-world.git  ", "https://GitHub.com/octo/hello-world.git",
        ] {
            #expect(GitHubRemotes.parse(url) == expected, "\(url)")
        }
    }

    @Test func refusesOtherHostsAndOddPaths() {
        for url in [
            "", nil, "https://gitlab.com/octo/hello-world.git", "git@bitbucket.org:octo/hello-world.git",
            "https://github.com/octo", "https://github.com/octo/hello/extra", "https://github.com.evil.com/octo/hello",
            "/Users/me/remote.git", "file:///srv/github.com/octo/hello.git", "../relative/repo",
        ] {
            #expect(GitHubRemotes.parse(url) == nil, "\(String(describing: url))")
        }
    }

    @Test func prefersTheUpstreamsRemoteThenOrigin() {
        let remotes = [
            GitHubRemotes.RemoteURLs(name: "backup", fetchURL: "/srv/backup.git", pushURL: "/srv/backup.git",
                                     defaultBranch: nil),
            GitHubRemotes.RemoteURLs(name: "fork", fetchURL: "git@github.com:me/project.git",
                                     pushURL: "git@github.com:me/project.git", defaultBranch: nil),
            GitHubRemotes.RemoteURLs(name: "origin", fetchURL: "https://github.com/team/project.git",
                                     pushURL: "https://github.com/team/project.git", defaultBranch: "develop"),
        ]
        #expect(GitHubRemotes.pick(remotes, preferred: "fork")?.owner == "me")
        #expect(GitHubRemotes.pick(remotes, preferred: "backup")?.remoteName == "origin")
        #expect(GitHubRemotes.pick(remotes)?.defaultBranch == "develop")
        #expect(GitHubRemotes.pick([remotes[0]]) == nil)
        #expect(GitHubRemotes.pick([]) == nil)
    }
}
