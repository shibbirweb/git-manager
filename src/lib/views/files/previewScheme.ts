// The runtime side of the `gmpreview` scheme: the URL base for this platform, the workspace
// folders the backend may serve from, and checking a file before its URL is set.

import { convertFileSrc } from "@tauri-apps/api/core";
import { api, errorMessage } from "$lib/api";
import type { PreviewSource, PreviewStat } from "$lib/types";
import { previewUrl, schemeBase } from "./previewSource";

let base: string | null = null;
let foldersSynced: Promise<void> = Promise.resolve();
/** Gives each Markdown image load its own URL, so an image changed on disk shows anew. */
let imageLoads = 0;

function currentBase(): string {
  if (base === null) {
    const internals = (window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc?: unknown } }).__TAURI_INTERNALS__;
    base = schemeBase(typeof internals?.convertFileSrc === "function" ? convertFileSrc : null);
  }
  return base;
}

/**
 * Tells the backend which folders this window shows: its previews reach only these, MCP tools
 * the folders of every window, and the title and window session follow. A preview waits for
 * the latest call, so a tab restored at start is not refused.
 */
export function syncWorkspaceFolders(folderPaths: string[], workspaceFile: string | null, title: string): void {
  foldersSynced = api.windowSetWorkspace(folderPaths, workspaceFile, title).catch(() => undefined);
}

export interface OpenedPreview {
  stat: PreviewStat;
  /** Null when the file is missing or too big. */
  url: string | null;
}

/** Checks the file, then gives the URL to load it from. Throws when it may not be shown. */
export async function openPreview(source: PreviewSource, version: number): Promise<OpenedPreview> {
  await foldersSynced;
  const stat = await api.previewStat(source);
  const url = stat.exists && stat.limit === null ? previewUrl(currentBase(), source, version) : null;
  return { stat, url };
}

/**
 * The URL of a local image of a Markdown document (absolute `filePath`, inside the workspace).
 * The web view loads it straight from the scheme, so the bytes never enter JavaScript the way a
 * data URL did. Throws with a short reason when the image cannot be shown.
 */
export async function markdownImageUrl(filePath: string): Promise<string> {
  let opened: OpenedPreview;
  try {
    opened = await openPreview({ kind: "worktree", filePath }, ++imageLoads);
  } catch (error) {
    throw new Error(errorMessage(error) || "Image not shown");
  }
  if (!opened.stat.exists) {
    throw new Error("Image not found");
  }
  if (opened.url === null) {
    const limit = Math.round((opened.stat.limit ?? 0) / 1024 / 1024);
    throw new Error(`The image is larger than ${limit} MB`);
  }
  return opened.url;
}
