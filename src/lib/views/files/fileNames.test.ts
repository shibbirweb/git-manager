import { describe, expect, it } from "vitest";
import { nameBytes, nameProblem, renameSelection } from "./fileNames";
import cases from "./nameRules.cases.json";

interface NameCase {
  name: string;
  prefix?: string;
  repeat?: number;
}

function caseName(nameCase: NameCase): string {
  return `${nameCase.prefix ?? ""}${nameCase.name.repeat(nameCase.repeat ?? 1)}`;
}

/** Each code of the shared table as this dialog words it (the backend words some differently). */
function matchesCode(problem: string | null, code: string): boolean {
  switch (code) {
    case "ok":
      return problem === null;
    case "empty":
      return problem === "Enter a name";
    case "dot":
      return problem !== null && problem.endsWith("is not a valid name");
    case "slash":
      return problem === "A name cannot contain /";
    case "emptyPart":
      return problem === "Each part between slashes needs a name";
    case "nullChar":
      return problem === "A name cannot contain a null character";
    case "tooLong":
      return problem === "The name is too long";
    default:
      throw new Error(`unknown code ${code}`);
  }
}

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

describe("the shared rule table", () => {
  it("checks names as the backend does", () => {
    for (const nameCase of cases.names) {
      const problem = nameProblem(caseName(nameCase), { nested: nameCase.nested, taken: new Set(), folderLabel: "src" });
      expect(matchesCode(problem, nameCase.code), `${JSON.stringify(nameCase)}: ${problem}`).toBe(true);
    }
  });

  it("finds taken names, without case where the file system ignores it", () => {
    for (const takenCase of cases.taken) {
      const problem = nameProblem(takenCase.name, {
        nested: "nested" in takenCase ? (takenCase.nested ?? false) : false,
        taken: new Set(takenCase.taken),
        folderLabel: "src",
        current: "current" in takenCase ? takenCase.current : undefined,
        ignoreCase: takenCase.ignoreCase,
      });
      const expected = takenCase.code === "taken" && "takenName" in takenCase ? `${takenCase.takenName} already exists in src` : null;
      expect(problem, JSON.stringify(takenCase)).toBe(expected);
    }
  });

  it("counts bytes, not characters", () => {
    expect(nameBytes("abc")).toBe(3);
    expect(nameBytes("é")).toBe(2);
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
