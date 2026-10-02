// Pure rules of the GitHub account features (Share Project, Sync Fork, Create Gist and the
// sign-in form): validation, defaults and labels. The API calls happen in Rust.

import type { GitHubAccount, GitHubSyncForkOutcome } from "$lib/types";

/** Creates a classic token with the scopes Share Project and Create Gist need. */
export const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=repo,gist&description=Git%20Manager";

const NAME_LIMIT = 100;

/** GitHub's repository name rules; null when the name is fine. */
export function validateRepositoryName(repositoryName: string): string | null {
  const name = repositoryName.trim();
  if (!name) {
    return "Enter a repository name";
  }
  if (name.length > NAME_LIMIT) {
    return "A repository name has at most 100 characters";
  }
  if (name === "." || name === "..") {
    return "This repository name is reserved";
  }
  if (/\.git$/i.test(name)) {
    return "Leave out the .git ending";
  }
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    return "Use only letters, digits, '.', '-' and '_'";
  }
  return null;
}

/** The folder name as GitHub would accept it: other characters become '-'. */
export function suggestRepositoryName(folderName: string): string {
  const cleaned = folderName
    .trim()
    .replace(/\.git$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, NAME_LIMIT);
  return cleaned === "." || cleaned === ".." ? "" : cleaned;
}

/** "origin", or "github" when origin is taken (JetBrains does the same), then "github-2"... */
export function defaultShareRemoteName(remoteNames: string[]): string {
  if (!remoteNames.includes("origin")) {
    return "origin";
  }
  if (!remoteNames.includes("github")) {
    return "github";
  }
  let suffix = 2;
  while (remoteNames.includes(`github-${suffix}`)) {
    suffix++;
  }
  return `github-${suffix}`;
}

export function validateShareRemoteName(remoteName: string, remoteNames: string[]): string | null {
  const name = remoteName.trim();
  if (!name) {
    return "Enter a remote name";
  }
  if (name.startsWith("-") || /[\s~^:?*[\\]/.test(name) || name.includes("..")) {
    return "Not a valid remote name";
  }
  if (remoteNames.includes(name)) {
    return `A remote named ${name} already exists`;
  }
  return null;
}

export function validateGistFileName(fileName: string): string | null {
  const name = fileName.trim();
  if (!name) {
    return "Enter a file name";
  }
  if (/[/\\]/.test(name)) {
    return "A gist file name cannot contain slashes";
  }
  return null;
}

/** The last segment of a path, for the gist's file name. */
export function gistFileName(filePath: string | null | undefined): string {
  const parts = (filePath ?? "").split(/[/\\]/).filter((part) => part !== "");
  return parts[parts.length - 1] ?? "";
}

/** The fork's branch to sync: the current branch when it tracks the same name on the fork's remote, else the default. */
export function syncForkBranch(
  head: { branch: string | null; upstream: string | null } | null,
  remoteName: string,
  defaultBranch: string | null,
): string | null {
  const branch = head?.branch ?? null;
  if (branch && head?.upstream === `${remoteName}/${branch}`) {
    return branch;
  }
  return defaultBranch ?? branch;
}

export function syncForkTitle(outcome: GitHubSyncForkOutcome): string {
  switch (outcome.kind) {
    case "fastForward":
      return "Fork synced (fast-forward)";
    case "merge":
      return "Fork synced (merge commit)";
    case "upToDate":
      return "Fork is up to date";
    case "conflict":
      return "Fork has conflicts";
  }
}

function encodeSegments(text: string): string {
  return text
    .split("/")
    .filter((part) => part !== "")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

/**
 * The compare page that opens a pull request from the upstream branch into the fork's branch,
 * for when GitHub cannot sync because of conflicts.
 */
export function forkCompareUrl(
  fork: { owner: string; repo: string },
  parent: { owner: string; repo: string },
  branchName: string,
  parentBranch: string | null = null,
): string {
  const base = encodeSegments(branchName);
  const head = `${encodeURIComponent(parent.owner)}:${encodeURIComponent(parent.repo)}:${encodeSegments(parentBranch ?? branchName)}`;
  return `https://github.com/${encodeURIComponent(fork.owner)}/${encodeURIComponent(fork.repo)}/compare/${base}...${head}?expand=1`;
}

/** Up to two letters for the avatar circle: from the name's words, else the login. */
export function accountInitials(account: Pick<GitHubAccount, "login" | "name"> | null): string {
  if (!account) {
    return "";
  }
  const words = (account.name ?? "").trim().split(/\s+/).filter((word) => word !== "");
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  const source = words[0] ?? account.login;
  return source.slice(0, 2).toUpperCase();
}

export function missingScopesHint(account: GitHubAccount | null): string | null {
  const missing = account?.missingScopes ?? [];
  if (missing.length === 0) {
    return null;
  }
  const list = missing.join(" and ");
  return `This token lacks the ${list} scope${missing.length > 1 ? "s" : ""}: some GitHub actions will fail.`;
}
