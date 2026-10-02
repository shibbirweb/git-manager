// Writes a small two-page PDF for the docs demo (scripts/make-docs-demo.sh), so the image and PDF
// preview screenshot has a real document without any PDF tool installed.
// Usage: bun scripts/make-demo-pdf.ts <out.pdf>

const outPath = process.argv[2];
if (!outPath) {
  console.error("Usage: bun scripts/make-demo-pdf.ts <out.pdf>");
  process.exit(2);
}

const pages = [
  ["Acme Storefront", "Team handbook", "", "1. Run bun install, then bun dev.", "2. Open a pull request into develop.", "3. Ask a teammate for a review."],
  ["Releases", "", "Betas ship every week from develop.", "Stable releases follow a tried beta.", "Write every change in CHANGELOG.md."],
];

/** PDF strings escape backslashes and parentheses. */
function escapeText(text: string): string {
  return text.replace(/[\\()]/g, (char) => `\\${char}`);
}

const objects: string[] = [];
const pageIds = pages.map((_, index) => 4 + index * 2);
objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
pages.forEach((lines, index) => {
  const pageId = pageIds[index];
  const body = lines.map((line, row) => `BT /F1 ${row === 0 ? 28 : 14} Tf 72 ${720 - row * 30} Td (${escapeText(line)}) Tj ET`).join("\n");
  objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
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
