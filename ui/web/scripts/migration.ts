// The app's move onto the UI library, as numbers that must reach zero: for every app .svelte file, the lines of
// its own CSS, its raw HTML elements, inline styles and class attributes, lines over 120 columns, and whether it is
// over 300 lines. A
// migrated file is listed in ui/web/migrated.json; `--check` fails when one of those gains anything back.
//   bun run ui:migration            the table, worst first, and the totals
//   bun run ui:migration --check    only fail when a migrated file regressed (CI, tests)
//   bun run ui:migration --update   add every file now at zero to migrated.json
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const MAX_LINES = 300;
const MAX_COLUMNS = 120;

export interface FileDebt {
  file: string;
  lines: number;
  styleLines: number;
  elements: number;
  inlineStyles: number;
  classes: number;
  wideLines: number;
  tooLong: boolean;
}

function svelteFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      svelteFiles(path, out);
    } else if (path.endsWith(".svelte")) {
      out.push(path);
    }
  }
  return out;
}

/** What one .svelte source still owns instead of taking from the library. */
export function debtOf(file: string, source: string): FileDebt {
  const styles = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1] ?? "");
  const styleLines = styles.reduce((sum, css) => sum + css.split("\n").filter((line) => line.trim()).length, 0);
  const markup = source
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const lines = source.split("\n").length;
  return {
    file,
    lines,
    styleLines,
    elements: [...markup.matchAll(/<([a-z][a-z0-9-]*)[\s>/]/g)].length,
    inlineStyles: [...markup.matchAll(/\sstyle(:[a-z-]+)?=/g)].length,
    classes: [...markup.matchAll(/\sclass(:[\w-]+)?=/g)].length,
    wideLines: source.split("\n").filter((line) => line.length > MAX_COLUMNS).length,
    tooLong: lines > MAX_LINES,
  };
}

export function score(debt: FileDebt): number {
  const owned = debt.styleLines + debt.elements + debt.inlineStyles + debt.classes;
  return owned + debt.wideLines + (debt.tooLong ? 1 : 0);
}

/** A file's repo-relative path with `/` on every platform, as migrated.json lists it (Windows paths use `\`). */
export function repoPath(path: string): string {
  return relative(repoRoot, path).split(sep).join("/");
}

export function appDebts(): FileDebt[] {
  return svelteFiles(join(repoRoot, "src")).map((path) => debtOf(repoPath(path), readFileSync(path, "utf8")));
}

const MIGRATED_PATH = join(repoRoot, "ui/web/migrated.json");

export function migratedFiles(): string[] {
  return JSON.parse(readFileSync(MIGRATED_PATH, "utf8")) as string[];
}

function main(): void {
  const debts = appDebts();
  const migrated = new Set(migratedFiles());
  const regressed = debts.filter((debt) => migrated.has(debt.file) && score(debt) > 0);
  if (process.argv.includes("--update")) {
    const zero = debts.filter((debt) => score(debt) === 0).map((debt) => debt.file);
    const files = [...new Set([...migrated, ...zero])].sort();
    writeFileSync(MIGRATED_PATH, `${JSON.stringify(files, null, 2)}\n`);
  }
  if (!process.argv.includes("--check")) {
    const rows = [...debts].sort((left, right) => score(right) - score(left));
    console.log("score  css  elements  inline  classes  wide  lines  file");
    for (const debt of rows.filter((row) => score(row) > 0)) {
      const cells = [score(debt), debt.styleLines, debt.elements, debt.inlineStyles, debt.classes, debt.wideLines];
      cells.push(debt.lines);
      const widths = [5, 4, 8, 6, 7, 4, 5];
      console.log(`${cells.map((cell, index) => String(cell).padStart(widths[index] ?? 5)).join("  ")}  ${debt.file}`);
    }
    const done = debts.filter((debt) => score(debt) === 0).length;
    const total = debts.reduce((sum, debt) => sum + score(debt), 0);
    console.log(
      `\n${done} of ${debts.length} files done; ${total} left (css lines + elements + inline styles + ` +
        `classes + lines over ${MAX_COLUMNS} columns + files over ${MAX_LINES} lines).`,
    );
  }
  for (const debt of regressed) {
    console.error(`migrated file regressed: ${debt.file} (score ${score(debt)})`);
  }
  if (regressed.length > 0) {
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
