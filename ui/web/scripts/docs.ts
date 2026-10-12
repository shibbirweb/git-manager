// Writes ui/web/COMPONENTS.md, docs/groups/<Group>.md and docs/components/<Name>.md from src/lib/docs
// (`bun run ui:docs`), or with --check fails when one is out of date. These are the pages AI agents read to use
// each component and its props.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { docOutputs } from "../src/lib/docs/outputs";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const check = process.argv.includes("--check");
const outputs = docOutputs();
const stale: string[] = [];

for (const output of outputs) {
  const target = join(webRoot, output.path);
  if (existsSync(target) && readFileSync(target, "utf8") === output.content) {
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

// A page whose component was removed is reported, never deleted: the user removes files.
const expected = new Set(outputs.map((output) => output.path));
const extra = ["docs/components", "docs/groups"].flatMap((folder) =>
  existsSync(join(webRoot, folder))
    ? readdirSync(join(webRoot, folder)).map((file) => `${folder}/${file}`).filter((path) => !expected.has(path))
    : [],
);
if (extra.length) {
  console.error(`No component for:\n${extra.join("\n")}`);
}

if (stale.length || (check && extra.length)) {
  console.error(stale.length ? `Out of date, run bun run ui:docs:\n${stale.join("\n")}` : "");
  process.exit(1);
}
