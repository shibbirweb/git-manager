import { describe, expect, it, vi } from "vitest";
import type { MenuCommand, MenuItem } from "$lib/ui/menu.svelte";
import { historyMenuItems, templateMenuItems } from "./commitMessageMenus";

function labels(items: MenuItem[]): string[] {
  return items.map((item) => ("separator" in item ? "---" : item.label));
}

describe("commit message menus", () => {
  it("lists history entries with their age and puts the picked one in", () => {
    const now = Date.UTC(2026, 9, 3, 12);
    const onPick = vi.fn();
    const items = historyMenuItems(
      [
        { message: "feat: x\n\nbody", time: now - 2 * 60 * 60 * 1000 },
        { message: "fix: y", time: now - 30 * 1000 },
      ],
      now,
      onPick,
    );
    expect(labels(items)).toEqual(["feat: x", "fix: y"]);
    expect((items[0] as MenuCommand).hint).toBe("2 h ago");
    expect((items[1] as MenuCommand).hint).toBe("just now");
    (items[0] as MenuCommand).action();
    expect(onPick).toHaveBeenCalledWith("feat: x\n\nbody");
    const empty = historyMenuItems([], now, onPick);
    expect(labels(empty)).toEqual(["No recent messages"]);
    expect((empty[0] as MenuCommand).disabled).toBe(true);
  });

  it("lists templates, git's template and Edit Templates", () => {
    const handlers = { onTemplate: vi.fn(), onGitTemplate: vi.fn(), onEdit: vi.fn() };
    const items = templateMenuItems([{ name: "Feature", text: "feat: " }], "chore: ", handlers);
    expect(labels(items)).toEqual(["Feature", "---", "Git Commit Template", "---", "Edit Templates..."]);
    (items[0] as MenuCommand).action();
    expect(handlers.onTemplate).toHaveBeenCalledWith("feat: ");
    (items[2] as MenuCommand).action();
    expect(handlers.onGitTemplate).toHaveBeenCalledWith("chore: ");
    (items[4] as MenuCommand).action();
    expect(handlers.onEdit).toHaveBeenCalled();
    expect(labels(templateMenuItems([], null, handlers))).toEqual(["No templates yet", "---", "Edit Templates..."]);
    expect(labels(templateMenuItems([], "", handlers))).toEqual(["No templates yet", "---", "Edit Templates..."]);
    expect(labels(templateMenuItems([], "x", handlers))).toEqual(["Git Commit Template", "---", "Edit Templates..."]);
  });
});
