import { describe, expect, it } from "vitest";
import type { RecentFile } from "$lib/stores/recentFiles";
import { initialRecentSelection, recentFileRows } from "./recentFilesModel";

const folders = [{ root: "/w", name: "w" }];
const files: RecentFile[] = [
  { filePath: "/w/src/app.ts", edited: false },
  { filePath: "/w/src/cart.ts", edited: true },
  { filePath: "/w/README.md", edited: false },
  { filePath: "/elsewhere/other.ts", edited: true },
];

const paths = (rows: ReturnType<typeof recentFileRows>) => rows.map((row) => row.file.path);

describe("recentFileRows", () => {
  it("lists the workspace's files most recent first with their folder", () => {
    const rows = recentFileRows(files, folders, "", false);
    expect(paths(rows)).toEqual(["/w/src/app.ts", "/w/src/cart.ts", "/w/README.md"]);
    expect(rows[1]).toMatchObject({ edited: true, file: { name: "cart.ts", folderParts: [{ text: "src", match: false }] } });
  });

  it("keeps the edited files only", () => {
    expect(paths(recentFileRows(files, folders, "", true))).toEqual(["/w/src/cart.ts"]);
  });

  it("filters in recent order and highlights the match", () => {
    const rows = recentFileRows(files, folders, "src", false);
    expect(paths(rows)).toEqual(["/w/src/app.ts", "/w/src/cart.ts"]);
    expect(rows[0].file.folderParts).toEqual([{ text: "src", match: true }]);
    expect(paths(recentFileRows(files, folders, "zzz", false))).toEqual([]);
  });

  it("leads with the folder name in a multi-folder workspace", () => {
    const rows = recentFileRows(files, [...folders, { root: "/elsewhere", name: "elsewhere" }], "", false);
    expect(paths(rows)).toContain("/elsewhere/other.ts");
    expect(rows.find((row) => row.file.name === "other.ts")?.file.folderParts[0].text).toBe("elsewhere");
  });
});

describe("initialRecentSelection", () => {
  const rows = recentFileRows(files, folders, "", false);

  it("starts on the file before the one on screen", () => {
    expect(initialRecentSelection(rows, "/w/src/app.ts", "")).toBe(1);
  });

  it("starts on the first row when the screen shows no listed file, or while filtering", () => {
    expect(initialRecentSelection(rows, null, "")).toBe(0);
    expect(initialRecentSelection(rows, "/w/src/app.ts", "app")).toBe(0);
    expect(initialRecentSelection(rows.slice(0, 1), "/w/src/app.ts", "")).toBe(0);
  });
});
