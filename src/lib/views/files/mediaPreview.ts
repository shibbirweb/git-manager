// Which files open in the image and PDF preview instead of the text editor (the zoom is the UI
// library's, logic/zoom.ts). Keep the types in step with `preview_mime` in src-tauri/src/media.rs.

export type PreviewKind = "image" | "pdf";

export interface PreviewInfo {
  kind: PreviewKind;
  mime: string;
}

const PREVIEW_TYPES: Record<string, PreviewInfo> = {
  png: { kind: "image", mime: "image/png" },
  jpg: { kind: "image", mime: "image/jpeg" },
  jpeg: { kind: "image", mime: "image/jpeg" },
  gif: { kind: "image", mime: "image/gif" },
  webp: { kind: "image", mime: "image/webp" },
  bmp: { kind: "image", mime: "image/bmp" },
  ico: { kind: "image", mime: "image/x-icon" },
  avif: { kind: "image", mime: "image/avif" },
  pdf: { kind: "pdf", mime: "application/pdf" },
};

/** The preview for a file, by extension; null for files the text editor opens (SVG included). */
export function previewOf(filePath: string): PreviewInfo | null {
  const name = filePath.slice(filePath.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  return PREVIEW_TYPES[name.slice(dot + 1).toLowerCase()] ?? null;
}

/** The message for a file over its preview limit (in bytes). */
export function tooLargeText(limit: number): string {
  return `The file is larger than ${Math.round(limit / 1024 / 1024)} MB, too big to preview.`;
}
