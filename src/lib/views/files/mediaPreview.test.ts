import { describe, expect, it } from "vitest";
import { previewOf, tooLargeText } from "./mediaPreview";

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

describe("tooLargeText", () => {
  it("names the limit in megabytes", () => {
    expect(tooLargeText(50 * 1024 * 1024)).toBe("The file is larger than 50 MB, too big to preview.");
  });
});
