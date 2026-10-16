// GitHub-style heading ids: lower case, punctuation dropped, spaces as hyphens,
// and "-1", "-2" for repeats, so links written for GitHub work in the preview.

/** The slug of one heading's text, before repeats are numbered. */
export function githubSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");
}

/** Hands out unique slugs for the headings of one document, in order. */
export class Slugger {
  private occurrences = new Map<string, number>();

  slug(text: string): string {
    const original = githubSlug(text);
    let result = original;
    while (this.occurrences.has(result)) {
      const count = (this.occurrences.get(original) ?? 0) + 1;
      this.occurrences.set(original, count);
      result = `${original}-${count}`;
    }
    this.occurrences.set(result, 0);
    return result;
  }
}
