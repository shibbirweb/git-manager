import { describe, expect, it } from "vitest";
import type { FileDiff, PreviewSource } from "$lib/types";
import { absentText, compareSide, showsBinaryPreview, sideState } from "./binaryPreview";

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
    expect(
      sideState("modified", "Working Tree", worktree, { stat: { exists: false, size: 0, limit: null }, url: null }),
    ).toEqual({
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
    expect(sideState("original", "HEAD", head, { error: "Not allowed" })).toEqual({
      status: "error",
      text: "Not allowed",
    });
    const tooBig = sideState("original", "HEAD", head, {
      stat: { exists: true, size: 0, limit: 50 * 1024 * 1024 },
      url: null,
    });
    expect(tooBig).toEqual({ status: "error", text: "The file is larger than 50 MB, too big to preview." });
  });
});

describe("compareSide", () => {
  it("shows a ready file with its size, or says why there is none", () => {
    const ready = { status: "ready", url: "gmpreview://a.png", size: 2048 } as const;
    expect(compareSide(ready, "image", "HEAD")).toEqual({
      label: "HEAD",
      kind: "image",
      src: "gmpreview://a.png",
      info: "2 KB",
    });
    expect(compareSide({ status: "loading" }, "image", "HEAD")).toEqual({
      label: "HEAD",
      kind: "none",
      message: "Loading...",
    });
    expect(compareSide({ status: "absent", text: "Deleted" }, "pdf", "Working copy").message).toBe("Deleted");
    expect(compareSide(ready, null, "HEAD").message).toBe("This file cannot be shown.");
  });
});
