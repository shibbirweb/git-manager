// Pure text for Replace in Files in the Search Everywhere Text tab (FileSearch.svelte):
// the confirmation built from a preview run and the toast after the files are written.

import type { ReplaceOutcome, ReplaceSkippedFile, ReplaceSkipReason } from "$lib/types";

/** Names listed before "and N more". */
const LISTED_NAMES = 3;

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

export function matchCount(count: number): string {
  return plural(count, "match", "matches");
}

export function fileCount(count: number): string {
  return plural(count, "file", "files");
}

function baseName(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf("/") + 1);
}

function nameList(filePaths: string[]): string {
  const names = filePaths.slice(0, LISTED_NAMES).map(baseName);
  const rest = filePaths.length - names.length;
  return rest > 0 ? `${names.join(", ")} and ${rest} more` : names.join(", ");
}

const SKIP_LABELS: Record<ReplaceSkipReason, [string, string]> = {
  unsaved: ["file with unsaved changes", "files with unsaved changes"],
  link: ["symbolic link", "symbolic links"],
  readOnly: ["read-only file", "read-only files"],
};

/** One sentence per skip reason: "Skipped 1 file with unsaved changes: cart.ts." */
export function skippedText(skipped: readonly ReplaceSkippedFile[]): string {
  const sentences: string[] = [];
  for (const reason of Object.keys(SKIP_LABELS) as ReplaceSkipReason[]) {
    const files = skipped.filter((file) => file.reason === reason);
    if (files.length === 0) {
      continue;
    }
    const [one, many] = SKIP_LABELS[reason];
    sentences.push(`Skipped ${plural(files.length, one, many)}: ${nameList(files.map((file) => file.relativePath))}.`);
  }
  return sentences.join(" ");
}

export interface ReplaceConfirm {
  title: string;
  message: string;
  confirmLabel: string;
}

/** The question before Replace All, from a preview run; null when there is nothing to replace. */
export function replaceConfirm(preview: ReplaceOutcome, replacement: string): ReplaceConfirm | null {
  if (preview.replacements === 0) {
    return null;
  }
  const what = `Replace ${matchCount(preview.replacements)} in ${fileCount(preview.files.length)}?`;
  const parts = [what];
  if (replacement === "") {
    parts.push("The matches are deleted.");
  }
  const skipped = skippedText(preview.skipped);
  if (skipped) {
    parts.push(skipped);
  }
  parts.push("Files are written right away and cannot be undone here.");
  return { title: "Replace All", message: parts.join(" "), confirmLabel: "Replace All" };
}

/** Why there is nothing to replace, for the toast after a preview finds no match. */
export function nothingToReplace(preview: ReplaceOutcome): string {
  if (preview.error) {
    return preview.error;
  }
  return skippedText(preview.skipped);
}

export interface ReplaceSummary {
  kind: "success" | "error";
  title: string;
  detail: string;
}

/** The toast after Replace All: "Replaced 12 matches in 4 files", with skips and failures. */
export function replaceSummary(outcome: ReplaceOutcome): ReplaceSummary {
  const done = `${matchCount(outcome.replacements)} in ${fileCount(outcome.files.length)}`;
  let title = outcome.cancelled ? `Stopped after replacing ${done}` : `Replaced ${done}`;
  const details: string[] = [];
  const skipped = skippedText(outcome.skipped);
  if (skipped) {
    details.push(skipped);
  }
  if (outcome.failed.length > 0) {
    title += `, ${fileCount(outcome.failed.length)} failed`;
    for (const failure of outcome.failed.slice(0, LISTED_NAMES)) {
      details.push(`${baseName(failure.relativePath)}: ${failure.message}`);
    }
    if (outcome.failed.length > LISTED_NAMES) {
      details.push(`And ${outcome.failed.length - LISTED_NAMES} more.`);
    }
  }
  return {
    kind: outcome.failed.length > 0 ? "error" : "success",
    title,
    detail: details.join(" "),
  };
}
