// A commit opened in its own editor tab, so its changes get the editor area
// instead of a small panel. It shares the tab strip with
// file tabs, so its "path" is a pseudo path that can never be a file: it does
// not start with "/", so folder and repository lookups never match it.

const PREFIX = "commit:";

export interface CommitTabRef {
  repoRoot: string;
  commitId: string;
}

export function commitTabPath(repoRoot: string, commitId: string): string {
  return `${PREFIX}${commitId}@${repoRoot}`;
}

export function parseCommitTabPath(tabPath: string): CommitTabRef | null {
  if (!tabPath.startsWith(PREFIX)) {
    return null;
  }
  const rest = tabPath.slice(PREFIX.length);
  const at = rest.indexOf("@");
  const commitId = at > 0 ? rest.slice(0, at) : "";
  const repoRoot = at > 0 ? rest.slice(at + 1) : "";
  if (!/^[0-9a-f]{4,64}$/i.test(commitId) || repoRoot === "") {
    return null;
  }
  return { repoRoot, commitId };
}

export function isCommitTab(tabPath: string): boolean {
  return parseCommitTabPath(tabPath) !== null;
}

/** Commit tabs of repositories inside `folderRoot`, to close with the folder. */
export function commitTabsInFolder(tabPaths: string[], folderRoot: string): string[] {
  const prefix = folderRoot.endsWith("/") ? folderRoot : `${folderRoot}/`;
  return tabPaths.filter((tabPath) => {
    const ref = parseCommitTabPath(tabPath);
    return ref !== null && (ref.repoRoot === folderRoot || ref.repoRoot.startsWith(prefix));
  });
}
