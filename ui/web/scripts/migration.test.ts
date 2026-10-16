// The app's move onto the UI library only goes forward: a file listed in ui/web/migrated.json has no CSS, raw
// elements, inline styles or classes of its own and stays within 300 lines (scripts/migration.ts).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parityCases } from "../src/parity/cases";
import { appDebts, debtOf, migratedFiles, repoPath, score } from "./migration";

describe("migration", () => {
  it("counts what a file still owns", () => {
    const source =
      '<script>let a = 1;</script>\n<div class="x" style="top: 0">\n  <Text>Hi</Text>\n</div>\n' +
      "<style>\n  .x {\n    color: red;\n  }\n</style>\n";
    const debt = debtOf("Example.svelte", source);
    expect([debt.styleLines, debt.elements, debt.inlineStyles, debt.classes]).toEqual([3, 1, 1, 1]);
    expect(score(debtOf("Done.svelte", "<Stack><Text>Hi</Text></Stack>\n"))).toBe(0);
  });

  it("keeps every migrated file at zero", () => {
    const migrated = new Set(migratedFiles());
    const regressed = appDebts().filter((debt) => migrated.has(debt.file) && score(debt) > 0);
    expect(regressed.map((debt) => debt.file)).toEqual([]);
  });

  it("names files with / on every platform, as migrated.json does", () => {
    expect(appDebts().every((debt) => !debt.file.includes("\\"))).toBe(true);
    expect(repoPath(join(__dirname, "../../..", "src", "lib", "App.svelte"))).toBe("src/lib/App.svelte");
  });

  it("lists only files that exist", () => {
    const known = new Set(appDebts().map((debt) => debt.file));
    expect(migratedFiles().filter((file) => !known.has(file))).toEqual([]);
  });

  // A migrated file draws with the library, so it has no CSS of its own left for parity to compare.
  it("compares parity only against app files that still have their own CSS", () => {
    const migrated = new Set(migratedFiles());
    const repoRoot = join(__dirname, "../../..");
    const stale = parityCases.flatMap((parityCase) =>
      parityCase.sources
        .filter((source) => migrated.has(source) || !existsSync(join(repoRoot, source)))
        .map((source) => `${parityCase.id}: ${source}`),
    );
    expect(stale).toEqual([]);
  });
});
