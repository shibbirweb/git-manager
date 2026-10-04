import { describe, expect, it } from "vitest";
import { type GitTabRef, gitTabPath, gitTabsInFolder, gitTabTitle, isGitTab, parseGitTabPath, revisionLabel } from "./gitTabs";
import { isPseudoTab } from "./pseudoTabs";
import { tabLabels, tabsInFolder } from "./tabs";

const refs: GitTabRef[] = [
  { kind: "fileHistory", repoRoot: "/work/app", filePath: "src/a|b c.ts" },
  { kind: "lineHistory", repoRoot: "/work/app", filePath: "src/main.ts", startLine: 3, endLine: 9 },
  { kind: "compare", repoRoot: "/work/app", filePath: "README.md", revision: "feature/x" },
  { kind: "shelf", repoRoot: "/work/app", filePath: "dir/new file.txt", shelfId: "1727780000000-0" },
  { kind: "reflog", repoRoot: "/work/a|pp" },
];

describe("git tabs", () => {
  it("round-trips every kind, with odd characters", () => {
    for (const ref of refs) {
      const tabPath = gitTabPath(ref);
      expect(tabPath.startsWith("/")).toBe(false);
      expect(parseGitTabPath(tabPath)).toEqual(ref);
      expect(isGitTab(tabPath)).toBe(true);
      expect(isPseudoTab(tabPath)).toBe(true);
    }
  });

  it("refuses other paths", () => {
    for (const tabPath of [
      "/work/app/src/main.ts",
      "commit:abcd1234@/work/app",
      "git-other:a|b",
      "git-fileHistory:%2Fwork",
      "git-lineHistory:%2Fwork|a.ts|9-3",
      "git-lineHistory:%2Fwork|a.ts|0-3",
      "git-compare:%2Fwork|a.ts",
      "git-compare:%E0%A4%A|a.ts|main",
      "git-reflog:",
      "git-reflog:%2Fwork|extra",
    ]) {
      expect(parseGitTabPath(tabPath), tabPath).toBeNull();
    }
  });

  it("titles each kind", () => {
    expect(gitTabTitle(refs[0]).name).toBe("History: a|b c.ts");
    expect(gitTabTitle(refs[1])).toEqual({ name: "History: main.ts:3-9", title: "History of lines 3-9 of src/main.ts (app)" });
    expect(gitTabTitle(refs[2]).name).toBe("README.md vs feature/x");
    expect(gitTabTitle(refs[3])).toEqual({ name: "Shelved: new file.txt", title: "dir/new file.txt in shelved changes (app)" });
    expect(gitTabTitle(refs[4])).toEqual({ name: "Reflog: a|pp", title: "Reflog of a|pp" });
    expect(revisionLabel("0123456789abcdef0123456789abcdef01234567")).toBe("01234567");
  });

  it("closes with its folder and has a label in the strip", () => {
    const paths = refs.map(gitTabPath);
    const other = gitTabPath({ kind: "fileHistory", repoRoot: "/elsewhere/lib", filePath: "x.ts" });
    expect(gitTabsInFolder([...paths, other], "/work")).toEqual(paths);
    expect(tabsInFolder([...paths, other], "/work")).toEqual(paths);
    const labels = tabLabels([...paths, other].map((path) => ({ path, preview: false, dirty: false })));
    expect(labels.get(paths[1])?.name).toBe("History: main.ts:3-9");
  });
});
