// Which files open in the image and PDF preview instead of the text editor, and the zoom
// of the image view. Keep the types in step with `preview_mime` in src-tauri/src/media.rs.

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

export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8] as const;

/** The next zoom step above (1) or below (-1) the current zoom, which may sit between steps. */
export function nextZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) {
    return ZOOM_STEPS.find((step) => step > current + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  }
  return [...ZOOM_STEPS].reverse().find((step) => step < current - 0.001) ?? ZOOM_STEPS[0];
}

/** The zoom that fits the whole image in the box; small images keep their real size. */
export function fitZoom(naturalWidth: number, naturalHeight: number, boxWidth: number, boxHeight: number): number {
  if (naturalWidth <= 0 || naturalHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return 1;
  }
  return Math.min(1, boxWidth / naturalWidth, boxHeight / naturalHeight);
}

export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
