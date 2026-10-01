// Pure helpers behind scripts/build-wiki.ts, kept separate so they can be tested.

export interface ManifestPage {
  page: string;
  summary: string;
}

export interface ManifestFeature {
  id: string;
  title: string;
  usage: string;
  developer: string;
  screenshots: string[];
}

export interface Manifest {
  usage: ManifestPage[];
  developer: ManifestPage[];
  features: ManifestFeature[];
}

/** Pages longer than this are split: a wiki page should read in a few minutes. */
export const MAX_WORDS = 1200;

const MERMAID_TYPES = [
  "flowchart",
  "graph",
  "sequenceDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "classDiagram",
  "erDiagram",
  "gitGraph",
  "journey",
  "pie",
  "mindmap",
  "timeline",
];

/** The wiki page name of a source file: `usage/Merge-Tool.md` becomes `Merge-Tool`. */
export function pageName(sourcePath: string): string {
  return (sourcePath.split("/").pop() ?? sourcePath).replace(/\.md$/, "");
}

export interface Segment {
  code: boolean;
  text: string;
}

/** Splits markdown into prose and fenced code, so links and words inside code are left alone. */
export function segments(markdown: string): Segment[] {
  const result: Segment[] = [];
  let current: string[] = [];
  let inCode = false;
  for (const line of markdown.split("\n")) {
    const fence = /^\s*(```|~~~)/.test(line);
    if (fence && !inCode) {
      if (current.length > 0) {
        result.push({ code: false, text: current.join("\n") });
      }
      current = [line];
      inCode = true;
    } else if (fence && inCode) {
      current.push(line);
      result.push({ code: true, text: current.join("\n") });
      current = [];
      inCode = false;
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    result.push({ code: inCode, text: current.join("\n") });
  }
  return result;
}

/** A markdown link or image target outside code spans: `[text](target#anchor)`. */
const LINK = /(!?)\[([^\]]*)\]\(([^)\s#]*)(#[^)\s]*)?\)/g;

export interface Link {
  image: boolean;
  target: string;
  anchor: string;
}

function withoutInlineCode(text: string): string {
  return text.replace(/`[^`\n]*`/g, (span) => " ".repeat(span.length));
}

/** Every link and image in the prose of a page. */
export function findLinks(markdown: string): Link[] {
  const links: Link[] = [];
  for (const segment of segments(markdown)) {
    if (segment.code) {
      continue;
    }
    for (const match of withoutInlineCode(segment.text).matchAll(LINK)) {
      links.push({ image: match[1] === "!", target: match[3], anchor: match[4] ?? "" });
    }
  }
  return links;
}

export function isExternal(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//") || target === "";
}

/** Joins and normalizes posix paths, so `usage/../images/a.png` becomes `images/a.png`. */
export function resolvePath(fromFile: string, target: string): string {
  const parts = fromFile.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") {
      parts.pop();
    } else if (part !== "." && part !== "") {
      parts.push(part);
    }
  }
  return parts.join("/");
}

/** Where docs/wiki lives in the repository; manifest paths are relative to it. */
export const WIKI_DIR = "docs/wiki";

/**
 * Rewrites the links of a page for the wiki, which is flat: other pages become
 * page names, images move to `images/`, and anything else in the repository
 * becomes an absolute GitHub URL. `sourcePath` is relative to the repository.
 */
export function rewriteLinks(markdown: string, sourcePath: string, blobUrl: string): string {
  return segments(markdown)
    .map((segment) => {
      if (segment.code) {
        return segment.text;
      }
      const masked = withoutInlineCode(segment.text);
      let output = "";
      let last = 0;
      for (const match of masked.matchAll(LINK)) {
        const [whole, , , target, anchor = ""] = match;
        const start = match.index ?? 0;
        const closing = start + whole.length - `](${target}${anchor})`.length;
        output += segment.text.slice(last, closing);
        output += `](${wikiTarget(target, anchor, sourcePath, blobUrl)})`;
        last = start + whole.length;
      }
      return output + segment.text.slice(last);
    })
    .join("\n");
}

function wikiTarget(target: string, anchor: string, sourcePath: string, blobUrl: string): string {
  if (isExternal(target)) {
    return `${target}${anchor}`;
  }
  const resolved = resolvePath(sourcePath, target);
  if (resolved.startsWith(`${WIKI_DIR}/images/`)) {
    return `${resolved.slice(WIKI_DIR.length + 1)}${anchor}`;
  }
  if (new RegExp(`^${WIKI_DIR}/(usage|developer)/[^/]+\\.md$`).test(resolved)) {
    return `${pageName(resolved)}${anchor}`;
  }
  return `${blobUrl}/${resolved}${anchor}`;
}

/** The page without its leading `# Title` (the wiki prints the page name as the title). */
export function stripTitle(markdown: string): string {
  return markdown.replace(/^\s*#\s+[^\n]*\n+/, "");
}

/** Words of prose, leaving out code blocks, link targets and markup. */
export function countWords(markdown: string): number {
  return segments(markdown)
    .filter((segment) => !segment.code)
    .map((segment) =>
      segment.text
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[#*_`>|-]/g, " ")
        .split(/\s+/)
        .filter((word) => /[A-Za-z0-9]/.test(word)).length,
    )
    .reduce((sum, count) => sum + count, 0);
}

/** Problems with a page's own text, independent of other files. */
export function pageProblems(markdown: string): string[] {
  const problems: string[] = [];
  if (!/^#\s+\S/.test(markdown)) {
    problems.push("does not start with a `# Title` line");
  }
  if (markdown.includes("\u2014")) {
    problems.push("contains the em-dash character; use a colon, comma or hyphen");
  }
  const words = countWords(markdown);
  if (words > MAX_WORDS) {
    problems.push(`is ${words} words long; keep pages under ${MAX_WORDS} and split big topics`);
  }
  for (const segment of segments(markdown)) {
    const firstLine = segment.text.split("\n")[0] ?? "";
    if (!segment.code || !/^\s*```\s*mermaid\s*$/.test(firstLine)) {
      continue;
    }
    const body = segment.text.split("\n").slice(1, -1).filter((line) => line.trim() !== "" && !line.trim().startsWith("%%"));
    const kind = (body[0] ?? "").trim().split(/\s+/)[0] ?? "";
    if (!MERMAID_TYPES.includes(kind)) {
      problems.push(`has a mermaid block that does not start with a diagram type (found "${kind || "nothing"}")`);
    }
  }
  return problems;
}

/** Problems with the manifest itself: duplicate pages or names, and features missing pages. */
export function manifestProblems(manifest: Manifest): string[] {
  const problems: string[] = [];
  const usagePages = new Set(manifest.usage.map((entry) => entry.page));
  const all = [...manifest.usage.map((entry) => entry.page), ...manifest.developer.map((entry) => entry.page), ...manifest.features.map((feature) => feature.developer)];
  const names = new Map<string, string>();
  for (const page of all) {
    const name = pageName(page);
    const previous = names.get(name);
    if (previous !== undefined) {
      problems.push(`${page} and ${previous} would both become the wiki page ${name}`);
    }
    names.set(name, page);
  }
  const ids = new Set<string>();
  for (const feature of manifest.features) {
    if (ids.has(feature.id)) {
      problems.push(`feature id ${feature.id} is used twice`);
    }
    ids.add(feature.id);
    if (!usagePages.has(feature.usage)) {
      problems.push(`feature ${feature.id}: its usage page ${feature.usage} is not listed under "usage"`);
    }
    if (!feature.developer.startsWith("developer/")) {
      problems.push(`feature ${feature.id}: its developer chapter must live in developer/`);
    }
    if (feature.screenshots.length === 0) {
      problems.push(`feature ${feature.id}: has no screenshots`);
    }
  }
  return problems;
}
