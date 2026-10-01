// A small, safe Markdown renderer for release notes: headings, lists,
// paragraphs, bold, italic, inline code and https links. Everything is
// HTML-escaped first, so notes can never inject markup or scripts.

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(text: string): string {
  let html = escapeHtml(text);
  // Code first so its contents are not formatted further.
  const codes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_match, code: string) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  html = html.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" data-external>$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*\w])\*([^*]+)\*(?!\w)/g, "$1<em>$2</em>");
  html = html.replace(/(^|\W)_([^_]+)_(?!\w)/g, "$1<em>$2</em>");
  return html.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => `<code>${codes[Number(index)]}</code>`);
}

export function renderMarkdown(markdown: string): string {
  const out: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length > 0) {
      out.push(`<ul>${listItems.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
      listItems = [];
    }
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const item = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      // Notes live inside a dialog: keep headings small (h3 and below).
      const level = Math.min(6, Math.max(3, heading[1].length + 1));
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (item) {
      flushParagraph();
      listItems.push(item[1]);
    } else if (line.trim() === "") {
      flushParagraph();
      flushList();
    } else if (listItems.length > 0 && /^\s{2,}\S/.test(rawLine)) {
      // A wrapped continuation of the previous list item.
      listItems[listItems.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return out.join("\n");
}
