// What the showcase lists: every component file, with its doc, story and sources found by file name, so a new
// component shows up without wiring. A story is `stories/<Name>.story.svelte`.
import type { Component } from "svelte";
import { docFor } from "$ui/docs";
import type { ComponentDoc } from "$ui/docs/types";

const componentSources = import.meta.glob<string>("../lib/components/*.svelte", {
  query: "?raw",
  import: "default",
  eager: true,
});
const logicSources = import.meta.glob<string>(["../lib/logic/*.ts", "!../lib/logic/*.test.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const stories = import.meta.glob<Component>("./stories/*.story.svelte", { import: "default", eager: true });
const storySources = import.meta.glob<string>("./stories/*.story.svelte", {
  query: "?raw",
  import: "default",
  eager: true,
});

export interface SourceFile {
  file: string;
  source: string;
}

export interface Entry {
  name: string;
  doc: ComponentDoc | null;
  story: Component | null;
  svelte: SourceFile;
  example: SourceFile | null;
  logic: SourceFile[];
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export const entries: Entry[] = Object.entries(componentSources)
  .map(([path, source]): Entry => {
    const name = baseName(path).replace(/\.svelte$/, "");
    const storyPath = `./stories/${name}.story.svelte`;
    const doc = docFor(name);
    return {
      name,
      doc,
      story: stories[storyPath] ?? null,
      svelte: { file: `components/${name}.svelte`, source },
      example: storySources[storyPath] ? { file: `${name}.story.svelte`, source: storySources[storyPath] } : null,
      logic: (doc?.logic ?? []).map((file) => ({
        file: `logic/${file}`,
        source: logicSources[`../lib/logic/${file}`] ?? "",
      })),
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name));
