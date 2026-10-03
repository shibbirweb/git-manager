import { describe, expect, it } from "vitest";
import type { LfsStatus } from "$lib/types";
import { formatSize, lfsContentChanged, lfsFileSet, lfsSizeText, needsLfsInstall, validateLfsPattern } from "./lfsModel";

function status(overrides: Partial<LfsStatus>): LfsStatus {
  return { version: "git-lfs/3.5.1", used: true, patterns: ["*.psd"], files: ["art.psd"], stamp: "s", unchanged: false, ...overrides };
}

describe("lfsModel", () => {
  it("formats sizes", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(1023)).toBe("1023 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(2 * 1024 * 1024)).toBe("2 MB");
    expect(formatSize(150 * 1024 * 1024)).toBe("150 MB");
    expect(formatSize(-1)).toBe("");
  });

  it("describes an LFS diff", () => {
    const both = { originalSize: 1536, modifiedSize: 2097152, originalOid: "sha256:a", modifiedOid: "sha256:b" };
    expect(lfsSizeText(both)).toBe("1.5 KB -> 2 MB");
    expect(lfsSizeText({ ...both, originalSize: null, originalOid: null })).toBe("Added: 2 MB");
    expect(lfsSizeText({ ...both, modifiedSize: null, modifiedOid: null })).toBe("Deleted: 1.5 KB");
    expect(lfsSizeText({ ...both, originalSize: 10, modifiedSize: 10 })).toBe("Size: 10 B");
    expect(lfsContentChanged(both)).toBe(true);
    expect(lfsContentChanged({ ...both, modifiedOid: "sha256:a" })).toBe(false);
    expect(lfsContentChanged({ ...both, modifiedOid: null })).toBe(true);
  });

  it("checks patterns", () => {
    expect(validateLfsPattern("")).toBe("Enter a pattern, for example *.psd");
    expect(validateLfsPattern("--all")).toBe("A pattern cannot start with '-'");
    expect(validateLfsPattern("a b")).toBe("Use a pattern without spaces");
    expect(validateLfsPattern("assets/**/*.png")).toBeNull();
  });

  it("looks files up and tells when git-lfs is missing", () => {
    const installed = status({});
    expect(lfsFileSet(installed).has("art.psd")).toBe(true);
    expect(lfsFileSet(installed)).toBe(lfsFileSet(installed));
    expect(lfsFileSet(null).size).toBe(0);
    expect(needsLfsInstall(installed)).toBe(false);
    expect(needsLfsInstall(status({ version: null }))).toBe(true);
    expect(needsLfsInstall(status({ version: null, used: false }))).toBe(false);
    expect(needsLfsInstall(undefined)).toBe(false);
  });
});
