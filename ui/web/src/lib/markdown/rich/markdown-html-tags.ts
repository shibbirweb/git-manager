// Adapted from Orca (github.com/stablyai/orca), MIT License: see LICENSE-ORCA.
// HTML in Markdown: the tag names the rich editor keeps as HTML, and where a tag ends.

// rehype-sanitize's default schema tag names (hast-util-sanitize 5).
export const KNOWN_MARKDOWN_HTML_TAG_NAMES = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "input",
  "ins",
  "kbd",
  "li",
  "ol",
  "p",
  "picture",
  "pre",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "section",
  "source",
  "span",
  "strike",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "tt",
  "ul",
  "var",
]);

export function getHtmlTagEnd(content: string, startIndex: number): number | null {
  let index = startIndex + 1;

  if (content.charCodeAt(index) === 47) {
    index++;
  }

  if (!isHtmlTagNameStart(content.charCodeAt(index))) {
    return null;
  }
  index++;

  while (isHtmlTagNamePart(content.charCodeAt(index))) {
    index++;
  }

  const nextCode = content.charCodeAt(index);
  if (nextCode === 62) {
    return index + 1;
  }
  if (nextCode === 47 && content.charCodeAt(index + 1) === 62) {
    return index + 2;
  }
  if (!isHtmlWhitespace(nextCode)) {
    return null;
  }

  index++;
  while (index < content.length) {
    const code = content.charCodeAt(index);
    if (code === 60) {
      return null;
    }
    if (code === 62) {
      return index + 1;
    }
    index++;
  }

  return null;
}

function isHtmlTagNameStart(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isHtmlTagNamePart(code: number): boolean {
  return (
    isHtmlTagNameStart(code) || (code >= 48 && code <= 57) || code === 95 || code === 46 || code === 58 || code === 45
  );
}

function isHtmlWhitespace(code: number): boolean {
  return code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 32;
}
