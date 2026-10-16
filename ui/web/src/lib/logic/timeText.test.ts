import { describe, expect, it } from "vitest";
import { fullDate, timeText } from "./timeText";

const now = Date.UTC(2026, 9, 12, 12, 0, 0);
const minutes = (count: number) => count * 60_000;

describe("timeText ago", () => {
  it("reads like the log", () => {
    expect(timeText(now - 20_000, now, "ago")).toBe("just now");
    expect(timeText(now - minutes(5), now, "ago")).toBe("5 min ago");
    expect(timeText(now - minutes(150), now, "ago")).toBe("2 h ago");
    expect(timeText(now - minutes(60 * 30), now, "ago")).toBe("yesterday");
    expect(timeText(now - minutes(60 * 24 * 3), now, "ago")).toBe("3 d ago");
  });

  it("shows the date after a week and for a time ahead of now", () => {
    expect(timeText(now - minutes(60 * 24 * 10), now, "ago")).toBe("Oct 2, 2026");
    expect(timeText(now + minutes(5), now, "ago")).toBe("Oct 12, 2026");
  });
});

describe("timeText age", () => {
  it("is short, like the AI panel", () => {
    expect(timeText(now - 10_000, now, "age")).toBe("now");
    expect(timeText(now - minutes(5), now, "age")).toBe("5m");
    expect(timeText(now - minutes(125), now, "age")).toBe("2h");
    expect(timeText(now - minutes(60 * 50), now, "age")).toBe("2d");
  });
});

describe("timeText until", () => {
  it("counts down, like AI usage resets", () => {
    expect(timeText(now - 1, now, "until")).toBe("now");
    expect(timeText(now + minutes(45), now, "until")).toBe("in 45m");
    expect(timeText(now + minutes(200), now, "until")).toBe("in 3h 20m");
    expect(timeText(now + minutes(180), now, "until")).toBe("in 3h");
    expect(timeText(now + minutes(60 * 52), now, "until")).toBe("in 2d 4h");
  });
});

describe("fullDate", () => {
  it("names the day, date and time", () => {
    expect(fullDate(now)).toMatch(/^\w{3}, Oct 12, 2026(,| at) \d{2}:\d{2} (AM|PM)$/);
  });
});
