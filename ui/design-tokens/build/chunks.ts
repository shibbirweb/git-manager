// Splits generated output into files of at most MAX_LINES, at whole blocks (one component each), so every
// generated file keeps the repository's 300-line limit however many components the library grows.

export const MAX_LINES = 280;

/** Groups blocks into chunks whose lines, with the header and footer, stay within maxLines. */
export function chunkBlocks(blocks: string[][], overhead: number, maxLines = MAX_LINES): string[][][] {
  const chunks: string[][][] = [];
  let current: string[][] = [];
  let size = overhead;
  for (const block of blocks) {
    if (current.length && size + block.length > maxLines) {
      chunks.push(current);
      current = [];
      size = overhead;
    }
    current.push(block);
    size += block.length;
  }
  if (current.length || !chunks.length) {
    chunks.push(current);
  }
  return chunks;
}

/** `GMComponents.swift`, `GMComponents2.swift`...: the first chunk keeps the plain name. */
export function chunkName(base: string, extension: string, index: number): string {
  return `${base}${index === 0 ? "" : index + 1}${extension}`;
}
