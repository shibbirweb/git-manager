import { describe, expect, it } from "vitest";
import { fitZoom, nextZoom, previewOf, ZOOM_STEPS, zoomLabel } from "./mediaPreview";

describe("previewOf", () => {
  it("opens images and PDFs in the preview, whatever the case of the extension", () => {
    expect(previewOf("/work/shop/assets/logo.PNG")).toEqual({ kind: "image", mime: "image/png" });
    expect(previewOf("/work/shop/photo.jpeg")).toEqual({ kind: "image", mime: "image/jpeg" });
    expect(previewOf("/work/shop/favicon.ico")).toEqual({ kind: "image", mime: "image/x-icon" });
    expect(previewOf("/work/shop/docs/manual.pdf")).toEqual({ kind: "pdf", mime: "application/pdf" });
  });

  it("leaves text, SVG and dot files to the editor", () => {
    expect(previewOf("/work/shop/icon.svg")).toBeNull();
    expect(previewOf("/work/shop/src/cart.ts")).toBeNull();
    expect(previewOf("/work/shop/Makefile")).toBeNull();
    expect(previewOf("/work/shop/.png")).toBeNull();
    expect(previewOf("/work/shop.pdf/readme")).toBeNull();
  });
});

describe("nextZoom", () => {
  it("steps up and down through the zoom steps", () => {
    expect(nextZoom(1, 1)).toBe(1.5);
    expect(nextZoom(1, -1)).toBe(0.75);
  });

  it("moves from a fitted zoom between steps to the nearest step", () => {
    expect(nextZoom(0.62, 1)).toBe(0.75);
    expect(nextZoom(0.62, -1)).toBe(0.5);
  });

  it("stops at the smallest and biggest step", () => {
    expect(nextZoom(ZOOM_STEPS[ZOOM_STEPS.length - 1], 1)).toBe(8);
    expect(nextZoom(ZOOM_STEPS[0], -1)).toBe(0.1);
  });
});

describe("fitZoom", () => {
  it("shrinks a big image to fit the box", () => {
    expect(fitZoom(2000, 1000, 1000, 1000)).toBe(0.5);
    expect(fitZoom(1000, 2000, 1000, 500)).toBe(0.25);
  });

  it("keeps small images at their real size and survives unknown sizes", () => {
    expect(fitZoom(100, 50, 1000, 1000)).toBe(1);
    expect(fitZoom(0, 0, 1000, 1000)).toBe(1);
    expect(fitZoom(100, 100, 0, 0)).toBe(1);
  });
});

describe("zoomLabel", () => {
  it("shows a whole percentage", () => {
    expect(zoomLabel(1)).toBe("100%");
    expect(zoomLabel(0.333)).toBe("33%");
  });
});
