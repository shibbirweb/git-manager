import { describe, expect, it } from "vitest";
import {
  capText,
  normalizeAbsolutePath,
  optionalBoolean,
  optionalEnum,
  optionalInteger,
  optionalPath,
  requiredEnum,
  requiredInteger,
  requiredPath,
  requiredString,
  ToolArgError,
  toolArgs,
} from "./args";

describe("toolArgs", () => {
  it("treats anything but an object as no arguments", () => {
    expect(toolArgs({ a: 1 })).toEqual({ a: 1 });
    expect(toolArgs(null)).toEqual({});
    expect(toolArgs([1, 2])).toEqual({});
    expect(toolArgs("text")).toEqual({});
  });
});

describe("strings and numbers", () => {
  it("requires strings that are present and not empty", () => {
    expect(requiredString({ name: "x" }, "name")).toBe("x");
    expect(() => requiredString({}, "name")).toThrow(ToolArgError);
    expect(() => requiredString({ name: "" }, "name")).toThrow('"name" is required');
    expect(() => requiredString({ name: 3 }, "name")).toThrow("must be a string");
    expect(() => requiredString({ name: "abcd" }, "name", 3)).toThrow("longer than 3");
  });

  it("checks whole numbers and their range", () => {
    expect(optionalInteger({}, "line", 1, 10)).toBeNull();
    expect(optionalInteger({ line: null }, "line", 1, 10)).toBeNull();
    expect(optionalInteger({ line: 4 }, "line", 1, 10)).toBe(4);
    expect(() => optionalInteger({ line: 4.5 }, "line", 1, 10)).toThrow("whole number");
    expect(() => optionalInteger({ line: "4" }, "line", 1, 10)).toThrow("whole number");
    expect(() => optionalInteger({ line: 0 }, "line", 1, 10)).toThrow("between 1 and 10");
    expect(() => requiredInteger({}, "line", 1, 10)).toThrow('"line" is required');
  });

  it("checks booleans and choices", () => {
    expect(optionalBoolean({ visible: false }, "visible")).toBe(false);
    expect(() => optionalBoolean({ visible: "no" }, "visible")).toThrow("true or false");
    expect(optionalEnum({ mode: "split" }, "mode", ["editor", "split"] as const)).toBe("split");
    expect(optionalEnum({}, "mode", ["editor", "split"] as const)).toBeNull();
    expect(() => optionalEnum({ mode: "wide" }, "mode", ["editor", "split"] as const)).toThrow("one of: editor, split");
    expect(() => requiredEnum({}, "mode", ["editor"] as const)).toThrow('"mode" is required');
  });
});

describe("paths", () => {
  it("accepts clean absolute paths", () => {
    expect(normalizeAbsolutePath("/Users/me/project/", "filePath")).toBe("/Users/me/project");
    expect(normalizeAbsolutePath("/Users//me", "filePath")).toBe("/Users/me");
    expect(normalizeAbsolutePath("/", "filePath")).toBe("/");
    expect(requiredPath({ filePath: "/a/b.txt" }, "filePath")).toBe("/a/b.txt");
  });

  it("refuses relative paths and dot parts that could leave the workspace", () => {
    expect(() => normalizeAbsolutePath("relative/file", "filePath")).toThrow("absolute path");
    expect(() => normalizeAbsolutePath("/repo/../etc/passwd", "filePath")).toThrow('"." or ".."');
    expect(() => normalizeAbsolutePath("/repo/./file", "filePath")).toThrow('"." or ".."');
    expect(() => normalizeAbsolutePath("/repo/..", "filePath")).toThrow('"." or ".."');
    expect(() => normalizeAbsolutePath("C:\\repo", "filePath")).toThrow("absolute path");
    expect(() => normalizeAbsolutePath("/repo/\0x", "filePath")).toThrow("absolute path");
    // A name that only starts with dots is a normal file.
    expect(normalizeAbsolutePath("/repo/..hidden", "filePath")).toBe("/repo/..hidden");
  });

  it("treats a missing or empty optional path as none", () => {
    expect(optionalPath({}, "folderPath")).toBeNull();
    expect(optionalPath({ folderPath: "" }, "folderPath")).toBeNull();
  });
});

describe("capText", () => {
  it("cuts long text and says so", () => {
    expect(capText("hello", 10)).toEqual({ text: "hello", truncated: false });
    expect(capText("hello", 3)).toEqual({ text: "hel", truncated: true });
  });
});
