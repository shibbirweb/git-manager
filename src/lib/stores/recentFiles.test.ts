import { describe, expect, it } from "vitest";
import {
  markEdited,
  MAX_RECENT_FILES,
  parseRecentFiles,
  parseRecentList,
  type RecentFile,
  removeRecent,
  touchRecent,
  withRecentFiles,
} from "./recentFiles";
import { MAX_TAB_SESSIONS } from "./tabSession";

const files: RecentFile[] = [
  { filePath: "/w/a.ts", edited: false },
  { filePath: "/w/b.ts", edited: true },
  { filePath: "/w/c.ts", edited: false },
];

describe("touchRecent", () => {
  it("moves a file to the top and keeps its edited mark", () => {
    expect(touchRecent(files, "/w/b.ts")).toEqual([
      { filePath: "/w/b.ts", edited: true },
      { filePath: "/w/a.ts", edited: false },
      { filePath: "/w/c.ts", edited: false },
    ]);
  });

  it("adds a new file on top, not edited, and drops the oldest past the limit", () => {
    expect(touchRecent(files, "/w/d.ts", 3).map((file) => file.filePath)).toEqual(["/w/d.ts", "/w/a.ts", "/w/b.ts"]);
  });

  it("returns the same list when nothing changes", () => {
    expect(touchRecent(files, "/w/a.ts")).toBe(files);
    // Terminals and commits are tabs, not files.
    expect(touchRecent(files, "terminal:1")).toBe(files);
  });
});

describe("markEdited", () => {
  it("marks a listed file edited without moving it", () => {
    expect(markEdited(files, "/w/c.ts")[2]).toEqual({ filePath: "/w/c.ts", edited: true });
    expect(markEdited(files, "/w/c.ts").map((file) => file.filePath)).toEqual(["/w/a.ts", "/w/b.ts", "/w/c.ts"]);
  });

  it("adds a missing file on top, edited", () => {
    expect(markEdited(files, "/w/d.ts")[0]).toEqual({ filePath: "/w/d.ts", edited: true });
  });

  it("returns the same list when the file is already edited", () => {
    expect(markEdited(files, "/w/b.ts")).toBe(files);
  });
});

describe("removeRecent", () => {
  it("takes a file off the list", () => {
    expect(removeRecent(files, "/w/b.ts").map((file) => file.filePath)).toEqual(["/w/a.ts", "/w/c.ts"]);
    expect(removeRecent(files, "/w/x.ts")).toBe(files);
  });
});

describe("parseRecentList", () => {
  it("keeps valid absolute file paths once each", () => {
    expect(
      parseRecentList([
        { filePath: "/w/a.ts", edited: true },
        { filePath: "/w/a.ts" },
        { filePath: "relative.ts" },
        { filePath: "terminal:2" },
        { filePath: 42 },
        "/w/b.ts",
        null,
        { filePath: "C:/w/c.ts", edited: "yes" },
      ]),
    ).toEqual([
      { filePath: "/w/a.ts", edited: true },
      { filePath: "C:/w/c.ts", edited: false },
    ]);
    expect(parseRecentList("nope")).toEqual([]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: MAX_RECENT_FILES + 5 }, (_, index) => ({ filePath: `/w/${index}.ts` }));
    expect(parseRecentList(many)).toHaveLength(MAX_RECENT_FILES);
  });
});

describe("parseRecentFiles", () => {
  it("drops empty lists and bad values", () => {
    expect(parseRecentFiles({ one: [{ filePath: "/w/a.ts" }], two: [], "": [{ filePath: "/w/b.ts" }] })).toEqual({
      one: [{ filePath: "/w/a.ts", edited: false }],
    });
    expect(parseRecentFiles([])).toEqual({});
    expect(parseRecentFiles(null)).toEqual({});
  });
});

describe("withRecentFiles", () => {
  it("moves the workspace to the end and forgets an empty list", () => {
    const lists = { one: files, two: files };
    expect(Object.keys(withRecentFiles(lists, "one", files))).toEqual(["two", "one"]);
    expect(Object.keys(withRecentFiles(lists, "one", []))).toEqual(["two"]);
  });

  it("keeps the most recent workspaces only", () => {
    let lists: Record<string, RecentFile[]> = {};
    for (let index = 0; index < MAX_TAB_SESSIONS + 3; index++) {
      lists = withRecentFiles(lists, `w${index}`, files);
    }
    expect(Object.keys(lists)).toHaveLength(MAX_TAB_SESSIONS);
    expect(lists.w0).toBeUndefined();
  });
});
