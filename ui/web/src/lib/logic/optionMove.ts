// The keys of a pick list (OptionList): arrows, Home and End, and the page keys.

/**
 * Listbox keys: the index of the option to pick after `key`, or null when
 * the key does not move. Page keys jump by `pageSize`.
 */
export function optionMove(currentIndex: number, key: string, count: number, pageSize = 8): number | null {
  if (count <= 0) {
    return null;
  }
  const last = count - 1;
  const from = Math.min(last, Math.max(0, currentIndex));
  switch (key) {
    case "ArrowDown":
      return Math.min(last, currentIndex < 0 ? 0 : from + 1);
    case "ArrowUp":
      return Math.max(0, currentIndex < 0 ? last : from - 1);
    case "Home":
      return 0;
    case "End":
      return last;
    case "PageDown":
      return Math.min(last, from + pageSize);
    case "PageUp":
      return Math.max(0, from - pageSize);
    default:
      return null;
  }
}
