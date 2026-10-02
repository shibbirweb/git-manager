// Git views opened from the Git menu's Current File submenu in their own editor tab: a
// file's history, the history of a few lines, and a file compared with a revision. Like
// commit tabs (commitTabs.ts) they share the tab strip with files, so each has a pseudo
// path that can never be a file: it does not start with "/".

export type GitTabRef =
  | { kind: "fileHistory"; repoRoot: string; filePath: string }
  /** Lines are 1-based and inclusive. */
  | { kind: "lineHistory"; repoRoot: string; filePath: string; startLine: number; endLine: number }
  | { kind: "compare"; repoRoot: string; filePath: string; revision: string }
  /** A file of a shelved change list (Shelf > Show Diff), read-only. */
  | { kind: "shelf"; repoRoot: string; filePath: string; shelfId: string };

const PREFIX = "git-";
const KINDS = ["fileHistory", "lineHistory", "compare", "shelf"] as const;

export function gitTabPath(ref: GitTabRef): string {
  const parts = [ref.repoRoot, ref.filePath];
  if (ref.kind === "lineHistory") {
    parts.push(`${ref.startLine}-${ref.endLine}`);
  } else if (ref.kind === "compare") {
    parts.push(ref.revision);
  } else if (ref.kind === "shelf") {
    parts.push(ref.shelfId);
  }
  return `${PREFIX}${ref.kind}:${parts.map((part) => encodeURIComponent(part)).join("|")}`;
}

function decode(part: string | undefined): string | null {
  if (part === undefined) {
    return null;
  }
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

export function parseGitTabPath(tabPath: string): GitTabRef | null {
  if (!tabPath.startsWith(PREFIX)) {
    return null;
  }
  const colon = tabPath.indexOf(":");
  const kind = KINDS.find((candidate) => candidate === tabPath.slice(PREFIX.length, colon));
  if (!kind || colon < 0) {
    return null;
  }
  const parts = tabPath.slice(colon + 1).split("|");
  const repoRoot = decode(parts[0]);
  const filePath = decode(parts[1]);
  if (!repoRoot || !filePath) {
    return null;
  }
  if (kind === "fileHistory") {
    return parts.length === 2 ? { kind, repoRoot, filePath } : null;
  }
  const extra = decode(parts[2]);
  if (parts.length !== 3 || !extra) {
    return null;
  }
  if (kind === "compare") {
    return { kind, repoRoot, filePath, revision: extra };
  }
  if (kind === "shelf") {
    return { kind, repoRoot, filePath, shelfId: extra };
  }
  const match = /^(\d+)-(\d+)$/.exec(extra);
  const startLine = Number(match?.[1] ?? 0);
  const endLine = Number(match?.[2] ?? 0);
  if (startLine < 1 || endLine < startLine) {
    return null;
  }
  return { kind, repoRoot, filePath, startLine, endLine };
}

export function isGitTab(tabPath: string): boolean {
  return parseGitTabPath(tabPath) !== null;
}

function fileName(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf("/") + 1);
}

/** Short revision text: a full hash cut to 8 characters, a branch kept. */
export function revisionLabel(revision: string): string {
  return /^[0-9a-f]{40,64}$/i.test(revision) ? revision.slice(0, 8) : revision;
}

/** The tab's label and tooltip. */
export function gitTabTitle(ref: GitTabRef): { name: string; title: string } {
  const name = fileName(ref.filePath);
  const repoName = fileName(ref.repoRoot);
  if (ref.kind === "fileHistory") {
    return { name: `History: ${name}`, title: `History of ${ref.filePath} (${repoName})` };
  }
  if (ref.kind === "lineHistory") {
    const lines = ref.startLine === ref.endLine ? `${ref.startLine}` : `${ref.startLine}-${ref.endLine}`;
    return {
      name: `History: ${name}:${lines}`,
      title: `History of lines ${lines} of ${ref.filePath} (${repoName})`,
    };
  }
  if (ref.kind === "shelf") {
    return { name: `Shelved: ${name}`, title: `${ref.filePath} in shelved changes (${repoName})` };
  }
  const revision = revisionLabel(ref.revision);
  return { name: `${name} vs ${revision}`, title: `${ref.filePath} at ${revision} compared with the working copy (${repoName})` };
}

/** Git tabs of repositories inside `folderRoot`, to close with the folder. */
export function gitTabsInFolder(tabPaths: string[], folderRoot: string): string[] {
  const prefix = folderRoot.endsWith("/") ? folderRoot : `${folderRoot}/`;
  return tabPaths.filter((tabPath) => {
    const ref = parseGitTabPath(tabPath);
    return ref !== null && (ref.repoRoot === folderRoot || ref.repoRoot.startsWith(prefix));
  });
}
