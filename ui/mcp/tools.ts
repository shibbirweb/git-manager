// What the design-system MCP server answers: components with their docs, props and code, the design tokens, the
// icon names and the rules. Pure functions over the library's own sources, so the answers never drift from them.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { designTokens } from "../design-tokens/build/model";
import { componentDocs } from "../web/src/lib/docs";
import { componentMarkdown, indexMarkdown } from "../web/src/lib/docs/markdown";
import type { ComponentDoc } from "../web/src/lib/docs/types";
import { icons } from "../../src/lib/ui/icons";

const webRoot = fileURLToPath(new URL("../web/", import.meta.url));

export const RULES = [
  "New UI is a library component first: add the component, its doc, its story and its tokens, then use it.",
  "Components take no class or style; everything is a prop. Lay out with Stack (gaps are steps: none, xxs, xs, " +
    "sm, md, lg, xl, xxl) and write words with Text (variant: body, label, hint, caption, sectionLabel, title...).",
  "Colors come from the theme tokens (tone props); sizes come from the design tokens; never hard-code either.",
  "Import a component from $ui/components/<Name>.svelte; read its doc first (get_component).",
  "Destructive actions confirm first in a message Dialog with a Danger primary button. " +
    "Never type a shortcut into UI text.",
  "Every file stays within 120 columns and 300 lines.",
];

function findDoc(name: string): ComponentDoc | null {
  const wanted = name.trim().toLowerCase();
  return componentDocs.find((doc) => doc.name.toLowerCase() === wanted) ?? null;
}

export function listComponents(group?: string): { name: string; group: string; summary: string }[] {
  return componentDocs
    .filter((doc) => !group || doc.group.toLowerCase() === group.toLowerCase())
    .map((doc) => ({ name: doc.name, group: doc.group, summary: doc.summary }));
}

/** Components whose name, aliases, summary or usage contain every word of the query, best name matches first. */
export function searchComponents(query: string): { name: string; group: string; summary: string }[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = (doc: ComponentDoc) =>
    [doc.name, ...(doc.aliases ?? []), doc.summary, doc.usage, ...doc.replaces].join(" ").toLowerCase();
  const names = (doc: ComponentDoc) => [doc.name, ...(doc.aliases ?? [])].map((name) => name.toLowerCase());
  const nameHit = (doc: ComponentDoc) => words.some((word) => names(doc).some((name) => name.includes(word)));
  return componentDocs
    .filter((doc) => words.every((word) => text(doc).includes(word)))
    .sort((left, right) => Number(nameHit(right)) - Number(nameHit(left)))
    .map((doc) => ({ name: doc.name, group: doc.group, summary: doc.summary }));
}

export interface ComponentAnswer {
  doc: ComponentDoc;
  markdown: string;
  source: string;
  example: string | null;
}

export function getComponent(name: string): ComponentAnswer | null {
  const doc = findDoc(name);
  if (!doc) {
    return null;
  }
  const read = (path: string) => {
    try {
      return readFileSync(`${webRoot}${path}`, "utf8");
    } catch {
      return null;
    }
  };
  return {
    doc,
    markdown: componentMarkdown(doc),
    source: read(`src/lib/components/${doc.name}.svelte`) ?? "",
    example: read(`src/showcase/stories/${doc.name}.story.svelte`),
  };
}

export type TokenCategory = "colors" | "typography" | "sizes" | "layout" | "components";

export function getTokens(category: TokenCategory): unknown {
  const { scales } = designTokens;
  switch (category) {
    case "colors":
      return designTokens.colors;
    case "typography":
      return {
        fonts: designTokens.fonts,
        fontSize: scales.fontSize,
        fontWeight: scales.fontWeight,
        lineHeight: scales.lineHeight,
        letterSpacing: scales.letterSpacing,
        textStyles: designTokens.textStyles,
      };
    case "sizes":
      return { size: scales.size, radius: scales.radius, space: scales.space, motion: scales.motion };
    case "layout":
      return { breakpoint: scales.breakpoint, grid: scales.grid };
    case "components":
      return designTokens.components;
  }
}

export function listIcons(): string[] {
  return Object.keys(icons);
}

export function componentIndex(): string {
  return indexMarkdown(componentDocs);
}
