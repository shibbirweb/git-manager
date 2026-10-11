// `bun run ui:parity`: checks that each library component looks exactly like the app's own UI. For every case in
// src/parity/cases, in light and dark, it reads the computed styles of the app's markup (styled by the app's own
// CSS) and of the library component, at rest and on hover or focus, and fails on any difference. Side-by-side
// screenshots go to ui/web/.parity/ (not committed) for a look.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { webkit, type Page } from "playwright";
import { createServer } from "vite";
import { parityCases } from "../src/parity/cases";
import { PROPERTIES, type ParityPair, type ParityState } from "../src/parity/types";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const reportDir = `${webRoot}.parity`;
const only = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
mkdirSync(reportDir, { recursive: true });

const server = await createServer({
  configFile: `${webRoot}vite.config.ts`,
  server: { port: 1431, strictPort: false },
  logLevel: "error",
});
await server.listen();
const base = server.resolvedUrls?.local[0] ?? "http://localhost:1431/";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const failures: string[] = [];
const appBugs: string[] = [];
let compared = 0;

async function read(target: Page, selector: string, pseudo: string | undefined): Promise<Record<string, string>> {
  return target.evaluate(
    ({ selector: query, pseudo: part, properties }) => {
      const element = document.querySelector(query);
      if (!element) {
        return { missing: query };
      }
      const style = getComputedStyle(element, part ?? null);
      return Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)]));
    },
    { selector, pseudo, properties: [...PROPERTIES] },
  );
}

/** Puts the element in `state`; false when it cannot (for example it has no size to hover). */
async function enter(selector: string, state: ParityState | "rest"): Promise<boolean> {
  await page.mouse.move(1270, 890);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  try {
    if (state === "hover") {
      await page.hover(selector, { timeout: 3000 });
    } else if (state === "focus") {
      await page.focus(selector, { timeout: 3000 });
    }
  } catch {
    return false;
  }
  await page.waitForTimeout(220);
  return true;
}

async function comparePair(caseId: string, theme: string, pair: ParityPair): Promise<void> {
  for (const state of ["rest", ...(pair.states ?? [])] as const) {
    const ref = `#reference ${pair.ref}`;
    const lib = `#library ${pair.lib}`;
    const label = `${caseId} / ${pair.name}${pair.pseudo ?? ""} / ${theme} / ${state}`;
    const refEntered = await enter(ref, state);
    const app = await read(page, ref, pair.pseudo);
    const libEntered = await enter(lib, state);
    const library = await read(page, lib, pair.pseudo);
    if (!refEntered || !libEntered) {
      failures.push(`${label}: could not ${state} the ${refEntered ? "library" : "app"} element`);
      continue;
    }
    if ("missing" in app || "missing" in library) {
      failures.push(`${label}: no element ${app.missing ?? library.missing}`);
      continue;
    }
    for (const property of PROPERTIES) {
      compared++;
      if (pair.ignore?.[property] || app[property] === library[property]) {
        continue;
      }
      const bug = pair.appBugs?.[`${state}:${property}`];
      if (bug) {
        appBugs.push(`${label}: ${property} app "${app[property]}" library "${library[property]}" (${bug})`);
        continue;
      }
      failures.push(`${label}: ${property} app "${app[property]}" library "${library[property]}"`);
    }
  }
}

try {
  for (const parityCase of parityCases.filter((entry) => !only.length || only.includes(entry.id))) {
    for (const theme of ["light", "dark"]) {
      await page.goto(`${base}parity.html?case=${parityCase.id}&theme=${theme}`);
      await page.waitForSelector("[data-ready]");
      await page.screenshot({ path: `${reportDir}/${parityCase.id}-${theme}.png` });
      for (const pair of parityCase.pairs) {
        await comparePair(parityCase.id, theme, pair);
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`Compared ${compared} values; screenshots in ui/web/.parity/`);
if (appBugs.length) {
  console.log(`${appBugs.length} known app bugs (the library is right):\n${appBugs.join("\n")}`);
}
if (failures.length) {
  console.error(`${failures.length} differences:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("Every library component matches the app.");
