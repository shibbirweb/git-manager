// A changed file's kind as the letter and tone the Changes list shows, the same on every platform.

export type FileKind = "added" | "modified" | "typechange" | "deleted" | "renamed" | "untracked" | "conflicted";

const LETTERS: Record<FileKind, string> = {
  added: "A",
  modified: "M",
  typechange: "T",
  deleted: "D",
  renamed: "R",
  untracked: "U",
  conflicted: "C",
};

export function statusLetter(kind: FileKind | null): string {
  return kind ? LETTERS[kind] : "!";
}

export function statusLabel(kind: FileKind | null): string {
  return kind ? `${kind.charAt(0).toUpperCase()}${kind.slice(1)}` : "Conflicted";
}
