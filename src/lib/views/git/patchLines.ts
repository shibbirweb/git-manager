// Splits a unified diff (the patches `git log -L` prints) into lines with their kind, for
// Show History for Selection.

export type PatchLineKind = "file" | "hunk" | "added" | "deleted" | "context";

export interface PatchLine {
  kind: PatchLineKind;
  text: string;
}

export function patchLines(patch: string): PatchLine[] {
  const lines = patch.replace(/\n$/, "").split("\n");
  const result: PatchLine[] = [];
  let inHeader = false;
  for (const text of lines) {
    if (text.startsWith("diff --git ")) {
      inHeader = true;
      result.push({ kind: "file", text });
      continue;
    }
    if (inHeader && !text.startsWith("@@")) {
      // index, ---, +++, mode and rename lines before the first hunk.
      result.push({ kind: "file", text });
      continue;
    }
    if (text.startsWith("@@")) {
      inHeader = false;
      result.push({ kind: "hunk", text });
    } else if (text.startsWith("+")) {
      result.push({ kind: "added", text });
    } else if (text.startsWith("-")) {
      result.push({ kind: "deleted", text });
    } else {
      result.push({ kind: "context", text });
    }
  }
  return withoutEmpty(result);
}

/** An empty patch has no lines at all. */
function withoutEmpty(lines: PatchLine[]): PatchLine[] {
  return lines.length === 1 && lines[0].text === "" ? [] : lines;
}
