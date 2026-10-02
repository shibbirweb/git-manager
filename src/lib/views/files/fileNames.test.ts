import { describe, expect, it } from "vitest";
import { nameProblem, renameSelection } from "./fileNames";

const taken = new Set(["cart.ts", "lib"]);

describe("nameProblem", () => {
  const create = { nested: true, taken, folderLabel: "src" };
  const rename = { nested: false, taken, folderLabel: "src", current: "cart.ts" };

  it("accepts plain and nested new names", () => {
    expect(nameProblem("pricing.ts", create)).toBeNull();
    expect(nameProblem("lib/money.ts", create)).toBeNull();
    expect(nameProblem("  spaced.ts ", create)).toBeNull();
  });

  it("explains empty, dot and slash problems", () => {
    expect(nameProblem("   ", create)).toBe("Enter a name");
    expect(nameProblem("..", create)).toBe('".." is not a valid name');
    expect(nameProblem("lib/./x.ts", create)).toBe('"." is not a valid name');
    expect(nameProblem("lib//x.ts", create)).toBe("Each part between slashes needs a name");
    expect(nameProblem("/x.ts", create)).toBe("Each part between slashes needs a name");
    expect(nameProblem("a/b.ts", rename)).toBe("A name cannot contain /");
    expect(nameProblem("bad\0name", create)).toBe("A name cannot contain a null character");
    expect(nameProblem("x".repeat(256), create)).toBe("The name is too long");
  });

  it("refuses a name the folder already has, but not the current one or a case change", () => {
    expect(nameProblem("cart.ts", create)).toBe("cart.ts already exists in src");
    expect(nameProblem("lib", create)).toBe("lib already exists in src");
    expect(nameProblem("cart.ts", rename)).toBeNull();
    expect(nameProblem("Cart.ts", rename)).toBeNull();
    expect(nameProblem("lib", rename)).toBe("lib already exists in src");
  });
});

describe("renameSelection", () => {
  it("selects the name without its extension", () => {
    expect(renameSelection("cart.ts", false)).toEqual([0, 4]);
    expect(renameSelection("archive.tar.gz", false)).toEqual([0, 11]);
  });

  it("selects the whole name of folders, dot files and names without a dot", () => {
    expect(renameSelection("src.old", true)).toEqual([0, 7]);
    expect(renameSelection(".gitignore", false)).toEqual([0, 10]);
    expect(renameSelection("Makefile", false)).toEqual([0, 8]);
  });
});
