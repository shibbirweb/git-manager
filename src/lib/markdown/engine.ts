// The Markdown preview's heavy parts (markdown-it and DOMPurify), imported
// lazily as one chunk the first time a Markdown file shows its preview.

export { createRenderer } from "./render";
export type { RenderHooks, RenderOutput } from "./render";
export { sanitizeMarkdownHtml, sanitizeSvg } from "./sanitize";
