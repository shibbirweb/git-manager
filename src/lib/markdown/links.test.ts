import { describe, expect, it } from "vitest";
import { classifyImage, classifyLink, isImagePath, type LinkContext } from "./links";

const context: LinkContext = {
  documentPath: "/work/repo/docs/guide.md",
  rootPath: "/work/repo",
  isInWorkspace: (absolutePath) => absolutePath.startsWith("/work/"),
};

describe("classifyLink", () => {
  it("opens web and mail links in the browser", () => {
    expect(classifyLink("https://example.com/a?b#c", context)).toEqual({ kind: "external", url: "https://example.com/a?b#c" });
    expect(classifyLink("http://x.dev", context)).toEqual({ kind: "external", url: "http://x.dev" });
    expect(classifyLink("mailto:me@x.dev", context)).toEqual({ kind: "external", url: "mailto:me@x.dev" });
    expect(classifyLink("//cdn.x.dev/a", context)).toEqual({ kind: "external", url: "https://cdn.x.dev/a" });
  });

  it("blocks scripts and other schemes", () => {
    expect(classifyLink("javascript:alert(1)", context)).toEqual({ kind: "blocked" });
    expect(classifyLink(" JavaScript:alert(1)", context)).toEqual({ kind: "blocked" });
    expect(classifyLink("data:text/html,x", context)).toEqual({ kind: "blocked" });
    expect(classifyLink("file:///etc/passwd", context)).toEqual({ kind: "blocked" });
    expect(classifyLink("", context)).toEqual({ kind: "blocked" });
  });

  it("scrolls to anchors", () => {
    expect(classifyLink("#install-steps", context)).toEqual({ kind: "anchor", id: "install-steps" });
    expect(classifyLink("#caf%C3%A9", context)).toEqual({ kind: "anchor", id: "café" });
  });

  it("resolves files relative to the document, or to the root for /paths", () => {
    expect(classifyLink("../README.md#usage", context)).toEqual({ kind: "file", filePath: "/work/repo/README.md", anchor: "usage" });
    expect(classifyLink("api%20notes.md", context)).toEqual({ kind: "file", filePath: "/work/repo/docs/api notes.md", anchor: null });
    expect(classifyLink("/CONTRIBUTING.md", context)).toEqual({ kind: "file", filePath: "/work/repo/CONTRIBUTING.md", anchor: null });
    expect(classifyLink("/work/other/a.md", context)).toEqual({ kind: "file", filePath: "/work/other/a.md", anchor: null });
  });

  it("keeps files inside the workspace", () => {
    expect(classifyLink("../../../etc/hosts", context)).toEqual({ kind: "blocked" });
    expect(classifyLink("../src/", context)).toEqual({ kind: "blocked" });
  });
});

describe("classifyImage", () => {
  it("never fetches remote images itself", () => {
    expect(classifyImage("https://img.shields.io/badge.svg", context)).toEqual({ kind: "remote", url: "https://img.shields.io/badge.svg" });
    expect(classifyImage("//x.dev/a.png", context)).toEqual({ kind: "remote", url: "https://x.dev/a.png" });
  });

  it("keeps data images and blocks other schemes", () => {
    expect(classifyImage("data:image/png;base64,AAAA", context)).toEqual({ kind: "data", url: "data:image/png;base64,AAAA" });
    expect(classifyImage("data:text/html;base64,AAAA", context).kind).toBe("blocked");
    expect(classifyImage("javascript:alert(1)", context).kind).toBe("blocked");
  });

  it("resolves local images inside the workspace with known types", () => {
    expect(classifyImage("img/logo.png", context)).toEqual({ kind: "local", filePath: "/work/repo/docs/img/logo.png" });
    expect(classifyImage("./shot%201.JPG?raw=1", context)).toEqual({ kind: "local", filePath: "/work/repo/docs/shot 1.JPG" });
    expect(classifyImage("/assets/a.svg", context)).toEqual({ kind: "local", filePath: "/work/repo/assets/a.svg" });
    expect(classifyImage("../../../../tmp/a.png", context)).toEqual({ kind: "blocked", reason: "Image outside the workspace" });
    expect(classifyImage("notes.txt", context)).toEqual({ kind: "blocked", reason: "Unsupported image type" });
  });

  it("knows image extensions", () => {
    expect(isImagePath("/a/b.webp")).toBe(true);
    expect(isImagePath("/a/b.gif")).toBe(true);
    expect(isImagePath("/a/.png")).toBe(false);
    expect(isImagePath("/a/b.bmp")).toBe(false);
  });
});
