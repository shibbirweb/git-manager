// Shows only the Settings search matches of the open section: other blocks get a data attribute that
// hides them, and the matched words are painted with the CSS Custom Highlight API, so the markup
// Svelte owns is never changed. Which entries match is decided in settingsSearch.ts.

import { highlightSpans, type SearchBlock, type SettingsSearchEntry, visibleBlocks } from "./settingsSearch";

const HIGHLIGHT_NAME = "settings-search";
const HIDDEN_ATTRIBUTE = "data-search-hidden";
/** Row labels, group titles and the About links. */
const LABEL_SELECTOR = ".label > span:first-child, .group-title, .link-row strong";

function supported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
}

/** The label's own text nodes: a memory mark inside the label is not part of its name. */
function ownTextNodes(labelEl: Element): Text[] {
  return [...labelEl.childNodes].filter((node): node is Text => node instanceof Text && node.data.trim() !== "");
}

function labelText(labelEl: Element): string {
  return ownTextNodes(labelEl)
    .map((node) => node.data)
    .join("")
    .trim();
}

function rangeOf(node: Text, start: number, end: number): Range {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
}

function blockOf(element: Element, matched: Set<Element>): SearchBlock {
  const kind = element.classList.contains("group-title")
    ? "group"
    : element.classList.contains("group-hint")
      ? "hint"
      : element.classList.contains("sub-row")
        ? "subRow"
        : element.classList.contains("row") || element.classList.contains("link-row")
          ? "row"
          : "other";
  return { kind, matched: matched.has(element) };
}

/** Hides the blocks of `containerEl` the search does not keep; returns whether any stays. */
function filterBlocks(containerEl: Element, matched: Set<Element>): boolean {
  const children = [...containerEl.children];
  const visible = visibleBlocks(children.map((element) => blockOf(element, matched)));
  children.forEach((element, index) => {
    // A list of links (About) is filtered link by link.
    const shown = element.classList.contains("link-list") ? filterBlocks(element, matched) : visible[index];
    element.toggleAttribute(HIDDEN_ATTRIBUTE, !shown);
  });
  return children.some((element) => !element.hasAttribute(HIDDEN_ATTRIBUTE));
}

/**
 * Keeps only the matched rows of the open section (`rootEl` holds its blocks) and highlights the
 * matched words. A label found only by its extra words is highlighted whole; a hidden sub-row points
 * at its parent row.
 */
export function showSettingsMatches(rootEl: HTMLElement, entries: readonly SettingsSearchEntry[], words: readonly string[]): void {
  const labelsByText = new Map<string, HTMLElement[]>();
  for (const labelEl of rootEl.querySelectorAll<HTMLElement>(LABEL_SELECTOR)) {
    const text = labelText(labelEl);
    labelsByText.set(text, [...(labelsByText.get(text) ?? []), labelEl]);
  }
  const ranges: Range[] = [];
  const painted = new Set<HTMLElement>();
  for (const entry of entries) {
    const own = labelsByText.get(entry.label) ?? [];
    const targets = own.length > 0 ? own : entry.parent ? (labelsByText.get(entry.parent) ?? []) : [];
    for (const labelEl of targets) {
      if (painted.has(labelEl)) {
        continue;
      }
      painted.add(labelEl);
      const nodes = ownTextNodes(labelEl);
      const spans = own.length > 0 ? nodes.map((node) => highlightSpans(node.data, words)) : nodes.map(() => []);
      if (spans.every((nodeSpans) => nodeSpans.length === 0)) {
        nodes.forEach((node) => ranges.push(rangeOf(node, 0, node.data.length)));
        continue;
      }
      nodes.forEach((node, nodeIndex) => {
        for (const [start, end] of spans[nodeIndex]) {
          ranges.push(rangeOf(node, start, end));
        }
      });
    }
  }
  const matchedBlocks = new Set<Element>(
    [...painted].map((labelEl) => labelEl.closest(".row, .link-row, .group-title")).filter((block): block is Element => block !== null),
  );
  filterBlocks(rootEl, matchedBlocks);
  if (supported()) {
    if (ranges.length > 0) {
      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
    } else {
      CSS.highlights.delete(HIGHLIGHT_NAME);
    }
  }
}

/** Shows every block again and removes the highlight. */
export function clearSettingsMatches(rootEl: HTMLElement | null): void {
  for (const element of rootEl?.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`) ?? []) {
    element.removeAttribute(HIDDEN_ATTRIBUTE);
  }
  if (supported()) {
    CSS.highlights.delete(HIGHLIGHT_NAME);
  }
}
