// The words for a moment relative to now, as the app writes them: the log's "5 min ago" (src/lib/log/format.ts),
// the AI panel's short "5m" age, and AI usage's "in 3h 20m" reset (src/lib/ai/usageView.ts).

export type TimeFormat = "ago" | "age" | "until";

const MINUTE = 60_000;
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

/** "just now", "5 min ago", "2 h ago", "yesterday", "3 d ago", then the date after a week (or ahead of now). */
function ago(elapsed: number, timeMs: number): string {
  if (elapsed < 0 || elapsed >= 7 * DAY) {
    return shortDate.format(new Date(timeMs));
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
  const days = Math.floor(elapsed / DAY);
  return days === 1 ? "yesterday" : `${days} d ago`;
}

/** "now", "5m", "2h", "3d": how long something has been in its state. */
function age(elapsed: number): string {
  const minutes = Math.floor(Math.max(0, elapsed) / MINUTE);
  if (minutes < 1) {
    return "now";
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

/** "now" once due, else "in 45m", "in 3h 20m", "in 2d 4h". */
function until(left: number): string {
  if (left <= 0) {
    return "now";
  }
  const minutes = Math.ceil(left / MINUTE);
  if (minutes < 60) {
    return `in ${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return minutes % 60 === 0 ? `in ${hours}h` : `in ${hours}h ${minutes % 60}m`;
  }
  const days = Math.floor(hours / 24);
  return hours % 24 === 0 ? `in ${days}d` : `in ${days}d ${hours % 24}h`;
}

/** The words for `timeMs` (milliseconds since 1970) seen at `nowMs`. */
export function timeText(timeMs: number, nowMs: number, format: TimeFormat): string {
  if (format === "age") {
    return age(nowMs - timeMs);
  }
  if (format === "until") {
    return until(timeMs - nowMs);
  }
  return ago(nowMs - timeMs, timeMs);
}

/** The full date and time for a tooltip: "Mon, Mar 3, 2025, 09:41 AM". */
export function fullDate(timeMs: number): string {
  return longDate.format(new Date(timeMs));
}
