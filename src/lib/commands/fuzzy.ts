// A small fuzzy matcher for short labels (commands, symbols of one file):
// the query's letters must appear in order; matches at word starts and runs of adjacent
// letters score higher, gaps cost a little. Each word of the query matches on its own, so
// "push git" finds "Git: Push". Files and workspace symbols are matched in Rust instead.

export interface FuzzyMatch {
  score: number;
  /** Matched code point positions of the target, ascending. */
  indices: number[];
}

/** Longer targets are cut here: labels are short, and the cost stays bounded. */
const MAX_TARGET = 256;
const MAX_WORD = 64;

const SCORE_MATCH = 16;
const BONUS_FIRST = 10;
const BONUS_WORD_START = 8;
const BONUS_CAMEL = 7;
const BONUS_CONSECUTIVE = 6;
const BONUS_CASE = 1;
const PENALTY_GAP = 1;
const PENALTY_GAP_MAX = 6;
const PENALTY_LEADING = 1;
const PENALTY_LEADING_MAX = 8;
const PENALTY_UNMATCHED = 0.05;
/** Small: initials at word starts ("sc" for "Stash Changes") should beat a substring. */
const BONUS_SUBSTRING = 2;

const SEPARATORS = new Set([" ", "-", "_", "/", "\\", ".", ":", ">", "(", "[", "<", ",", "@", "#", "$"]);

function isUpper(character: string): boolean {
  return character !== character.toLowerCase() && character === character.toUpperCase();
}

function isLowerOrDigit(character: string): boolean {
  return (character !== character.toUpperCase() && character === character.toLowerCase()) || /[0-9]/.test(character);
}

/** The bonus for matching at `index`: string start, after a separator, or a camelCase hump. */
function positionBonus(chars: string[], index: number): number {
  if (index === 0) {
    return BONUS_FIRST;
  }
  const previous = chars[index - 1];
  if (SEPARATORS.has(previous)) {
    return BONUS_WORD_START;
  }
  if (isUpper(chars[index]) && isLowerOrDigit(previous)) {
    return BONUS_CAMEL;
  }
  return 0;
}

/** Best alignment of one query word in the target, by dynamic programming over (word letter, target position). */
function matchWord(word: string[], chars: string[], lower: string[]): FuzzyMatch | null {
  const m = word.length;
  const n = chars.length;
  if (m === 0) {
    return { score: 0, indices: [] };
  }
  if (m > n) {
    return null;
  }
  const wordLower = word.map((character) => character.toLowerCase());
  // Quick reject: the letters must appear in order at all.
  let probe = 0;
  for (let index = 0; index < n && probe < m; index++) {
    if (lower[index] === wordLower[probe]) {
      probe++;
    }
  }
  if (probe < m) {
    return null;
  }
  const NONE = -Infinity;
  // score[i * n + j]: best score with word letter i matched at target position j.
  const score = new Float64Array(m * n).fill(NONE);
  const from = new Int32Array(m * n).fill(-1);
  for (let j = 0; j < n; j++) {
    if (lower[j] !== wordLower[0]) {
      continue;
    }
    const leading = Math.min(PENALTY_LEADING_MAX, j * PENALTY_LEADING);
    score[j] = SCORE_MATCH + positionBonus(chars, j) + (chars[j] === word[0] ? BONUS_CASE : 0) - leading;
  }
  for (let i = 1; i < m; i++) {
    const row = i * n;
    const previousRow = (i - 1) * n;
    // Gaps cost at most PENALTY_GAP_MAX, so every earlier letter further back than that
    // costs the same: keep their best in a running maximum and only scan the near window.
    const window = PENALTY_GAP_MAX + 1;
    let farBest = NONE;
    let farFrom = -1;
    for (let j = i; j < n; j++) {
      const far = j - window;
      if (far >= i - 1 && score[previousRow + far] > farBest) {
        farBest = score[previousRow + far];
        farFrom = far;
      }
      if (lower[j] !== wordLower[i]) {
        continue;
      }
      const base = SCORE_MATCH + positionBonus(chars, j) + (chars[j] === word[i] ? BONUS_CASE : 0);
      let best = farBest === NONE ? NONE : farBest - PENALTY_GAP_MAX;
      let bestFrom = farBest === NONE ? -1 : farFrom;
      for (let k = Math.max(i - 1, j - window + 1); k < j; k++) {
        const before = score[previousRow + k];
        if (before === NONE) {
          continue;
        }
        const gap = j - k - 1;
        const value = before + (gap === 0 ? BONUS_CONSECUTIVE : -Math.min(PENALTY_GAP_MAX, gap * PENALTY_GAP));
        if (value > best) {
          best = value;
          bestFrom = k;
        }
      }
      if (bestFrom >= 0) {
        score[row + j] = best + base;
        from[row + j] = bestFrom;
      }
    }
  }
  const lastRow = (m - 1) * n;
  let end = -1;
  let total = NONE;
  for (let j = m - 1; j < n; j++) {
    if (score[lastRow + j] > total) {
      total = score[lastRow + j];
      end = j;
    }
  }
  if (end < 0) {
    return null;
  }
  const indices = new Array<number>(m);
  let position = end;
  for (let i = m - 1; i >= 0; i--) {
    indices[i] = position;
    position = from[i * n + position];
  }
  return { score: total, indices };
}

/** Matches `query` against `target`; null when some word of the query is not in it. An empty query matches with score 0. */
export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  const words = query
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "");
  if (words.length === 0) {
    return { score: 0, indices: [] };
  }
  const chars = Array.from(target).slice(0, MAX_TARGET);
  const lower = chars.map((character) => character.toLowerCase());
  let score = 0;
  const matched = new Set<number>();
  for (const word of words) {
    const result = matchWord(Array.from(word).slice(0, MAX_WORD), chars, lower);
    if (!result) {
      return null;
    }
    score += result.score;
    for (const index of result.indices) {
      matched.add(index);
    }
  }
  // A whole-word or prefix hit beats a scattered one of the same letters.
  const compact = query.trim().toLowerCase();
  const lowerTarget = lower.join("");
  if (lowerTarget.startsWith(compact)) {
    score += BONUS_FIRST;
  } else if (lowerTarget.includes(compact)) {
    score += BONUS_SUBSTRING;
  }
  // Ties go to the shorter label: "Save" before "Save Workspace As".
  score -= (chars.length - matched.size) * PENALTY_UNMATCHED;
  return { score, indices: [...matched].sort((a, b) => a - b) };
}
