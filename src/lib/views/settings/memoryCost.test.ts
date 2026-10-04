import { describe, expect, it } from "vitest";
import { defaultPreferences } from "../../stores/settingsData";
import { MEMORY_COSTS, memoryCost, memoryFlagTitle } from "./memoryCost";

describe("memoryCost", () => {
  it("only lists real settings", () => {
    for (const setting of Object.keys(MEMORY_COSTS)) {
      expect(setting in defaultPreferences, setting).toBe(true);
    }
  });

  it("gives every entry a short amount in MB and a full sentence", () => {
    for (const [setting, cost] of Object.entries(MEMORY_COSTS)) {
      expect(cost?.amount, setting).toMatch(/MB/);
      expect(cost?.amount.length ?? 0, setting).toBeLessThanOrEqual(16);
      expect(cost?.detail, setting).toMatch(/^[A-Z].*\.$/);
      expect(`${cost?.amount} ${cost?.detail}`, setting).not.toContain("\u2014");
    }
  });

  it("returns null for a setting without a cost", () => {
    expect(memoryCost("tabSize")).toBeNull();
  });

  it("builds the tooltip from the amount and the detail", () => {
    expect(memoryFlagTitle({ amount: "+5 MB", detail: "Per open editor." })).toBe("Uses more memory: +5 MB. Per open editor.");
  });
});
