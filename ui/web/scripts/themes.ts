// `bun run ui:themes`: every component's story in light and dark. It fails on a page error, and on text whose
// contrast with what is behind it falls under MIN_CONTRAST, which catches a color that does not follow the theme
// (dark text on a dark panel). Faint text such as hints is meant to be light, and the log's faint hashes on a
// selected (accent-tinted) row reach about 1.8 in the app itself, so the floor is low.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";
import { createServer } from "vite";

const MIN_CONTRAST = 1.5;
const webRoot = fileURLToPath(new URL("..", import.meta.url));
const components = readdirSync(`${webRoot}src/lib/components`)
  .filter((file) => file.endsWith(".svelte"))
  .map((file) => file.replace(/\.svelte$/, ""));
const only = process.argv.slice(2);

const server = await createServer({
  configFile: `${webRoot}vite.config.ts`,
  server: { port: 1432 },
  logLevel: "error",
});
await server.listen();
const base = server.resolvedUrls?.local[0] ?? "http://localhost:1432/";
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const problems: string[] = [];
let errors: string[] = [];
page.on("pageerror", (error) => errors.push(String(error)));

/** In the page: [text, contrast] for each element with its own text in the preview. */
function lowContrast(minimum: number): [string, number][] {
  // rgb(r, g, b[, a]) in 0..255, or color(srgb r g b[ / a]) in 0..1 (what color-mix() computes to).
  const parse = (color: string) => {
    const numbers = (color.match(/[\d.]+/g) ?? ["0", "0", "0", "0"]).map(Number);
    if (color.startsWith("color(")) {
      return [numbers[0] * 255, numbers[1] * 255, numbers[2] * 255, numbers[3] ?? 1];
    }
    return numbers;
  };
  const luminance = ([red, green, blue]: number[]) => {
    const channel = (value: number) => {
      const unit = value / 255;
      return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
  };
  const background = (element: Element | null): number[] => {
    for (let node = element; node; node = node.parentElement) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if ((color[3] ?? 1) > 0.5) {
        return color;
      }
    }
    return parse(getComputedStyle(document.body).backgroundColor);
  };
  const found: [string, number][] = [];
  for (const element of document.querySelectorAll(".preview *")) {
    const own = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent?.trim());
    const style = getComputedStyle(element);
    const skipped = element.tagName === "OPTION" || element.closest("[disabled]");
    if (!own || skipped || style.visibility === "hidden" || Number(style.opacity) < 0.6) {
      continue;
    }
    const front = luminance(parse(style.color));
    const back = luminance(background(element));
    const ratio = (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
    if (ratio < minimum) {
      const text = element.textContent?.trim().slice(0, 40) ?? "";
      let behind: Element | null = element;
      while (behind && (parse(getComputedStyle(behind).backgroundColor)[3] ?? 1) <= 0.5) {
        behind = behind.parentElement;
      }
      const owner = behind ? `${behind.tagName.toLowerCase()}.${behind.className}` : "body";
      const where = `${element.tagName.toLowerCase()} ${style.color} on ${background(element).join(", ")} of ${owner}`;
      found.push([`${text}" (${where})`, Math.round(ratio * 100) / 100]);
    }
  }
  return found;
}

try {
  for (const name of components.filter((entry) => !only.length || only.includes(entry))) {
    for (const theme of ["light", "dark"]) {
      errors = [];
      await page.goto(`${base}#${name}`);
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      await page.waitForTimeout(250);
      for (const error of errors) {
        problems.push(`${name} / ${theme}: page error ${error}`);
      }
      // A cold dev server can still be switching the theme: look again before reporting a problem.
      let low = await page.evaluate(lowContrast, MIN_CONTRAST);
      if (low.length) {
        await page.waitForTimeout(750);
        low = await page.evaluate(lowContrast, MIN_CONTRAST);
      }
      for (const [text, ratio] of low) {
        problems.push(`${name} / ${theme}: "${text} has contrast ${ratio}`);
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}

if (problems.length) {
  console.error(`${problems.length} problems:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`All ${components.length} components read well in light and dark.`);
