import type { ChangedFile, RefLabel } from "$lib/types";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const longDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Short relative time for the table, e.g. "2 h ago" or "Mar 3, 2025". */
export function relativeTime(seconds: number, nowMs: number = Date.now()): string {
  const elapsed = Math.floor(nowMs / 1000) - seconds;
  if (elapsed < 0) {
    return shortDate.format(new Date(seconds * 1000));
  }
  if (elapsed < MINUTE) {
    return "just now";
  }
  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)} min ago`;
  }
  if (elapsed < DAY) {
    return `${Math.floor(elapsed / HOUR)} h ago`;
  }
  if (elapsed < 7 * DAY) {
    const days = Math.floor(elapsed / DAY);
    return days === 1 ? "yesterday" : `${days} d ago`;
  }
  return shortDate.format(new Date(seconds * 1000));
}

export function fullDate(seconds: number): string {
  return longDate.format(new Date(seconds * 1000));
}

export function statusLetter(status: ChangedFile["status"]): string {
  switch (status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    case "typechange":
      return "T";
    default:
      return "M";
  }
}

const REF_ORDER: Record<RefLabel["kind"], number> = {
  head: 0,
  local: 1,
  tag: 2,
  remote: 3,
};

export function sortRefs(refs: readonly RefLabel[]): RefLabel[] {
  return [...refs].sort((left, right) => (REF_ORDER[left.kind] ?? 9) - (REF_ORDER[right.kind] ?? 9));
}

export function fileName(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  return slash === -1 ? filePath : filePath.slice(slash + 1);
}

export function fileDir(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  return slash === -1 ? "" : filePath.slice(0, slash);
}
