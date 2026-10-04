#!/usr/bin/env bun
/**
 * Writes the two file icon sets (Settings > Appearance > File icons) into static/file-icons, one
 * folder each, so the app fetches a set only while it is chosen and has none of it in its code:
 *
 * - minimal/: map.json, minimal.css and one SVG per glyph, from src/lib/fileIcons/minimalSource.ts.
 * - material/: map.json and the SVGs that a file extension or file name uses, copied from the
 *   material-icon-theme package (MIT, a dev dependency), with its LICENSE.
 *
 * Both are committed, so a build needs nothing from node_modules. Run this again after changing
 * minimalSource.ts or updating the package.
 *
 *     bun scripts/file-icons.ts           regenerate
 *     bun scripts/file-icons.ts --check   fail when the committed files are out of date
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { minimalFiles } from "../src/lib/fileIcons/minimalSource";

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = join(PROJECT, "node_modules/material-icon-theme");
const OUT_DIR = join(PROJECT, "static/file-icons");

interface Manifest {
  file: string;
  iconDefinitions: Record<string, { iconPath: string }>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  light?: { fileExtensions?: Record<string, string>; fileNames?: Record<string, string> };
}

function lowerKeys(entries: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(entries ?? {}).map(([key, icon]) => [key.toLowerCase(), icon]));
}

function materialFiles(): Record<string, string> {
  const manifest = JSON.parse(readFileSync(join(PACKAGE, "dist/material-icons.json"), "utf8")) as Manifest;
  const version = (JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8")) as { version: string }).version;
  const map = {
    source: `material-icon-theme ${version}`,
    file: manifest.file,
    extensions: lowerKeys(manifest.fileExtensions),
    names: lowerKeys(manifest.fileNames),
    lightExtensions: lowerKeys(manifest.light?.fileExtensions),
    lightNames: lowerKeys(manifest.light?.fileNames),
  };
  const used = new Set([
    map.file,
    ...Object.values(map.extensions),
    ...Object.values(map.names),
    ...Object.values(map.lightExtensions),
    ...Object.values(map.lightNames),
  ]);
  const files: Record<string, string> = {
    "map.json": `${JSON.stringify(map)}\n`,
    LICENSE: readFileSync(join(PACKAGE, "LICENSE"), "utf8"),
  };
  for (const icon of used) {
    const definition = manifest.iconDefinitions[icon];
    if (!definition) {
      throw new Error(`no icon definition for ${icon}`);
    }
    files[`${icon}.svg`] = readFileSync(join(PACKAGE, "dist", definition.iconPath), "utf8");
  }
  return files;
}

const sets: Record<string, Record<string, string>> = { minimal: minimalFiles(), material: materialFiles() };

if (process.argv.includes("--check")) {
  const stale: string[] = [];
  for (const [set, files] of Object.entries(sets)) {
    const dir = join(OUT_DIR, set);
    const present = existsSync(dir) ? readdirSync(dir).sort() : [];
    const same =
      present.join("\n") === Object.keys(files).sort().join("\n") &&
      Object.entries(files).every(([name, text]) => readFileSync(join(dir, name), "utf8") === text);
    if (!same) {
      stale.push(`static/file-icons/${set}`);
    }
  }
  if (stale.length > 0) {
    console.error(`Out of date: ${stale.join(", ")}. Run bun scripts/file-icons.ts`);
    process.exit(1);
  }
  console.log("File icons are up to date.");
  process.exit(0);
}

rmSync(OUT_DIR, { recursive: true, force: true });
for (const [set, files] of Object.entries(sets)) {
  const dir = join(OUT_DIR, set);
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(dir, name), text);
  }
  console.log(`static/file-icons/${set}: ${Object.keys(files).length} files`);
}
