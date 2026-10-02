// GitHub links for the Git menu's GitHub submenu: which remote points to github.com and
// the browser URLs for a file, a compare page and the pull requests. No API, no login.

import type { RemoteInfo } from "$lib/types";

export interface GitHubRepo {
  owner: string;
  repo: string;
}

const HOST = "github.com";

/**
 * The owner and repository of a github.com remote URL, in the forms git accepts:
 * https://github.com/OWNER/REPO(.git), https://user@github.com/..., ssh://git@github.com/...,
 * git://github.com/... and the scp-like git@github.com:OWNER/REPO.git. Null for any other host.
 */
export function parseGitHubUrl(url: string | null | undefined): GitHubRepo | null {
  const text = (url ?? "").trim();
  if (!text) {
    return null;
  }
  let host: string;
  let path: string;
  const scheme = /^([a-z][a-z0-9+.-]*):\/\/(?:[^@/]*@)?([^/:]+)(?::\d+)?\/(.*)$/i.exec(text);
  if (scheme) {
    const protocol = scheme[1].toLowerCase();
    if (!["https", "http", "ssh", "git", "git+ssh", "ssh+git"].includes(protocol)) {
      return null;
    }
    host = scheme[2];
    path = scheme[3];
  } else {
    // scp-like syntax: [user@]host:path, with no slash before the colon.
    const scp = /^(?:[^@/]+@)?([^/:]+):(?!\/)(.*)$/.exec(text);
    if (!scp) {
      return null;
    }
    host = scp[1];
    path = scp[2];
  }
  if (host.toLowerCase() !== HOST && host.toLowerCase() !== `www.${HOST}`) {
    return null;
  }
  const parts = path
    .replace(/[?#].*$/, "")
    .split("/")
    .filter((part) => part !== "");
  if (parts.length !== 2) {
    return null;
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!owner || !repo) {
    return null;
  }
  return { owner, repo };
}

export interface GitHubRemote extends GitHubRepo {
  remoteName: string;
  defaultBranch: string | null;
}

/** The GitHub remote to use: the branch's upstream remote, else origin, else the first github.com one. */
export function pickGitHubRemote(remotes: RemoteInfo[], preferredRemote: string | null = null): GitHubRemote | null {
  const found: GitHubRemote[] = [];
  for (const remote of remotes) {
    const parsed = parseGitHubUrl(remote.fetchUrl) ?? parseGitHubUrl(remote.pushUrl);
    if (parsed) {
      found.push({ ...parsed, remoteName: remote.name, defaultBranch: remote.defaultBranch ?? null });
    }
  }
  return (
    found.find((remote) => remote.remoteName === preferredRemote) ??
    found.find((remote) => remote.remoteName === "origin") ??
    found[0] ??
    null
  );
}

function repoUrl(repo: GitHubRepo): string {
  return `https://${HOST}/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
}

/** Each path segment encoded, the slashes kept. */
function encodePath(path: string): string {
  return path
    .split("/")
    .filter((part) => part !== "")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export interface LineRange {
  /** 1-based, inclusive. */
  start: number;
  end: number;
}

/** "#L10" or "#L10-L20". */
function lineAnchor(lines: LineRange | null): string {
  if (!lines || lines.start < 1) {
    return "";
  }
  return lines.end > lines.start ? `#L${lines.start}-L${lines.end}` : `#L${lines.start}`;
}

/**
 * The page of a file at `revision` (a commit id or a branch), scrolled to `lines`; without
 * a file, the repository's tree at that revision, or its home page without a revision.
 */
export function gitHubFileUrl(
  repo: GitHubRepo,
  revision: string | null,
  filePath: string | null,
  lines: LineRange | null = null,
): string {
  if (!revision) {
    return repoUrl(repo);
  }
  const encodedRevision = encodePath(revision);
  if (!filePath) {
    return `${repoUrl(repo)}/tree/${encodedRevision}`;
  }
  return `${repoUrl(repo)}/blob/${encodedRevision}/${encodePath(filePath)}${lineAnchor(lines)}`;
}

/** GitHub's "Open a pull request" page for `branchName` into `baseBranch` (main when unknown). */
export function gitHubCompareUrl(repo: GitHubRepo, baseBranch: string | null, branchName: string): string {
  const base = baseBranch?.trim() || "main";
  return `${repoUrl(repo)}/compare/${encodePath(base)}...${encodePath(branchName)}?expand=1`;
}

export function gitHubPullsUrl(repo: GitHubRepo): string {
  return `${repoUrl(repo)}/pulls`;
}

/**
 * The revision a link should point at: the branch when it is pushed as it is (same name on
 * that remote, nothing ahead), else the commit, which stays valid once pushed.
 */
export function linkRevision(
  head: { branch: string | null; upstream: string | null; ahead: number } | null,
  remoteName: string,
  commitId: string | null,
): string | null {
  const branch = head?.branch ?? null;
  if (branch && head?.upstream === `${remoteName}/${branch}` && head.ahead === 0) {
    return branch;
  }
  return commitId ?? branch;
}
