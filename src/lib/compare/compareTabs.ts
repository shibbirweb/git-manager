// Compare Files tabs: two workspace files, or a file and the clipboard, as a diff in their
// own editor tab. Like the other pseudo tabs (pseudoTabs.ts) the tab path can never be a
// file: it does not start with "/". A file side is its absolute path; a clipboard side is
// the number of a text kept in memory by compareStore.svelte.ts.

import { baseName, isInside, parentOf } from "$lib/stores/workspacePaths";

export type CompareSideRef = { kind: "file"; filePath: string } | { kind: "clipboard"; clipId: number };

export interface CompareTabRef {
  left: CompareSideRef;
  right: CompareSideRef;
}

const PREFIX = "compare-files:";

function encodeSide(side: CompareSideRef): string {
  return side.kind === "file" ? `f${encodeURIComponent(side.filePath)}` : `c${side.clipId}`;
}

function decodeSide(part: string): CompareSideRef | null {
  const rest = part.slice(1);
  if (part.startsWith("c") && /^\d{1,9}$/.test(rest)) {
    return { kind: "clipboard", clipId: Number(rest) };
  }
  if (!part.startsWith("f") || rest === "") {
    return null;
  }
  try {
    const filePath = decodeURIComponent(rest);
    return filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath) ? { kind: "file", filePath } : null;
  } catch {
    return null;
  }
}

export function compareTabPath(ref: CompareTabRef): string {
  return `${PREFIX}${encodeSide(ref.left)}|${encodeSide(ref.right)}`;
}

export function parseCompareTabPath(tabPath: string): CompareTabRef | null {
  if (!tabPath.startsWith(PREFIX)) {
    return null;
  }
  const parts = tabPath.slice(PREFIX.length).split("|");
  if (parts.length !== 2) {
    return null;
  }
  const left = decodeSide(parts[0]);
  const right = decodeSide(parts[1]);
  return left && right ? { left, right } : null;
}

export function isCompareTab(tabPath: string): boolean {
  return parseCompareTabPath(tabPath) !== null;
}

/** The clipboard texts a tab holds, so they can be freed when no tab needs them. */
export function clipIdsOf(tabPath: string): number[] {
  const ref = parseCompareTabPath(tabPath);
  if (!ref) {
    return [];
  }
  return [ref.left, ref.right].flatMap((side) => (side.kind === "clipboard" ? [side.clipId] : []));
}

/** Names of the two sides: file names, with their folders when both have the same name. */
export function sideLabels(ref: CompareTabRef): [string, string] {
  const name = (side: CompareSideRef) => (side.kind === "file" ? baseName(side.filePath) : "Clipboard");
  const left = name(ref.left);
  const right = name(ref.right);
  if (left !== right || ref.left.kind !== "file" || ref.right.kind !== "file") {
    return [left, right];
  }
  const folder = (filePath: string) => baseName(parentOf(filePath)) || parentOf(filePath);
  return [`${left} (${folder(ref.left.filePath)})`, `${right} (${folder(ref.right.filePath)})`];
}

/** The tab's label and tooltip. */
export function compareTabTitle(ref: CompareTabRef): { name: string; title: string } {
  const [left, right] = sideLabels(ref);
  const full = (side: CompareSideRef) => (side.kind === "file" ? side.filePath : "the clipboard");
  return { name: `${left} vs ${right}`, title: `${full(ref.left)} compared with ${full(ref.right)}` };
}

/** Compare tabs with a file inside `folderRoot`, to close with the folder. */
export function compareTabsInFolder(tabPaths: string[], folderRoot: string): string[] {
  return tabPaths.filter((tabPath) => {
    const ref = parseCompareTabPath(tabPath);
    return ref !== null && [ref.left, ref.right].some((side) => side.kind === "file" && isInside(folderRoot, side.filePath));
  });
}
