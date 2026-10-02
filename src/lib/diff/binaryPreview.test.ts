import { describe, expect, it } from "vitest";
import type { FileDiff, PreviewSource } from "$lib/types";
import { absentText, sharedFit, showsBinaryPreview, sideInfo, sideState, syncedScroll } from "./binaryPreview";

function diffOf(overrides: Partial<FileDiff>): FileDiff {
  return {
    path: "assets/logo.png",
    original: "",
    modified: "",
    originalEol: "lf",
    modifiedEol: "lf",
    binary: true,
    tooLarge: false,
    lfs: null,
    ...overrides,
  };
}

const head: PreviewSource = { kind: "revision", repoRoot: "/shop", revision: "HEAD", filePath: "assets/logo.png" };
const worktree: PreviewSource = { kind: "worktree", filePath: "/shop/assets/logo.png" };
const sides = { original: head, modified: worktree };

describe("showsBinaryPreview", () => {
  it("shows binary and too large images and PDFs that have sides", () => {
    expect(showsBinaryPreview(diffOf({}), "assets/logo.png", sides)).toBe(true);
    expect(showsBinaryPreview(diffOf({ binary: false, tooLarge: true }), "docs/manual.PDF", sides)).toBe(true);
  });

  it("keeps the old message for other files, text, LFS pointers and diffs without sides", () => {
    expect(showsBinaryPreview(diffOf({}), "build/app.wasm", sides)).toBe(false);
    expect(showsBinaryPreview(diffOf({}), "assets/icon.svg", sides)).toBe(false);
    expect(showsBinaryPreview(diffOf({ binary: false }), "assets/logo.png", sides)).toBe(false);
    const lfs = { originalSize: 1, modifiedSize: 2, originalOid: "a", modifiedOid: "b" };
    expect(showsBinaryPreview(diffOf({ lfs }), "assets/logo.png", sides)).toBe(false);
    expect(showsBinaryPreview(diffOf({}), "assets/logo.png", null)).toBe(false);
  });
});

describe("sideState", () => {
  const stat = { exists: true, size: 2048, limit: null };

  it("says what a missing side is", () => {
    expect(absentText("original", "HEAD")).toBe("Not in HEAD");
    expect(absentText("modified", "Working Tree")).toBe("Deleted");
    expect(sideState("original", "Parent", null, null)).toEqual({ status: "absent", text: "Not in Parent" });
    expect(sideState("original", "Index", head, { stat: { exists: false, size: 0, limit: null }, url: null })).toEqual({
      status: "absent",
      text: "Not in Index",
    });
    expect(sideState("modified", "Working Tree", worktree, { stat: { exists: false, size: 0, limit: null }, url: null })).toEqual({
      status: "absent",
      text: "Deleted",
    });
  });

  it("loads, shows or explains", () => {
    expect(sideState("original", "HEAD", head, null)).toEqual({ status: "loading" });
    expect(sideState("original", "HEAD", head, { stat, url: "gmpreview://localhost/x" })).toEqual({
      status: "ready",
      url: "gmpreview://localhost/x",
      size: 2048,
    });
    expect(sideState("original", "HEAD", head, { error: "Not allowed" })).toEqual({ status: "error", text: "Not allowed" });
    const tooBig = sideState("original", "HEAD", head, { stat: { exists: true, size: 0, limit: 50 * 1024 * 1024 }, url: null });
    expect(tooBig).toEqual({ status: "error", text: "The file is larger than 50 MB, too big to preview." });
  });
});

describe("sideInfo", () => {
  it("joins the pixel size and the file size", () => {
    expect(sideInfo({ width: 640, height: 480 }, 2048)).toBe("640 x 480 px, 2 KB");
    expect(sideInfo(null, 2048)).toBe("2 KB");
    expect(sideInfo({ width: 1, height: 1 }, 0)).toBe("1 x 1 px");
    expect(sideInfo(null, 0)).toBe("");
  });
});

describe("sharedFit", () => {
  it("fits both images at one scale", () => {
    expect(sharedFit([{ width: 200, height: 100 }, { width: 400, height: 100 }], 200, 200)).toBe(0.5);
    expect(sharedFit([{ width: 50, height: 50 }, null], 200, 200)).toBe(1);
    expect(sharedFit([null, null], 200, 200)).toBe(1);
  });
});

describe("syncedScroll", () => {
  const box = (scrollLeft: number, scrollTop: number, scrollWidth: number, scrollHeight: number) => ({
    scrollLeft,
    scrollTop,
    scrollWidth,
    scrollHeight,
    clientWidth: 100,
    clientHeight: 100,
  });

  it("keeps the same place in proportion to each side's range", () => {
    expect(syncedScroll(box(50, 100, 200, 300), box(0, 0, 300, 500))).toEqual({ left: 100, top: 200 });
    expect(syncedScroll(box(50, 50, 200, 200), box(10, 10, 200, 200))).toEqual({ left: 50, top: 50 });
  });

  it("stays at the start when a side does not scroll", () => {
    expect(syncedScroll(box(0, 0, 100, 100), box(30, 30, 300, 300))).toEqual({ left: 0, top: 0 });
    expect(syncedScroll(box(50, 50, 200, 200), box(0, 0, 80, 80))).toEqual({ left: 0, top: 0 });
  });
});
