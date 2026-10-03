// What the Git menu's enabled and shown state is computed from (menuState.ts), read from the
// stores. Only reactive reads happen here, so the menu follows them.

import type { GitFileInputs, GitRepoInputs } from "$lib/menu/menuState";
import { fileCommands } from "$lib/stores/fileCommands.svelte";
import { isPseudoTab } from "$lib/stores/pseudoTabs";
import { repoStore } from "$lib/stores/repo.svelte";
import { locateAbsolute } from "$lib/stores/workspacePaths";
import type { FileStatus } from "$lib/types";
import { pickGitHubRemote } from "./github";
import { remoteLinks } from "./remoteLinks";

export function gitRepoInputs(): GitRepoInputs | null {
  const repo = repoStore.repo;
  if (!repo) {
    return null;
  }
  const status = repoStore.status;
  const head = status?.head ?? null;
  const preferredRemote = head?.upstream?.split("/")[0] ?? null;
  return {
    busy: repoStore.busy !== null,
    ahead: head?.ahead ?? 0,
    behind: head?.behind ?? 0,
    branch: head?.branch ?? null,
    unborn: head?.unborn ?? false,
    op: status?.op.kind ?? "none",
    conflicts: repoStore.conflictCount,
    changes: status?.files.length ?? 0,
    remotes: repoStore.refs?.remotes.length ?? repoStore.remotes.length,
    github: pickGitHubRemote(repoStore.remotes, preferredRemote) !== null,
    remoteLinks: remoteLinks(repoStore.remotes).length,
  };
}

/** The current file: the file tab on screen, with its repository and repo-relative path. */
export function currentGitFile(activePath: string | null): { repoRoot: string; filePath: string; absolutePath: string } | null {
  if (!activePath || isPseudoTab(activePath)) {
    return null;
  }
  const location = locateAbsolute(repoStore.repos, activePath);
  if (!location || location.repoPath === "") {
    return null;
  }
  return { repoRoot: location.repo.root, filePath: location.repoPath, absolutePath: activePath };
}

/** The status entry of a repo-relative file, or null when it has no changes. */
export function fileStatusOf(repoRoot: string, filePath: string): FileStatus | null {
  return repoStore.statuses[repoRoot]?.files.find((file) => file.path === filePath) ?? null;
}

export function gitFileInputs(activePath: string | null): GitFileInputs | null {
  const current = currentGitFile(activePath);
  if (!current) {
    return null;
  }
  const file = fileStatusOf(current.repoRoot, current.filePath);
  return {
    busy: repoStore.busy !== null,
    changed: file !== null,
    untracked: file?.unstaged === "untracked",
    unstaged: file !== null && file.unstaged !== null,
    conflicted: file?.conflicted ?? false,
    hasEditor: fileCommands.states[current.absolutePath]?.editable ?? false,
  };
}
