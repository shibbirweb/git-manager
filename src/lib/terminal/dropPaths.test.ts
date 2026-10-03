import { describe, expect, it } from "vitest";
import { dropText, shellQuote } from "./dropPaths";

describe("shellQuote", () => {
  it("leaves plain paths as they are", () => {
    expect(shellQuote("/Users/me/shop/src/cart.ts", "posix")).toBe("/Users/me/shop/src/cart.ts");
    expect(shellQuote("/tmp/a-b_c@1.2+x", "posix")).toBe("/tmp/a-b_c@1.2+x");
  });

  it("single-quotes paths with spaces and shell characters", () => {
    expect(shellQuote("/Users/me/My Files/a.txt", "posix")).toBe("'/Users/me/My Files/a.txt'");
    expect(shellQuote("/tmp/$HOME & (x)", "posix")).toBe("'/tmp/$HOME & (x)'");
    expect(shellQuote("/tmp/it's", "posix")).toBe("'/tmp/it'\\''s'");
  });

  it("double-quotes for Windows shells", () => {
    expect(shellQuote("C:\\Users\\me\\a.txt", "windows")).toBe("C:\\Users\\me\\a.txt");
    expect(shellQuote("C:\\Program Files\\x", "windows")).toBe('"C:\\Program Files\\x"');
  });
});

describe("dropText", () => {
  it("joins the quoted paths and ends with a space", () => {
    expect(dropText(["/a/b.txt", "/c d/e.txt"], "posix")).toBe("/a/b.txt '/c d/e.txt' ");
  });

  it("types nothing for no usable paths", () => {
    expect(dropText([], "posix")).toBe("");
    expect(dropText(["", "/a\0b"], "posix")).toBe("");
  });
});
