// The Minimal file icons, as source: glyph shapes, colors and the file type map. Build-time only:
// scripts/file-icons.ts turns this into static/file-icons/minimal (map.json, minimal.css and one
// SVG per glyph), which the app fetches only while File icons is Minimal. The app never imports
// this module, so none of it is in the app's code.
import type { IconMap } from "./iconMatch";

export const FILE_ICON_GLYPHS = [
  "file",
  "code",
  "json",
  "text",
  "markdown",
  "image",
  "terminal",
  "config",
  "style",
  "lock",
  "key",
  "archive",
  "video",
  "audio",
  "font",
  "database",
  "git",
] as const;

export type FileIconGlyph = (typeof FILE_ICON_GLYPHS)[number];

/** Each tone is a color token from src/app.css, so the icons follow the theme. */
export const FILE_ICON_TONES = {
  gray: "--text-dim",
  blue: "--term-blue",
  cyan: "--term-cyan",
  green: "--success",
  yellow: "--term-yellow",
  orange: "--warning",
  red: "--danger",
  purple: "--term-magenta",
  accent: "--accent",
} as const;

export type FileIconTone = keyof typeof FILE_ICON_TONES;

type Rule = [FileIconGlyph, FileIconTone];

const PLAIN: Rule = ["file", "gray"];

// Whole file names (lowercase) win over the extension.
const NAMES: Record<string, Rule> = {
  dockerfile: ["config", "cyan"],
  "docker-compose.yml": ["config", "cyan"],
  "docker-compose.yaml": ["config", "cyan"],
  "compose.yml": ["config", "cyan"],
  "compose.yaml": ["config", "cyan"],
  makefile: ["config", "gray"],
  "cargo.toml": ["config", "orange"],
  "package.json": ["json", "green"],
  "tsconfig.json": ["config", "blue"],
  "jsconfig.json": ["config", "yellow"],
  license: ["text", "yellow"],
  "license.md": ["text", "yellow"],
  "license.txt": ["text", "yellow"],
  licence: ["text", "yellow"],
  "readme.md": ["markdown", "accent"],
  "changelog.md": ["markdown", "green"],
  ".gitignore": ["git", "red"],
  ".gitattributes": ["git", "red"],
  ".gitmodules": ["git", "red"],
  ".gitkeep": ["git", "red"],
  ".mailmap": ["git", "red"],
  ".editorconfig": ["config", "gray"],
  ".prettierrc": ["config", "gray"],
  ".eslintrc": ["config", "purple"],
  ".npmrc": ["config", "red"],
  ".nvmrc": ["config", "green"],
  ".env": ["key", "yellow"],
  ".env.local": ["key", "yellow"],
  ".env.example": ["key", "yellow"],
  ".env.development": ["key", "yellow"],
  ".env.production": ["key", "yellow"],
  ".env.test": ["key", "yellow"],
  ".bashrc": ["terminal", "green"],
  ".zshrc": ["terminal", "green"],
  ".profile": ["terminal", "green"],
  "package-lock.json": ["lock", "gray"],
  "bun.lock": ["lock", "gray"],
  "bun.lockb": ["lock", "gray"],
  "yarn.lock": ["lock", "gray"],
  "pnpm-lock.yaml": ["lock", "gray"],
  "cargo.lock": ["lock", "gray"],
  "composer.lock": ["lock", "gray"],
  "gemfile.lock": ["lock", "gray"],
  "poetry.lock": ["lock", "gray"],
};

const EXTENSIONS: Record<string, Rule> = {
  ts: ["code", "blue"],
  tsx: ["code", "blue"],
  mts: ["code", "blue"],
  cts: ["code", "blue"],
  js: ["code", "yellow"],
  jsx: ["code", "yellow"],
  mjs: ["code", "yellow"],
  cjs: ["code", "yellow"],
  rs: ["code", "orange"],
  py: ["code", "blue"],
  go: ["code", "cyan"],
  java: ["code", "red"],
  kt: ["code", "purple"],
  kts: ["code", "purple"],
  scala: ["code", "red"],
  c: ["code", "blue"],
  h: ["code", "purple"],
  cc: ["code", "blue"],
  cpp: ["code", "blue"],
  cxx: ["code", "blue"],
  hpp: ["code", "purple"],
  cs: ["code", "purple"],
  php: ["code", "purple"],
  rb: ["code", "red"],
  swift: ["code", "orange"],
  dart: ["code", "cyan"],
  lua: ["code", "blue"],
  svelte: ["code", "orange"],
  vue: ["code", "green"],
  html: ["code", "orange"],
  htm: ["code", "orange"],
  xml: ["code", "orange"],
  sh: ["terminal", "green"],
  bash: ["terminal", "green"],
  zsh: ["terminal", "green"],
  fish: ["terminal", "green"],
  ps1: ["terminal", "blue"],
  bat: ["terminal", "gray"],
  json: ["json", "yellow"],
  jsonc: ["json", "yellow"],
  json5: ["json", "yellow"],
  yml: ["config", "purple"],
  yaml: ["config", "purple"],
  toml: ["config", "gray"],
  ini: ["config", "gray"],
  conf: ["config", "gray"],
  cfg: ["config", "gray"],
  plist: ["config", "gray"],
  css: ["style", "blue"],
  scss: ["style", "purple"],
  sass: ["style", "purple"],
  less: ["style", "blue"],
  md: ["markdown", "blue"],
  mdx: ["markdown", "blue"],
  markdown: ["markdown", "blue"],
  txt: ["text", "gray"],
  log: ["text", "gray"],
  rst: ["text", "gray"],
  csv: ["text", "green"],
  tsv: ["text", "green"],
  pdf: ["text", "red"],
  png: ["image", "green"],
  jpg: ["image", "green"],
  jpeg: ["image", "green"],
  gif: ["image", "green"],
  webp: ["image", "green"],
  bmp: ["image", "green"],
  ico: ["image", "green"],
  avif: ["image", "green"],
  heic: ["image", "green"],
  svg: ["image", "orange"],
  zip: ["archive", "orange"],
  tar: ["archive", "orange"],
  gz: ["archive", "orange"],
  tgz: ["archive", "orange"],
  bz2: ["archive", "orange"],
  xz: ["archive", "orange"],
  "7z": ["archive", "orange"],
  rar: ["archive", "orange"],
  jar: ["archive", "red"],
  mp4: ["video", "purple"],
  mov: ["video", "purple"],
  webm: ["video", "purple"],
  mkv: ["video", "purple"],
  avi: ["video", "purple"],
  mp3: ["audio", "cyan"],
  wav: ["audio", "cyan"],
  flac: ["audio", "cyan"],
  ogg: ["audio", "cyan"],
  m4a: ["audio", "cyan"],
  ttf: ["font", "red"],
  otf: ["font", "red"],
  woff: ["font", "red"],
  woff2: ["font", "red"],
  sql: ["database", "yellow"],
  sqlite: ["database", "yellow"],
  db: ["database", "yellow"],
  lock: ["lock", "gray"],
  pem: ["key", "yellow"],
  key: ["key", "yellow"],
};

function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

// Stroke paths on a 24px grid, in the style of src/lib/ui/icons.ts: a page with a folded corner
// plus a mark for the type.
const PAGE = ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4"];

const MARKS: Record<FileIconGlyph, string[]> = {
  file: [],
  code: ["m10 12.5-2 2 2 2", "m14 16.5 2-2-2-2"],
  json: [
    "M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1",
    "M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1",
  ],
  text: ["M10 9H8", "M16 13H8", "M16 17H8"],
  markdown: ["M7.5 18v-5l2 2 2-2v5", "M15.5 12.5v5", "m13.5 15.5 2 2 2-2"],
  image: [circle(10, 12, 2), "m20 17-1.3-1.3a2.4 2.4 0 0 0-3.4 0L9 22"],
  terminal: ["m8 16 2-2-2-2", "M12 18h4"],
  config: [circle(12, 15, 2), "M12 11v1.5", "M12 17.5V19", "M8 15h1.5", "M14.5 15H16"],
  style: ["m10.5 11.5-1 7.5", "m14.5 11.5-1 7.5", "M8.5 13.5h7", "M8 16.5h7"],
  lock: ["M9 15v-1.5a3 3 0 0 1 6 0V15", "M8 15h8v4H8z"],
  key: [circle(10, 16, 2), "m11.5 14.5 4-4", "m14 12 1.5 1.5"],
  archive: ["M10 7V6", "M10 11v-1", "M10 15v-1", circle(10, 18.5, 1.5)],
  video: ["m10 11.5 5 3-5 3z"],
  audio: [circle(9.5, 17.5, 1.5), circle(14.5, 16, 1.5), "M11 17.5v-5l5-1.5v5"],
  font: ["M9 13v-1h6v1", "M12 12v6", "M10.5 18h3"],
  database: [
    "M8 12.5c0 .8 1.8 1.5 4 1.5s4-.7 4-1.5-1.8-1.5-4-1.5-4 .7-4 1.5",
    "M8 12.5v5c0 .8 1.8 1.5 4 1.5s4-.7 4-1.5v-5",
  ],
  git: [circle(9, 18, 1.5), circle(15, 12, 1.5), "M9 16.5V10", "M13.5 12H12a3 3 0 0 0-3 3"],
};

function glyphSvg(glyph: FileIconGlyph): string {
  const paths = [...PAGE, ...MARKS[glyph]].map((path) => `<path d="${path}"/>`).join("");
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" ' +
    `stroke-linecap="round" stroke-linejoin="round">${paths}</svg>\n`
  );
}

function entries(table: Record<string, Rule>): Record<string, string> {
  return Object.fromEntries(Object.entries(table).map(([key, [glyph, tone]]) => [key, `${glyph} ${tone}`]));
}

/** A map value is "<glyph> <tone>"; a row gets the classes fi-g-<glyph> and fi-t-<tone>. */
export function minimalMap(): IconMap {
  return {
    source: "minimal",
    file: `${PLAIN[0]} ${PLAIN[1]}`,
    extensions: entries(EXTENSIONS),
    names: entries(NAMES),
    lightExtensions: {},
    lightNames: {},
  };
}

/**
 * One rule per glyph and per tone. Every row is a single empty element whose background color (a
 * theme token) shows through the glyph's mask, so a long list holds no SVG nodes and the web view
 * decodes each glyph once.
 */
export function minimalCss(): string {
  const base =
    ".file-type-icon{flex:none;display:block;background-color:var(--text-dim);" +
    "-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;" +
    "-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}";
  const glyphRules = FILE_ICON_GLYPHS.map((glyph) => `.fi-g-${glyph}{-webkit-mask-image:url(${glyph}.svg);mask-image:url(${glyph}.svg)}`);
  const tones = Object.entries(FILE_ICON_TONES).map(([tone, token]) => `.fi-t-${tone}{background-color:var(${token})}`);
  return `${[base, ...glyphRules, ...tones].join("\n")}\n`;
}

/** Every file of static/file-icons/minimal, by file name. */
export function minimalFiles(): Record<string, string> {
  const files: Record<string, string> = {
    "map.json": `${JSON.stringify(minimalMap())}\n`,
    "minimal.css": minimalCss(),
  };
  for (const glyph of FILE_ICON_GLYPHS) {
    files[`${glyph}.svg`] = glyphSvg(glyph);
  }
  return files;
}
