// Markdown to HTML for the preview, with markdown-it (CommonMark plus GitHub's
// tables, strikethrough and autolinks). Kept free of the DOM so it is tested
// directly; the HTML is sanitized by sanitize.ts before it reaches the page.
//
// On top of markdown-it:
// - every block carries `data-line` (its first source line, 0-based) for scroll sync,
// - headings get GitHub-style ids (with the "user-content-" prefix),
// - "- [ ]" / "- [x]" items become task list checkboxes,
// - fenced code is highlighted by a callback, and ```mermaid blocks become placeholders,
// - images keep their path in `data-gm-src` and get no `src`: the preview loads them.
//
// The HTML comes in segments, one per top-level block, so the preview can
// replace only the segments that changed. Raw HTML that opens a tag in one
// block and closes it in a later one (`<div align="center">` ... `</div>`)
// keeps those blocks in one segment, so each segment is complete HTML.

import MarkdownIt from "markdown-it";
import type { Env, StateCore, Token } from "markdown-it";
import { ID_PREFIX } from "./links";
import { Slugger } from "./slug";

export interface RenderHooks {
  /** Highlighted HTML for a fenced block, or null to show it as plain text. */
  highlight: (code: string, language: string) => string | null;
}

export interface RenderSegment {
  html: string;
  /** First source line of the segment, 0-based. */
  line: number;
}

export interface RenderOutput {
  segments: RenderSegment[];
  /** The document has at least one ```mermaid block. */
  hasMermaid: boolean;
  /** The document has raw HTML; without it every segment is well-formed markdown-it output. */
  hasRawHtml: boolean;
}

interface RenderEnv extends Env {
  slugger: Slugger;
  hasMermaid: boolean;
}

/** The env passed to `render`; markdown-it types it loosely. */
function renderEnv(env: Env | undefined): RenderEnv {
  return env as RenderEnv;
}

const TASK_MARK = /^\[([ xX])\][ \t]+/;
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const HTML_TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;

/** Tags a raw HTML block leaves open (negative when it closes earlier ones). */
export function openTagBalance(html: string): number {
  let depth = 0;
  for (const match of html.replace(/<!--[\s\S]*?-->/g, "").matchAll(HTML_TAG)) {
    const [, closing, name, selfClosing] = match;
    if (VOID_TAGS.has(name.toLowerCase()) || selfClosing) {
      continue;
    }
    depth += closing ? -1 : 1;
  }
  return depth;
}

/** Plain text of an inline token, for heading ids. */
function inlineText(token: Token | undefined): string {
  if (!token?.children) {
    return token?.content ?? "";
  }
  return token.children
    .filter((child) => child.type === "text" || child.type === "code_inline")
    .map((child) => child.content)
    .join("");
}

function sourceLines(state: StateCore): void {
  for (const token of state.tokens) {
    const isBlock = token.block && token.type !== "inline" && token.nesting !== -1;
    if (isBlock && token.map) {
      token.attrSet("data-line", String(token.map[0]));
    }
  }
}

function headingIds(state: StateCore): void {
  const env = renderEnv(state.env);
  const tokens = state.tokens;
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].type === "heading_open") {
      tokens[index].attrSet("id", `${ID_PREFIX}${env.slugger.slug(inlineText(tokens[index + 1]))}`);
    }
  }
}

function taskLists(state: StateCore): void {
  const tokens = state.tokens;
  for (let index = 2; index < tokens.length; index++) {
    const inline = tokens[index];
    const item = tokens[index - 2];
    if (inline.type !== "inline" || tokens[index - 1].type !== "paragraph_open" || item.type !== "list_item_open") {
      continue;
    }
    const first = inline.children?.[0];
    const match = first?.type === "text" ? TASK_MARK.exec(first.content) : null;
    if (!first || !match || !item.map) {
      continue;
    }
    first.content = first.content.slice(match[0].length);
    inline.content = inline.content.replace(TASK_MARK, "");
    const checkbox = new state.Token("task_checkbox", "input", 0);
    checkbox.meta = { checked: match[1] !== " ", line: item.map[0] };
    inline.children?.unshift(checkbox);
    item.attrJoin("class", "task-list-item");
    // The list that holds the item: the nearest list opening one level up.
    for (let back = index - 3; back >= 0; back--) {
      const candidate = tokens[back];
      if ((candidate.type === "bullet_list_open" || candidate.type === "ordered_list_open") && candidate.level === item.level - 1) {
        if (!String(candidate.attrGet("class") ?? "").includes("contains-task-list")) {
          candidate.attrJoin("class", "contains-task-list");
        }
        break;
      }
    }
  }
}

export function createRenderer(hooks: RenderHooks): { render: (source: string) => RenderOutput } {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
  const { escapeHtml, unescapeAll } = md.utils;

  md.core.ruler.push("gm_source_lines", sourceLines);
  md.core.ruler.push("gm_heading_ids", headingIds);
  md.core.ruler.push("gm_task_lists", taskLists);

  md.renderer.rules.task_checkbox = (tokens, index) => {
    const meta = tokens[index].meta as { checked: boolean; line: number };
    return `<input type="checkbox" class="task-list-item-checkbox" data-task-line="${meta.line}"${meta.checked ? " checked" : ""}> `;
  };

  md.renderer.rules.fence = (tokens, index, _options, env) => {
    const token = tokens[index];
    const info = token.info ? unescapeAll(token.info).trim() : "";
    const language = info.split(/\s+/)[0] ?? "";
    const line = String(token.attrGet("data-line") ?? "0");
    if (language.toLowerCase() === "mermaid") {
      renderEnv(env).hasMermaid = true;
      return `<div class="md-mermaid" data-line="${line}"><pre class="md-mermaid-source">${escapeHtml(token.content)}</pre></div>\n`;
    }
    const highlighted = language ? hooks.highlight(token.content, language) : null;
    const languageClass = language ? ` class="language-${escapeHtml(language)}"` : "";
    return `<pre class="md-code" data-line="${line}"><code${languageClass}>${highlighted ?? escapeHtml(token.content)}</code></pre>\n`;
  };

  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const src = String(token.attrGet("src") ?? "");
    const title = token.attrGet("title") === null ? null : String(token.attrGet("title"));
    const alt = self.renderInlineAsText(token.children ?? [], options, env);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return `<img data-gm-src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr}>`;
  };

  return {
    render(source: string): RenderOutput {
      const env: RenderEnv = { slugger: new Slugger(), hasMermaid: false };
      const tokens = md.parse(source, env);
      const segments: RenderSegment[] = [];
      let start = 0;
      let depth = 0;
      let openHtml = 0;
      for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        depth += token.nesting;
        if (depth !== 0) {
          continue;
        }
        if (token.type === "html_block") {
          openHtml = Math.max(0, openHtml + openTagBalance(token.content));
        }
        if (openHtml === 0) {
          const slice = tokens.slice(start, index + 1);
          segments.push({ html: md.renderer.render(slice, md.options, env), line: slice[0].map?.[0] ?? 0 });
          start = index + 1;
        }
      }
      if (start < tokens.length) {
        const slice = tokens.slice(start);
        segments.push({ html: md.renderer.render(slice, md.options, env), line: slice[0].map?.[0] ?? 0 });
      }
      const hasRawHtml = tokens.some(
        (token) => token.type === "html_block" || (token.children?.some((child) => child.type === "html_inline") ?? false),
      );
      return { segments, hasMermaid: env.hasMermaid, hasRawHtml };
    },
  };
}
