import { describe, expect, it } from "vitest";
import type { RemoteInfo } from "$lib/types";
import { remoteLinkPickItems, remoteLinks, remoteWebUrl } from "./remoteLinks";

function remote(name: string, fetchUrl: string | null, pushUrl: string | null = fetchUrl): RemoteInfo {
  return { name, fetchUrl, pushUrl, defaultBranch: null };
}

describe("remoteWebUrl", () => {
  it("reads https remotes, dropping credentials and .git", () => {
    expect(remoteWebUrl("https://github.com/acme/app.git")).toBe("https://github.com/acme/app");
    expect(remoteWebUrl("https://user:token@gitlab.com/group/sub/app.git/")).toBe("https://gitlab.com/group/sub/app");
    expect(remoteWebUrl("https://Git.Example.com:8443/scm/app")).toBe("https://git.example.com:8443/scm/app");
    expect(remoteWebUrl("http://intranet/git/app.git")).toBe("http://intranet/git/app");
  });

  it("turns ssh and git remotes into https pages without their port", () => {
    expect(remoteWebUrl("git@github.com:acme/app.git")).toBe("https://github.com/acme/app");
    expect(remoteWebUrl("git@bitbucket.org:team/app.git")).toBe("https://bitbucket.org/team/app");
    expect(remoteWebUrl("ssh://git@gitlab.example.com:2222/group/app.git")).toBe("https://gitlab.example.com/group/app");
    expect(remoteWebUrl("git://example.org/pub/app.git")).toBe("https://example.org/pub/app");
    expect(remoteWebUrl("git+ssh://git@example.org/app")).toBe("https://example.org/app");
  });

  it("maps Azure DevOps ssh remotes to their web page", () => {
    expect(remoteWebUrl("git@ssh.dev.azure.com:v3/org/project/app")).toBe("https://dev.azure.com/org/project/_git/app");
    expect(remoteWebUrl("https://org@dev.azure.com/org/project/_git/app")).toBe("https://dev.azure.com/org/project/_git/app");
  });

  it("has no page for local paths, file URLs or nothing", () => {
    expect(remoteWebUrl("/srv/git/app.git")).toBeNull();
    expect(remoteWebUrl("../app")).toBeNull();
    expect(remoteWebUrl("file:///srv/git/app.git")).toBeNull();
    expect(remoteWebUrl("C:\\repos\\app")).toBeNull();
    expect(remoteWebUrl("C:/repos/app")).toBeNull();
    expect(remoteWebUrl("https://github.com/")).toBeNull();
    expect(remoteWebUrl("ftp://example.org/app")).toBeNull();
    expect(remoteWebUrl("")).toBeNull();
    expect(remoteWebUrl(null)).toBeNull();
  });
});

describe("remoteLinks", () => {
  it("lists the upstream's remote first, then origin, then the rest", () => {
    const remotes = [
      remote("backup", "git@gitlab.com:acme/app.git"),
      remote("origin", "git@github.com:acme/app.git"),
      remote("fork", "https://github.com/me/app.git"),
    ];
    expect(remoteLinks(remotes).map((link) => link.remoteName)).toEqual(["origin", "backup", "fork"]);
    expect(remoteLinks(remotes, "fork").map((link) => link.remoteName)).toEqual(["fork", "origin", "backup"]);
  });

  it("keeps one link per page and adds a different push URL", () => {
    const remotes = [
      remote("origin", "https://github.com/acme/app.git", "git@github.com:acme/app.git"),
      remote("mirror", "git@github.com:acme/app.git"),
      remote("split", "https://github.com/acme/read.git", "git@github.com:acme/write.git"),
      remote("local", "/srv/git/app.git"),
    ];
    expect(remoteLinks(remotes)).toEqual([
      { remoteName: "origin", url: "https://github.com/acme/app" },
      { remoteName: "split", url: "https://github.com/acme/read" },
      { remoteName: "split", url: "https://github.com/acme/write" },
    ]);
  });

  it("is empty without remotes that have a page", () => {
    expect(remoteLinks([])).toEqual([]);
    expect(remoteLinks([remote("local", "../app", null)])).toEqual([]);
  });
});

describe("remoteLinkPickItems", () => {
  it("shows the remote name with its URL", () => {
    expect(remoteLinkPickItems([{ remoteName: "origin", url: "https://github.com/acme/app" }])).toEqual([
      { value: "https://github.com/acme/app", label: "origin", description: "https://github.com/acme/app" },
    ]);
  });
});
