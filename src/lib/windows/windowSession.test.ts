import { describe, expect, it } from "vitest";
import { parseWindowStart, startStep, windowTitle } from "./windowSession";

describe("parseWindowStart", () => {
  it("reads an open answer", () => {
    expect(
      parseWindowStart({ kind: "open", label: "window-2", open: { folderPaths: ["/a", "/b"], workspaceFile: null } }),
    ).toEqual({ kind: "open", label: "window-2", open: { folderPaths: ["/a", "/b"], workspaceFile: null } });
  });

  it("drops malformed parts", () => {
    expect(parseWindowStart({ kind: "open", label: 3, open: { folderPaths: ["/a", 4, "", null], workspaceFile: "  " } })).toEqual({
      kind: "open",
      label: "main",
      open: { folderPaths: ["/a"], workspaceFile: null },
    });
    expect(parseWindowStart({ kind: "open", label: "window-3" })).toEqual({
      kind: "open",
      label: "window-3",
      open: { folderPaths: [], workspaceFile: null },
    });
  });

  it("falls back to the usual start", () => {
    expect(parseWindowStart(null)).toEqual({ kind: "default", label: "main" });
    expect(parseWindowStart({ kind: "other", label: "window-2" })).toEqual({ kind: "default", label: "window-2" });
  });
});

describe("startStep", () => {
  const open = (folderPaths: string[], workspaceFile: string | null = null) =>
    ({ kind: "open", label: "window-2", open: { folderPaths, workspaceFile } }) as const;

  it("opens the window's own folders or workspace file", () => {
    expect(startStep(open(["/a"]), "/launch")).toEqual({ kind: "folders", folderPaths: ["/a"] });
    expect(startStep(open(["/a"], "/w.code-workspace"), null)).toEqual({ kind: "workspaceFile", filePath: "/w.code-workspace" });
  });

  it("shows the welcome screen for a new empty window", () => {
    expect(startStep(open([]), "/launch")).toEqual({ kind: "welcome" });
  });

  it("uses the command line, else the last session, for the main window's usual start", () => {
    expect(startStep({ kind: "default", label: "main" }, "/launch")).toEqual({ kind: "launch", path: "/launch" });
    expect(startStep({ kind: "default", label: "main" }, null)).toEqual({ kind: "session" });
  });
});

describe("windowTitle", () => {
  it("names the window after its workspace", () => {
    expect(windowTitle("git-merger")).toBe("git-merger");
    expect(windowTitle("  ")).toBe("Git Manager");
    expect(windowTitle(null)).toBe("Git Manager");
  });
});
