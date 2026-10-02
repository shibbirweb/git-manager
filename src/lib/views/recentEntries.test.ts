import { describe, expect, it } from "vitest";
import { recentEntries, recentMenuText, type RecentSources } from "./recentEntries";

const sources: RecentSources = {
  recentWorkspaceFiles: ["/Users/me/work/team.gitmanager-workspace", "/Users/me/old.code-workspace"],
  recentWorkspaces: [["/Users/me/a", "/Users/me/b"], ["/w/1", "/w/2", "/w/3", "/w/4"]],
  recentRepos: ["/Users/me/git-merger", "/srv/site"],
};

describe("recentEntries", () => {
  it("lists workspace files, then workspaces, then folders", () => {
    expect(recentEntries(sources, null).map((entry) => [entry.kind, entry.label, entry.hint])).toEqual([
      ["workspaceFile", "team", "workspace file"],
      ["workspaceFile", "old", "workspace file"],
      ["workspace", "a, b", "2 folders"],
      ["workspace", "1, 2, 3 +1", "4 folders"],
      ["folder", "git-merger", "~/git-merger"],
      ["folder", "site", "/srv/site"],
    ]);
  });

  it("leaves out what is open now", () => {
    const labels = (open: Parameters<typeof recentEntries>[1]) => recentEntries(sources, open).map((entry) => entry.label);
    expect(labels({ file: "/Users/me/old.code-workspace", folderRoots: ["/x"] })).not.toContain("old");
    expect(labels({ file: null, folderRoots: ["/Users/me/a", "/Users/me/b"] })).not.toContain("a, b");
    expect(labels({ file: null, folderRoots: ["/srv/site"] })).not.toContain("site");
  });

  it("writes one line per entry for the native menu", () => {
    const [file, , workspace, , folder] = recentEntries(sources, null);
    expect(recentMenuText(file)).toBe("team (workspace file)");
    expect(recentMenuText(workspace)).toBe("a, b (2 folders)");
    expect(recentMenuText(folder)).toBe("~/git-merger");
  });
});
