// Writes a small lorem ipsum PDF for the docs demo (scripts/make-docs-demo.sh), so the image and PDF
// preview screenshot shows a real document without any PDF tool installed.
// Usage: bun scripts/make-demo-pdf.ts <out.pdf>

const outPath = process.argv[2];
if (!outPath) {
  console.error("Usage: bun scripts/make-demo-pdf.ts <out.pdf>");
  process.exit(2);
}

const LOREM = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
  "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.",
];

const PAGE = { width: 612, height: 792, margin: 72 };
const BODY_SIZE = 12;
const LINE_GAP = 18;
/** Helvetica averages about half an em per character, so this fills the text width. */
const CHARS_PER_LINE = Math.floor((PAGE.width - 2 * PAGE.margin) / (BODY_SIZE * 0.5));

function wrap(paragraph: string): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of paragraph.split(" ")) {
    if (line && line.length + word.length + 1 > CHARS_PER_LINE) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

/** PDF strings escape backslashes and parentheses. */
function escapeText(text: string): string {
  return text.replace(/[\\()]/g, (char) => `\\${char}`);
}

/** The drawing commands of one page: a title, then the paragraphs with a blank line between them. */
function pageContent(title: string, pageNumber: number, pageCount: number): string {
  const commands = [`BT /F2 26 Tf ${PAGE.margin} ${PAGE.height - PAGE.margin - 26} Td (${escapeText(title)}) Tj ET`];
  let y = PAGE.height - PAGE.margin - 70;
  for (const paragraph of LOREM) {
    for (const line of wrap(paragraph)) {
      commands.push(`BT /F1 ${BODY_SIZE} Tf ${PAGE.margin} ${y} Td (${escapeText(line)}) Tj ET`);
      y -= LINE_GAP;
    }
    y -= LINE_GAP;
  }
  commands.push(`BT /F1 10 Tf ${PAGE.width / 2 - 20} 40 Td (Page ${pageNumber} of ${pageCount}) Tj ET`);
  return commands.join("\n");
}

const titles = ["Lorem Ipsum", "Dolor Sit Amet", "Consectetur"];
const objects: string[] = [];
const pageIds = titles.map((_, index) => 5 + index * 2);
objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${titles.length} >>`;
objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
titles.forEach((title, index) => {
  const pageId = pageIds[index];
  const body = pageContent(title, index + 1, titles.length);
  objects[pageId] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ` +
    `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
  objects[pageId + 1] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
});

// Every object's byte offset goes into the cross-reference table; the text is ASCII, so length is bytes.
let pdf = "%PDF-1.4\n";
const offsets: number[] = [];
for (let id = 1; id < objects.length; id++) {
  offsets[id] = pdf.length;
  pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
}
const xref = pdf.length;
pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
for (let id = 1; id < objects.length; id++) {
  pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
await Bun.write(outPath, pdf);
