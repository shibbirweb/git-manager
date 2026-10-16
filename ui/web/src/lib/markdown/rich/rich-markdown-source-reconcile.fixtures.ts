// Adapted from Orca (github.com/stablyai/orca), MIT License: see LICENSE-ORCA.
// The fake canonicalizer the reconcile tests share.
import { reconcileSerializedMarkdown } from "./rich-markdown-source-reconcile";

// A deterministic stand-in for the live editor's canonicalization, covering the
// exact style rewrites #6080 reports. Used both to derive baseCanonical/edited
// and as the injected safety `roundTrip`, so the fake stays self-consistent.
export function fakeCanonicalize(md: string): string {
  return md
    .split("\n")
    .map((line) => line.replace(/^(\s*)\* /, "$1- ")) // `* bullet` -> `- bullet`
    .join("\n")
    .replace(/__([^_]+)__/g, "**$1**") // `__strong__` -> `**strong**` (before emphasis)
    .replace(/_([^_]+)_/g, "*$1*"); // `_emphasis_` -> `*emphasis*`
}

export const roundTrip = (md: string): string => fakeCanonicalize(md);

/** Reconcile using the fake canonicalizer for both the base and the safety re-parse. */
export function reconcileWithFake(originalSource: string, edited: string): string {
  return reconcileSerializedMarkdown({
    originalSource,
    baseCanonical: fakeCanonicalize(originalSource),
    edited,
    roundTrip,
  });
}
