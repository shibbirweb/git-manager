// The runtime side of the `gmpreview` scheme: the URL base for this platform, the workspace
// folders the backend may serve from, and checking a file before its URL is set.

import { convertFileSrc } from "@tauri-apps/api/core";
import { api } from "$lib/api";
import type { PreviewSource, PreviewStat } from "$lib/types";
import { previewUrl, schemeBase } from "./previewSource";

let base: string | null = null;
let foldersSynced: Promise<void> = Promise.resolve();

function currentBase(): string {
  if (base === null) {
    const internals = (window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc?: unknown } }).__TAURI_INTERNALS__;
    base = schemeBase(typeof internals?.convertFileSrc === "function" ? convertFileSrc : null);
  }
  return base;
}

/**
 * Tells the backend which folders are open: MCP tools and the preview scheme reach only these.
 * A preview waits for the latest call, so a tab restored at start is not refused.
 */
export function syncWorkspaceFolders(folderPaths: string[]): void {
  foldersSynced = api.mcpSetWorkspace(folderPaths).catch(() => undefined);
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
