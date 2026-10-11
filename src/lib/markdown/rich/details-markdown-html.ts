// Adapted from Orca (github.com/stablyai/orca), MIT License: see LICENSE-ORCA.
import { getMarkdownFenceRanges, isInsideMarkdownFenceRange, type MarkdownFenceRanges } from "./markdown-fence-scanner";

export type DetailsHtmlBlock = {
  raw: string;
  openingAttributes: string;
  inner: string;
};

export function createDetailsMatcher(content: string): (start: number) => DetailsHtmlBlock | null {
  let fenceRanges: MarkdownFenceRanges | undefined;
  return (start) =>
    /^<details\b[^>]*>/i.test(content.slice(start))
      ? matchDetailsHtmlBlock(content, start, (fenceRanges ??= getMarkdownFenceRanges(content)))
      : null;
}

export function matchDetailsHtmlBlock(
  content: string,
  start: number,
  precomputedFenceRanges?: MarkdownFenceRanges,
): DetailsHtmlBlock | null {
  const openingMatch = content.slice(start).match(/^<details\b[^>]*>/i);
  if (!openingMatch) {
    return null;
  }

  const detailsTagPattern = /<\/?details\b[^>]*>/gi;
  detailsTagPattern.lastIndex = start;
  const fenceRanges = precomputedFenceRanges ?? getMarkdownFenceRanges(content);

  let depth = 0;

  for (;;) {
    const tagMatch = detailsTagPattern.exec(content);
    if (!tagMatch) {
      return null;
    }

    const tag = tagMatch[0];
    if (tagMatch.index !== start && isInsideMarkdownFenceRange(tagMatch.index, fenceRanges)) {
      continue;
    }

    const isClosingTag = /^<\/details\b/i.test(tag);

    if (isClosingTag) {
      depth -= 1;
      if (depth === 0) {
        const closingEnd = tagMatch.index + tag.length;
        return {
          raw: content.slice(start, closingEnd),
          openingAttributes: openingMatch[0].replace(/^<details\b/i, "").replace(/>$/u, ""),
          inner: content.slice(start + openingMatch[0].length, tagMatch.index),
        };
      }
    } else {
      depth += 1;
    }
  }
}
