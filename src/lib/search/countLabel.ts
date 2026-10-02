// Counts in the Search Everywhere popup ("2 classes", "1 match"). English plurals are not
// always a trailing "s", so each counted word names its plural here.

const PLURALS = {
  file: "files",
  class: "classes",
  symbol: "symbols",
  match: "matches",
} as const;

export type CountWord = keyof typeof PLURALS;

/** "1 file", "2 classes", "0 matches". */
export function countLabel(count: number, word: CountWord): string {
  return `${count.toLocaleString()} ${count === 1 ? word : PLURALS[word]}`;
}
