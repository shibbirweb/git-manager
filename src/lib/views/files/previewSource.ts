// URLs of the `gmpreview` scheme (src-tauri/src/preview_scheme.rs), which serves the images and
// PDFs of the file preview and the binary diff preview. Each part is percent-encoded on its own,
// so a "/" inside a path never splits it:
//   <base>worktree/<absolute file path>
//   <base>revision/<repository root>/<revision>/<repo-relative path>
// The `v` query is ignored by the backend; a new value makes the web view load the file again.

import type { PreviewSource } from "$lib/types";

export const PREVIEW_SCHEME = "gmpreview";

/** Revisions the scheme understands, besides a full commit id. */
export const HEAD_REVISION = "HEAD";
export const INDEX_REVISION = "index";

/** The first parent of a commit (given by its full id). */
export function parentRevision(commitId: string): string {
  return `${commitId}^`;
}

type ConvertFileSrc = (filePath: string, protocol: string) => string;

/**
 * Where the scheme's URLs start: `gmpreview://localhost/` on macOS and Linux and
 * `http://gmpreview.localhost/` on Windows, as Tauri's `convertFileSrc` builds them. Without
 * Tauri (the screenshot page) the Windows form, which a browser can route.
 */
export function schemeBase(convert: ConvertFileSrc | null): string {
  const base = convert ? convert("", PREVIEW_SCHEME) : `http://${PREVIEW_SCHEME}.localhost/`;
  return base.endsWith("/") ? base : `${base}/`;
}

export function previewUrl(base: string, source: PreviewSource, version: number): string {
  const parts =
    source.kind === "worktree"
      ? ["worktree", source.filePath]
      : ["revision", source.repoRoot, source.revision, source.filePath];
  const [kind, ...rest] = parts;
  return `${base}${kind}/${rest.map((part) => encodeURIComponent(part)).join("/")}?v=${version}`;
}

/** The file name of a source, for alt text and titles. */
export function sourceName(source: PreviewSource): string {
  return source.filePath.slice(source.filePath.replace(/\\/g, "/").lastIndexOf("/") + 1);
}

export function sameSource(left: PreviewSource | null, right: PreviewSource | null): boolean {
  if (!left || !right) {
    return left === right;
  }
  if (left.kind === "worktree" || right.kind === "worktree") {
    return left.kind === right.kind && left.filePath === right.filePath;
  }
  return left.repoRoot === right.repoRoot && left.revision === right.revision && left.filePath === right.filePath;
}
