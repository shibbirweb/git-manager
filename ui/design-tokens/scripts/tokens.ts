// Writes every platform's design tokens from ui/design-tokens (`bun run ui:tokens`), or with --check
// fails when a generated file is out of date.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenOutputs } from "../build/outputs";

const uiRoot = fileURLToPath(new URL("../..", import.meta.url));
const check = process.argv.includes("--check");
const stale: string[] = [];

for (const output of tokenOutputs()) {
  const target = join(uiRoot, output.path);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (current === output.content) {
    continue;
  }
  if (check) {
    stale.push(output.path);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, output.content);
    console.log(`wrote ${output.path}`);
  }
}

if (stale.length) {
  console.error(`Out of date, run bun run ui:tokens:\n${stale.join("\n")}`);
  process.exit(1);
}
