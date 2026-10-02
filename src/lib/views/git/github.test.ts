import { describe, expect, it } from "vitest";
import type { RemoteInfo } from "$lib/types";
import { gitHubCompareUrl, gitHubFileUrl, gitHubPullsUrl, linkRevision, parseGitHubUrl, pickGitHubRemote } from "./github";

function remote(name: string, fetchUrl: string | null, defaultBranch: string | null = null): RemoteInfo {
  return { name, fetchUrl, pushUrl: fetchUrl, defaultBranch };
}

describe("parseGitHubUrl", () => {
  it("reads https, ssh, git and scp-like URLs", () => {
    const expected = { owner: "octo", repo: "hello-world" };
    for (const url of [
      "https://github.com/octo/hello-world.git",
      "https://github.com/octo/hello-world",
      "https://github.com/octo/hello-world/",
      "http://github.com/octo/hello-world.git",
      "https://user:token@github.com/octo/hello-world.git",
      "ssh://git@github.com/octo/hello-world.git",
      "ssh://git@github.com:22/octo/hello-world.git",
      "git://github.com/octo/hello-world.git",
      "git@github.com:octo/hello-world.git",
      "git@github.com:octo/hello-world",
      "github.com:octo/hello-world.git",
      "  https://www.github.com/octo/hello-world.git  ",
      "https://GitHub.com/octo/hello-world.git",
    ]) {
      expect(parseGitHubUrl(url), url).toEqual(expected);
    }
  });

  it("refuses other hosts and odd paths", () => {
    for (const url of [
      "",
      null,
      undefined,
      "https://gitlab.com/octo/hello-world.git",
      "git@bitbucket.org:octo/hello-world.git",
      "https://github.com/octo",
      "https://github.com/octo/hello/extra",
      "https://github.com.evil.com/octo/hello",
      "/Users/me/remote.git",
      "file:///srv/github.com/octo/hello.git",
      "../relative/repo",
    ]) {
      expect(parseGitHubUrl(url), String(url)).toBeNull();
    }
  });
});

describe("pickGitHubRemote", () => {
  const remotes = [
    remote("backup", "/srv/backup.git"),
    remote("fork", "git@github.com:me/project.git"),
    remote("origin", "https://github.com/team/project.git", "develop"),
  ];

  it("prefers the upstream's remote, then origin", () => {
    expect(pickGitHubRemote(remotes, "fork")).toEqual({ owner: "me", repo: "project", remoteName: "fork", defaultBranch: null });
    expect(pickGitHubRemote(remotes, "backup")?.remoteName).toBe("origin");
    expect(pickGitHubRemote(remotes)?.defaultBranch).toBe("develop");
  });

  it("is null without a GitHub remote", () => {
    expect(pickGitHubRemote([remote("origin", "/srv/repo.git")])).toBeNull();
    expect(pickGitHubRemote([])).toBeNull();
  });
});

describe("GitHub links", () => {
  const repo = { owner: "octo", repo: "hello" };

  it("builds file links with lines", () => {
    expect(gitHubFileUrl(repo, "abc123", "src/app.ts", { start: 5, end: 5 })).toBe(
      "https://github.com/octo/hello/blob/abc123/src/app.ts#L5",
    );
    expect(gitHubFileUrl(repo, "feature/x", "docs/read me.md", { start: 3, end: 9 })).toBe(
      "https://github.com/octo/hello/blob/feature/x/docs/read%20me.md#L3-L9",
    );
    expect(gitHubFileUrl(repo, "main", "a#b.txt")).toBe("https://github.com/octo/hello/blob/main/a%23b.txt");
  });

  it("links the repository without a file", () => {
    expect(gitHubFileUrl(repo, "main", null)).toBe("https://github.com/octo/hello/tree/main");
    expect(gitHubFileUrl(repo, null, null)).toBe("https://github.com/octo/hello");
  });

  it("builds compare and pull request links", () => {
    expect(gitHubCompareUrl(repo, "develop", "feature/login")).toBe(
      "https://github.com/octo/hello/compare/develop...feature/login?expand=1",
    );
    expect(gitHubCompareUrl(repo, null, "topic")).toBe("https://github.com/octo/hello/compare/main...topic?expand=1");
    expect(gitHubPullsUrl(repo)).toBe("https://github.com/octo/hello/pulls");
  });

  it("links the branch only when it is pushed as it is", () => {
    expect(linkRevision({ branch: "main", upstream: "origin/main", ahead: 0 }, "origin", "abc")).toBe("main");
    expect(linkRevision({ branch: "main", upstream: "origin/main", ahead: 2 }, "origin", "abc")).toBe("abc");
    expect(linkRevision({ branch: "main", upstream: "fork/main", ahead: 0 }, "origin", "abc")).toBe("abc");
    expect(linkRevision({ branch: "main", upstream: null, ahead: 0 }, "origin", null)).toBe("main");
    expect(linkRevision(null, "origin", null)).toBeNull();
  });
});
