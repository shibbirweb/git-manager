// Writes the search fixtures (search-*.txt) from the current app's own TypeScript, so NativeCore's ports are checked
// against it with the same inputs. Run from the repository root after changing fuzzy.ts or the search models:
//
//   bun --tsconfig-override swiftui/Palette/tsconfig.json \
//     swiftui/Tests/NativeCoreTests/Fixtures/make-search-fixtures.ts
//
// Each line is one case, tab-separated, at most 120 columns (longer cases are left out), 250 lines a file.

import { writeFileSync } from "node:fs";
import { buildCommandSpecs, commandLabel } from "$lib/commands/registry";
import { fuzzyMatch } from "$lib/commands/fuzzy";
import { menuSpec } from "$lib/menu/menuSpec";
import { matchingRecent } from "$lib/quickOpen/quickOpenModel";
import { pathRows } from "$lib/search/fileSearchModel";

const here = new URL(".", import.meta.url).pathname;
const MAX_COLUMNS = 120;
const PER_FILE = 250;

/** A small seeded generator, so the fixtures only change when the TypeScript does. */
let seed = 57;
function random(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}

function write(name: string, lines: string[]): void {
  const kept = lines.filter((line) => line.length <= MAX_COLUMNS);
  for (let part = 0; part * PER_FILE < kept.length; part++) {
    const chunk = kept.slice(part * PER_FILE, (part + 1) * PER_FILE);
    writeFileSync(`${here}${name}-${part + 1}.txt`, chunk.join("\n") + "\n");
  }
}

const labels = buildCommandSpecs(menuSpec("macos", "app")).map((spec) => commandLabel(spec.category, spec.title));
const extraTargets = [
  "src/cart.ts", "CartLine", "useDiscount", "README.md", "naïve café", "ΣΑΣ σας", "x_y-z.w",
];
const queries = [
  "gf", "git push", "push git", "sc", "settings", "fil", "cmt", "go to", "stash ch", "ter", "Cart", "cl",
  "show hist", "e", "zz", "NEW", "open rec", "brnch", "md", "c t", "é", "σας", "Find", "fif", "ws", "tg",
];
const fuzzyLines: string[] = [];
for (const query of queries) {
  for (const target of [...labels, ...extraTargets]) {
    if (random() > 0.12 && !extraTargets.includes(target)) {
      continue;
    }
    const match = fuzzyMatch(query, target);
    const result = match ? `${match.score}\t${match.indices.join(",")}` : "null";
    fuzzyLines.push(`${JSON.stringify(query)}\t${JSON.stringify(target)}\t${result}`);
  }
}
write("search-fuzzy", fuzzyLines);

const root = "/work/acme/storefront";
const files = ["src/cart.ts", "src/pricing.ts", "README.md", "docs/cart-api.md", "src/checkout.ts", "src/index.ts"];
const rows = pathRows(
  files.map((file) => `${root}/${file}`),
  [{ root, name: "storefront" }],
);
const recentLines: string[] = [];
for (const query of ["", "cart", "src", "c", "rd", "pr", "ts", "dca", "xyz", "s c"]) {
  const shown = matchingRecent(rows, query).map((row) => {
    const parts = [...row.folderParts, { text: "|", match: false }, ...row.nameParts];
    return parts.map((part) => (part.match ? `[${part.text}]` : part.text)).join("");
  });
  recentLines.push(`${JSON.stringify(query)}\t${shown.join(" ")}`);
}
write("search-recent", recentLines);
