// The side by side preview of a binary image or PDF in a diff: when it shows and what each side says. The view is
// BinaryPreview.svelte on the UI library's MediaCompare, which owns the shared zoom and scroll.

import type { FileDiff, PreviewSource, PreviewStat } from "$lib/types";
import { formatSize } from "$lib/views/git/lfs/lfsModel";
import { previewOf, tooLargeText } from "$lib/views/files/mediaPreview";

/**
 * Where the two sides of a diff come from, for the preview. A null side does not exist, such
 * as the parent of a root commit. `version` changes when the files may have changed.
 */
export interface PreviewSides {
  original: PreviewSource | null;
  modified: PreviewSource | null;
  version?: number;
}

export type SideRole = "original" | "modified";

/** The preview replaces "Binary file" for images and PDFs; Git LFS pointers keep their sizes. */
export function showsBinaryPreview(diff: FileDiff, path: string, sides: PreviewSides | null): boolean {
  return sides !== null && (diff.binary || diff.tooLarge) && !diff.lfs && previewOf(path) !== null;
}

/** What a side without a file says: the old side is not in its revision, the new one is gone. */
export function absentText(role: SideRole, label: string): string {
  return role === "original" ? `Not in ${label}` : "Deleted";
}

export type SideState =
  | { status: "loading" }
  | { status: "absent"; text: string }
  | { status: "error"; text: string }
  | { status: "ready"; url: string; size: number };

/** One side from its source and what loading it found (stat and URL, or an error). */
export function sideState(
  role: SideRole,
  label: string,
  source: PreviewSource | null,
  loaded: { stat: PreviewStat; url: string | null } | { error: string } | null,
): SideState {
  if (!source) {
    return { status: "absent", text: absentText(role, label) };
  }
  if (!loaded) {
    return { status: "loading" };
  }
  if ("error" in loaded) {
    return { status: "error", text: loaded.error };
  }
  if (!loaded.stat.exists) {
    return { status: "absent", text: absentText(role, label) };
  }
  if (loaded.stat.limit !== null) {
    return { status: "error", text: tooLargeText(loaded.stat.limit) };
  }
  if (!loaded.url) {
    return { status: "error", text: "This file cannot be shown." };
  }
  return { status: "ready", url: loaded.url, size: loaded.stat.size };
}

/** A side as the UI library's MediaCompare draws it: the file, or why there is none. */
export interface CompareSide {
  label: string;
  kind: "image" | "pdf" | "none";
  src?: string;
  info?: string;
  message?: string;
}

export function compareSide(state: SideState, kind: "image" | "pdf" | null, label: string): CompareSide {
  if (state.status === "ready" && kind !== null) {
    return { label, kind, src: state.url, info: state.size > 0 ? formatSize(state.size) : "" };
  }
  const message =
    state.status === "loading" ? "Loading..." : state.status === "ready" ? "This file cannot be shown." : state.text;
  return { label, kind: "none", message };
}
