// Branches popup views in their own editor tab: Compare with Current (commits each branch
// has that the other lacks, and the files that differ) and Show Diff with Working Tree.
// Like commit and Git tabs they share the tab strip with files, so each has a pseudo path
// that can never be a file: it does not start with "/".

export type BranchTabRef =
  /** `branchName` against `baseName` (the branch that was current when it opened). */
  | { kind: "compare"; repoRoot: string; branchName: string; baseName: string }
  | { kind: "worktree"; repoRoot: string; revision: string };

const PREFIX = "branches-";
const KINDS = ["compare", "worktree"] as const;

export function branchTabPath(ref: BranchTabRef): string {
  const parts = ref.kind === "compare" ? [ref.repoRoot, ref.branchName, ref.baseName] : [ref.repoRoot, ref.revision];
  return `${PREFIX}${ref.kind}:${parts.map((part) => encodeURIComponent(part)).join("|")}`;
}

function decode(part: string | undefined): string | null {
  if (part === undefined || part === "") {
    return null;
  }
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

export function parseBranchTabPath(tabPath: string): BranchTabRef | null {
  if (!tabPath.startsWith(PREFIX)) {
    return null;
  }
  const colon = tabPath.indexOf(":");
  const kind = KINDS.find((candidate) => candidate === tabPath.slice(PREFIX.length, colon));
  if (!kind || colon < 0) {
    return null;
  }
  const parts = tabPath.slice(colon + 1).split("|").map(decode);
  const [repoRoot, first, second] = parts;
  if (!repoRoot || !first) {
    return null;
  }
  if (kind === "worktree") {
    return parts.length === 2 ? { kind, repoRoot, revision: first } : null;
  }
  return parts.length === 3 && second ? { kind, repoRoot, branchName: first, baseName: second } : null;
}

export function isBranchTab(tabPath: string): boolean {
  return parseBranchTabPath(tabPath) !== null;
}

function lastPart(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** The tab's label and tooltip. */
export function branchTabTitle(ref: BranchTabRef): { name: string; title: string } {
  const repoName = lastPart(ref.repoRoot);
  if (ref.kind === "compare") {
    return {
      name: `${ref.branchName} vs ${ref.baseName}`,
      title: `${ref.branchName} compared with ${ref.baseName} (${repoName})`,
    };
  }
  return { name: `${ref.revision} vs Working Tree`, title: `${ref.revision} compared with the working tree (${repoName})` };
}

/** Branch tabs of repositories inside `folderRoot`, to close with the folder. */
export function branchTabsInFolder(tabPaths: string[], folderRoot: string): string[] {
  const prefix = folderRoot.endsWith("/") ? folderRoot : `${folderRoot}/`;
  return tabPaths.filter((tabPath) => {
    const ref = parseBranchTabPath(tabPath);
    return ref !== null && (ref.repoRoot === folderRoot || ref.repoRoot.startsWith(prefix));
  });
}
