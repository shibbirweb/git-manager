// The Markdown files generated from the docs, for scripts/docs.ts (write or --check) and docs.test.ts.
import { componentDocs } from "./index";
import { componentMarkdown, groupMarkdown, groupPath, indexMarkdown } from "./markdown";

export interface DocOutput {
  /** Path from ui/web/. */
  path: string;
  content: string;
}

export function docOutputs(): DocOutput[] {
  return [
    { path: "COMPONENTS.md", content: indexMarkdown(componentDocs) },
    ...[...new Set(componentDocs.map((doc) => doc.group))].map((group) => ({
      path: groupPath(group),
      content: groupMarkdown(group, componentDocs),
    })),
    ...componentDocs.map((doc) => ({ path: `docs/components/${doc.name}.md`, content: componentMarkdown(doc) })),
  ];
}
