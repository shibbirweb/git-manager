import { describe, expect, it } from "vitest";
import { HEAD_REVISION, INDEX_REVISION, parentRevision, previewUrl, sameSource, schemeBase, sourceName } from "./previewSource";

const MAC_BASE = "gmpreview://localhost/";

describe("schemeBase", () => {
  it("takes Tauri's form of the scheme, with a trailing slash", () => {
    const tauri = (filePath: string, protocol: string): string => `${protocol}://localhost/${encodeURIComponent(filePath)}`;
    expect(schemeBase(tauri)).toBe(MAC_BASE);
    const windows = (filePath: string, protocol: string): string => `http://${protocol}.localhost/${filePath}`;
    expect(schemeBase(windows)).toBe("http://gmpreview.localhost/");
    expect(schemeBase((_filePath, protocol) => `${protocol}://localhost`)).toBe(MAC_BASE);
  });

  it("uses the Windows form without Tauri, so a browser can route it", () => {
    expect(schemeBase(null)).toBe("http://gmpreview.localhost/");
  });
});

describe("previewUrl", () => {
  it("encodes a work tree path as one part", () => {
    const url = previewUrl(MAC_BASE, { kind: "worktree", filePath: "/Users/me/my shop/#1 100%?.png" }, 2);
    expect(url).toBe("gmpreview://localhost/worktree/%2FUsers%2Fme%2Fmy%20shop%2F%231%20100%25%3F.png?v=2");
    expect(decodeURIComponent(new URL(url).pathname.split("/")[2])).toBe("/Users/me/my shop/#1 100%?.png");
  });

  it("encodes the repository, the revision and the path of a revision each on its own", () => {
    const url = previewUrl(
      "http://gmpreview.localhost/",
      { kind: "revision", repoRoot: "C:\\work\\shop", revision: parentRevision("a".repeat(40)), filePath: "assets/logo.png" },
      0,
    );
    expect(url).toBe(`http://gmpreview.localhost/revision/C%3A%5Cwork%5Cshop/${"a".repeat(40)}%5E/assets%2Flogo.png?v=0`);
    const parts = new URL(url).pathname.split("/").slice(2).map(decodeURIComponent);
    expect(parts).toEqual(["C:\\work\\shop", `${"a".repeat(40)}^`, "assets/logo.png"]);
  });

  it("names the special revisions like the backend", () => {
    expect(HEAD_REVISION).toBe("HEAD");
    expect(INDEX_REVISION).toBe("index");
    expect(parentRevision("abc")).toBe("abc^");
  });
});

describe("sourceName and sameSource", () => {
  it("takes the last part of the path", () => {
    expect(sourceName({ kind: "worktree", filePath: "/a/b/logo.png" })).toBe("logo.png");
    expect(sourceName({ kind: "revision", repoRoot: "/r", revision: "HEAD", filePath: "logo.png" })).toBe("logo.png");
    expect(sourceName({ kind: "worktree", filePath: "C:\\a\\photo.jpg" })).toBe("photo.jpg");
  });

  it("compares every part", () => {
    const head = { kind: "revision", repoRoot: "/r", revision: "HEAD", filePath: "a.png" } as const;
    expect(sameSource(head, { ...head })).toBe(true);
    expect(sameSource(head, { ...head, revision: "index" })).toBe(false);
    expect(sameSource(head, { kind: "worktree", filePath: "a.png" })).toBe(false);
    expect(sameSource({ kind: "worktree", filePath: "/a.png" }, { kind: "worktree", filePath: "/a.png" })).toBe(true);
    expect(sameSource(null, null)).toBe(true);
    expect(sameSource(head, null)).toBe(false);
  });
});
