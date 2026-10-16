// A unified patch (git diff output) as lines with a kind, so a patch view colors added and removed lines, hunk
// headers and file headers without parsing in the component.

export type PatchLineKind = "file" | "hunk" | "added" | "deleted" | "context";

export interface PatchLine {
  kind: PatchLineKind;
  text: string;
}

const FILE_HEADERS = ["diff --git ", "index ", "--- ", "+++ ", "new file mode", "deleted file mode", "similarity "];

/** The kind of a line inside a hunk, where "--- x" is a removed line "-- x", not a file header. */
function hunkLineKind(line: string): PatchLineKind {
  if (line.startsWith("@@")) {
    return "hunk";
  }
  if (line.startsWith("+")) {
    return "added";
  }
  return line.startsWith("-") ? "deleted" : "context";
}

/** The kind of one patch line; file headers are checked first, since "--- a/x" also starts with "-". */
export function patchLineKind(line: string): PatchLineKind {
  if (FILE_HEADERS.some((header) => line.startsWith(header)) || line.startsWith("rename ")) {
    return "file";
  }
  return hunkLineKind(line);
}

/** Every line of a patch with its kind; a trailing newline adds no empty line. File headers count only between a
 *  file's "diff --git" line and its first hunk. */
export function patchLines(patch: string): PatchLine[] {
  if (patch === "") {
    return [];
  }
  let inHunk = false;
  return patch
    .replace(/\n$/, "")
    .split("\n")
    .map((text) => {
      if (text.startsWith("diff --git ")) {
        inHunk = false;
      } else if (text.startsWith("@@")) {
        inHunk = true;
      }
      return { kind: inHunk ? hunkLineKind(text) : patchLineKind(text), text };
    });
}
