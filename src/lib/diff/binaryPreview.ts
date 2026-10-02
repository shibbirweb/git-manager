// The side by side preview of a binary image or PDF in a diff: when it shows, what each side
// says, and the shared zoom and scroll of the two images. The view is BinaryPreview.svelte.

import type { FileDiff, PreviewSource, PreviewStat } from "$lib/types";
import { formatSize } from "$lib/views/git/lfs/lfsModel";
import { fitZoom, previewOf, tooLargeText } from "$lib/views/files/mediaPreview";

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

export interface NaturalSize {
  width: number;
  height: number;
}

/** "640 x 480 px, 12 KB", or as much of it as is known. */
export function sideInfo(natural: NaturalSize | null, size: number): string {
  const parts: string[] = [];
  if (natural) {
    parts.push(`${natural.width} x ${natural.height} px`);
  }
  if (size > 0) {
    parts.push(formatSize(size));
  }
  return parts.join(", ");
}

/**
 * Fit for both images at once: one zoom that fits each in its box, so the two stay at the
 * same scale and a bigger new version looks bigger.
 */
export function sharedFit(naturals: (NaturalSize | null)[], boxWidth: number, boxHeight: number): number {
  const fits = naturals
    .filter((natural): natural is NaturalSize => natural !== null)
    .map((natural) => fitZoom(natural.width, natural.height, boxWidth, boxHeight));
  return fits.length > 0 ? Math.min(...fits) : 1;
}

export interface ScrollBox {
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}

function ratio(position: number, size: number, client: number): number {
  const range = size - client;
  return range > 0 ? Math.min(1, Math.max(0, position / range)) : 0;
}

/** The scroll position of `to` at the same place as `from`, in proportion to each range. */
export function syncedScroll(from: ScrollBox, to: ScrollBox): { left: number; top: number } {
  return {
    left: Math.round(ratio(from.scrollLeft, from.scrollWidth, from.clientWidth) * Math.max(0, to.scrollWidth - to.clientWidth)),
    top: Math.round(ratio(from.scrollTop, from.scrollHeight, from.clientHeight) * Math.max(0, to.scrollHeight - to.clientHeight)),
  };
}
