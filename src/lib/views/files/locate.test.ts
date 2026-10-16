import { describe, expect, it } from "vitest";
import { foldersToOpen } from "./locate";

describe("foldersToOpen", () => {
  it("lists the workspace folder and every folder down to the file", () => {
    expect(foldersToOpen("/work/shop", "/work/shop/src/cart/total.ts")).toEqual([
      "/work/shop",
      "/work/shop/src",
      "/work/shop/src/cart",
    ]);
  });

  it("needs only the workspace folder for a file at its top", () => {
    expect(foldersToOpen("/work/shop", "/work/shop/README.md")).toEqual(["/work/shop"]);
  });

  it("is empty for the folder itself and for files outside it", () => {
    expect(foldersToOpen("/work/shop", "/work/shop")).toEqual([]);
    expect(foldersToOpen("/work/shop", "/work/shopping/a.ts")).toEqual([]);
    expect(foldersToOpen("/work/shop", "/elsewhere/a.ts")).toEqual([]);
  });

  it("handles a folder at the file system root", () => {
    expect(foldersToOpen("/", "/etc/hosts")).toEqual(["/", "/etc"]);
  });
});
