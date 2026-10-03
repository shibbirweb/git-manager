// Which repository the screen shows, and the status bar's repository picker
// (VS Code's repository quick pick with its Auto entry). Kept free of Svelte so
// it can be tested directly.

import { parseBranchTabPath } from "$lib/stores/branchTabs";
import { parseCommitTabPath } from "$lib/stores/commitTabs";
import { parseGitTabPath } from "$lib/stores/gitTabs";
import { isPseudoTab } from "$lib/stores/pseudoTabs";
import { locateAbsolute, repoForPath } from "$lib/stores/workspacePaths";
import { parseTerminalTabPath } from "$lib/terminal/terminalTabs";
import type { RepoInfo, RepoStatus } from "$lib/types";
import type { PickItem } from "$lib/ui/pickList";

/**
 * The repository tied to what is on screen: a repository, a file tab outside
 * every repository, or nothing in particular (the Log, a terminal outside any
 * repository), where the active repository stands.
 */
export type ScreenRepo = { kind: "repo"; repoRoot: string } | { kind: "outside" } | { kind: "active" };

export interface ScreenInput {
  shownView: "diff" | "log" | "file" | "none";
  openFilePath: string | null;
  /** Repository of the change selected in the Changes sidebar. */
  selectedRepoRoot: string | null;
  repos: RepoInfo[];
  /** The folder a terminal runs in, or null when it is unknown. */
  terminalCwd: (terminalKey: number) => string | null;
}

function known(repos: RepoInfo[], repoRoot: string | null | undefined): ScreenRepo {
  return repoRoot && repos.some((repo) => repo.root === repoRoot) ? { kind: "repo", repoRoot } : { kind: "active" };
}

export function screenRepo(input: ScreenInput): ScreenRepo {
  const { shownView, openFilePath, repos } = input;
  if (shownView === "file" && openFilePath) {
    const tab = parseCommitTabPath(openFilePath) ?? parseGitTabPath(openFilePath) ?? parseBranchTabPath(openFilePath);
    if (tab) {
      return known(repos, tab.repoRoot);
    }
    const terminalKey = parseTerminalTabPath(openFilePath);
    if (terminalKey !== null) {
      const cwd = input.terminalCwd(terminalKey);
      return known(repos, cwd ? repoForPath(repos, cwd)?.root : null);
    }
    const located = locateAbsolute(repos, openFilePath)?.repo ?? null;
    if (located) {
      return { kind: "repo", repoRoot: located.root };
    }
    return isPseudoTab(openFilePath) ? { kind: "active" } : { kind: "outside" };
  }
  if (shownView === "diff") {
    return known(repos, input.selectedRepoRoot);
  }
  return { kind: "active" };
}

/** Pick value of the Auto entry; every other value is a repository root. */
export const AUTO_PICK = "auto";

/** Auto first, then every repository with its branch and folder. The current choice says "selected". */
export function repoPickItems(
  repos: RepoInfo[],
  statuses: Record<string, RepoStatus | null | undefined>,
  auto: boolean,
  activeRoot: string | null,
): PickItem[] {
  const items: PickItem[] = [
    {
      value: AUTO_PICK,
      label: "Auto",
      description: [auto ? "selected" : null, "follows the open tab"].filter(Boolean).join("  "),
    },
  ];
  for (const repo of repos) {
    const head = statuses[repo.root]?.head ?? null;
    const branch = head?.branch ?? (head?.shortId ? `detached ${head.shortId}` : null);
    const folder = repo.relativePath && repo.relativePath !== repo.name ? repo.relativePath : null;
    const selected = !auto && repo.root === activeRoot;
    items.push({
      value: repo.root,
      label: repo.name,
      description: [selected ? "selected" : null, branch, folder].filter(Boolean).join("  ") || undefined,
      group: "Repositories",
    });
  }
  return items;
}
