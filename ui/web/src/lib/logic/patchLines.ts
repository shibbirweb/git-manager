// A unified patch (git diff output) as lines with a kind, so a patch view colors added and removed lines, hunk
// headers and file headers without parsing in the component.

export type PatchLineKind = "file" | "hunk" | "added" | "deleted" | "context";

export interface PatchLine {
  kind: PatchLineKind;
  text: string;
}

const FILE_HEADERS = ["diff --git ", "index ", "--- ", "+++ ", "new file mode", "deleted file mode", "similarity "];

/** The kind of one patch line; file headers are checked first, since "--- a/x" also starts with "-". */
export function patchLineKind(line: string): PatchLineKind {
  if (FILE_HEADERS.some((header) => line.startsWith(header)) || line.startsWith("rename ")) {
    return "file";
  }
  if (line.startsWith("@@")) {
    return "hunk";
  }
  if (line.startsWith("+")) {
    return "added";
  }
  if (line.startsWith("-")) {
    return "deleted";
  }
  return "context";
}

/** Every line of a patch with its kind; a trailing newline adds no empty line. */
export function patchLines(patch: string): PatchLine[] {
  if (patch === "") {
    return [];
  }
  return patch
    .replace(/\n$/, "")
    .split("\n")
    .map((text) => ({ kind: patchLineKind(text), text }));
}
