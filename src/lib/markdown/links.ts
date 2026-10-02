// What a link or image in the Markdown preview points at. Pure, so the rules
// (what opens in the browser, in the app, or not at all) are tested directly.

import { joinPath, normalizePath, parentOf } from "$lib/stores/workspacePaths";

/** Ids of headings and of ids in raw HTML get this prefix, like on GitHub, so they never clash with the app's own. */
export const ID_PREFIX = "user-content-";

export interface LinkContext {
  /** Absolute path of the Markdown file. */
  documentPath: string;
  /** Where links starting with "/" are resolved: the repository (or folder) root, like on GitHub. */
  rootPath: string;
  /** The absolute path is inside a workspace folder. */
  isInWorkspace: (absolutePath: string) => boolean;
}

export type LinkTarget =
  | { kind: "external"; url: string }
  | { kind: "anchor"; id: string }
  | { kind: "file"; filePath: string; anchor: string | null }
  | { kind: "blocked" };

export type ImageSource =
  | { kind: "data"; url: string }
  | { kind: "remote"; url: string }
  | { kind: "local"; filePath: string }
  | { kind: "blocked"; reason: string };

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp"]);
const DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp|svg\+xml)[;,]/i;

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Splits "path?query#anchor" into the decoded path and the anchor. */
function splitPath(href: string): { path: string; anchor: string | null } {
  const hash = href.indexOf("#");
  const anchor = hash >= 0 ? decode(href.slice(hash + 1)) : null;
  const withoutHash = hash >= 0 ? href.slice(0, hash) : href;
  const query = withoutHash.indexOf("?");
  const path = query >= 0 ? withoutHash.slice(0, query) : withoutHash;
  return { path: decode(path), anchor: anchor === "" ? null : anchor };
}

/** An absolute path for a local link: relative to the document, or "/x" from the root unless it is already a workspace path. */
function resolveLocal(path: string, context: LinkContext): string {
  if (path.startsWith("/")) {
    const absolute = normalizePath(path);
    return context.isInWorkspace(absolute) ? absolute : normalizePath(joinPath(context.rootPath, path.slice(1)));
  }
  return normalizePath(joinPath(parentOf(context.documentPath), path));
}

export function classifyLink(href: string, context: LinkContext): LinkTarget {
  const trimmed = href.trim();
  if (!trimmed) {
    return { kind: "blocked" };
  }
  if (trimmed.startsWith("#")) {
    return { kind: "anchor", id: decode(trimmed.slice(1)) };
  }
  if (trimmed.startsWith("//")) {
    return { kind: "external", url: `https:${trimmed}` };
  }
  const scheme = SCHEME.exec(trimmed)?.[1]?.toLowerCase() ?? null;
  if (scheme === "http" || scheme === "https" || scheme === "mailto") {
    return { kind: "external", url: trimmed };
  }
  if (scheme !== null) {
    // javascript:, data:, file: and anything else never run or navigate.
    return { kind: "blocked" };
  }
  const { path, anchor } = splitPath(trimmed);
  if (!path) {
    return anchor ? { kind: "anchor", id: anchor } : { kind: "blocked" };
  }
  // A folder has no editor tab to open.
  if (path.endsWith("/")) {
    return { kind: "blocked" };
  }
  const filePath = resolveLocal(path, context);
  return context.isInWorkspace(filePath) ? { kind: "file", filePath, anchor } : { kind: "blocked" };
}

export function isImagePath(filePath: string): boolean {
  const name = filePath.slice(filePath.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 && IMAGE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

export function classifyImage(src: string, context: LinkContext): ImageSource {
  const trimmed = src.trim();
  if (!trimmed) {
    return { kind: "blocked", reason: "No image path" };
  }
  if (DATA_IMAGE.test(trimmed)) {
    return { kind: "data", url: trimmed };
  }
  if (trimmed.startsWith("//")) {
    return { kind: "remote", url: `https:${trimmed}` };
  }
  const scheme = SCHEME.exec(trimmed)?.[1]?.toLowerCase() ?? null;
  if (scheme === "http" || scheme === "https") {
    return { kind: "remote", url: trimmed };
  }
  if (scheme !== null) {
    return { kind: "blocked", reason: "Image not shown" };
  }
  const { path } = splitPath(trimmed);
  if (!path) {
    return { kind: "blocked", reason: "No image path" };
  }
  const filePath = resolveLocal(path, context);
  if (!context.isInWorkspace(filePath)) {
    return { kind: "blocked", reason: "Image outside the workspace" };
  }
  if (!isImagePath(filePath)) {
    return { kind: "blocked", reason: "Unsupported image type" };
  }
  return { kind: "local", filePath };
}
