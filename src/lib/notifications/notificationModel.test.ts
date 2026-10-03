import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "$lib/ui/toast.svelte";
import {
  ACTION_LIFETIME_MS,
  actionAvailable,
  addNotification,
  badgeText,
  bellTitle,
  CHECKED_ACTION_LIFETIME_MS,
  dropStaleActions,
  kindLabel,
  markActionUsed,
  markAllRead,
  MAX_NOTIFICATIONS,
  type NotificationEntry,
  type NotificationKind,
  shouldPopUp,
  unreadAlerts,
} from "./notificationModel";
import { notifications } from "./notifications.svelte";

function entry(id: number, kind: NotificationKind = "info", extra: Partial<NotificationEntry> = {}): NotificationEntry {
  return { id, kind, title: `m${id}`, detail: null, time: 1000, read: false, action: null, actionUsed: false, ...extra };
}

describe("notification list", () => {
  it("adds newest first and keeps at most 200", () => {
    let list: NotificationEntry[] = [];
    for (let id = 1; id <= MAX_NOTIFICATIONS + 5; id++) {
      list = addNotification(list, entry(id));
    }
    expect(list).toHaveLength(MAX_NOTIFICATIONS);
    expect(list[0].id).toBe(MAX_NOTIFICATIONS + 5);
    expect(list[list.length - 1].id).toBe(6);
  });

  it("counts unread errors and warnings only", () => {
    const list = [entry(1, "error"), entry(2, "warning"), entry(3, "info"), entry(4, "success"), entry(5, "error", { read: true })];
    expect(unreadAlerts(list)).toBe(2);
    const read = markAllRead(list);
    expect(unreadAlerts(read)).toBe(0);
    expect(read.every((item) => item.read)).toBe(true);
    // Nothing to change: the same list comes back.
    expect(markAllRead(read)).toBe(read);
  });

  it("offers a button without a check for 2 minutes, one with a check for 30", () => {
    const run = vi.fn();
    const plain = entry(1, "success", { action: { label: "Undo", run }, time: 0 });
    expect(actionAvailable(plain, ACTION_LIFETIME_MS)).toBe(true);
    expect(actionAvailable(plain, ACTION_LIFETIME_MS + 1)).toBe(false);
    const checked = entry(2, "success", { action: { label: "Open", run, valid: () => true }, time: 0 });
    expect(actionAvailable(checked, ACTION_LIFETIME_MS + 1)).toBe(true);
    expect(actionAvailable(checked, CHECKED_ACTION_LIFETIME_MS + 1)).toBe(false);
    const dropped = dropStaleActions([plain, checked], ACTION_LIFETIME_MS + 1);
    expect(dropped[0].action).toBeNull();
    expect(dropped[1]).toBe(checked);
  });

  it("offers a button once, while young and valid", () => {
    const run = vi.fn();
    let valid = true;
    const withAction = entry(1, "success", { action: { label: "Undo", run, valid: () => valid } });
    expect(actionAvailable(withAction, 1000)).toBe(true);
    expect(actionAvailable(withAction, 1000 + CHECKED_ACTION_LIFETIME_MS + 1)).toBe(false);
    valid = false;
    expect(actionAvailable(withAction, 1000)).toBe(false);
    valid = true;
    const used = markActionUsed([withAction], 1)[0];
    expect(used.actionUsed).toBe(true);
    expect(actionAvailable(used, 1000)).toBe(false);
    expect(actionAvailable(entry(2), 1000)).toBe(false);
    const throwing = entry(3, "info", {
      action: {
        label: "x",
        run,
        valid: () => {
          throw new Error("gone");
        },
      },
    });
    expect(actionAvailable(throwing, 1000)).toBe(false);
  });

  it("lets go of buttons past their lifetime", () => {
    const run = vi.fn();
    const list = [entry(1, "success", { action: { label: "Undo", run }, time: 0 }), entry(2, "info", { time: 0 })];
    expect(dropStaleActions(list, ACTION_LIFETIME_MS)).toBe(list);
    const dropped = dropStaleActions(list, ACTION_LIFETIME_MS + 1);
    expect(dropped[0].action).toBeNull();
    expect(dropped[1]).toBe(list[1]);
  });

  it("Do Not Disturb lets only errors pop up", () => {
    expect(shouldPopUp("info", false)).toBe(true);
    expect(shouldPopUp("warning", false)).toBe(true);
    for (const kind of ["info", "success", "warning"] as const) {
      expect(shouldPopUp(kind, true)).toBe(false);
    }
    expect(shouldPopUp("error", true)).toBe(true);
  });

  it("words the badge, kinds and tooltip", () => {
    expect(badgeText(0)).toBe("");
    expect(badgeText(7)).toBe("7");
    expect(badgeText(120)).toBe("99+");
    expect(kindLabel("warning")).toBe("Warning");
    expect(kindLabel("success")).toBe("Done");
    expect(bellTitle(0, 0, false)).toBe("No notifications");
    expect(bellTitle(1, 3, false)).toBe("1 unread problem");
    expect(bellTitle(0, 1, true)).toBe("1 notification. Do Not Disturb is on");
  });
});

describe("toasts and the notification history", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    notifications.clear();
    notifications.doNotDisturb = false;
    notifications.setOpen(false);
  });

  afterEach(() => {
    for (const item of toast.items) {
      toast.dismiss(item.id);
    }
    vi.useRealTimers();
  });

  it("records every toast, and a toast closes on its own but stays listed", () => {
    toast.success("Saved a.txt");
    toast.warning("Careful", "  detail  ");
    expect(toast.items).toHaveLength(2);
    expect(notifications.items.map((item) => [item.kind, item.title, item.detail])).toEqual([
      ["warning", "Careful", "detail"],
      ["success", "Saved a.txt", null],
    ]);
    expect(notifications.unread).toBe(1);
    vi.advanceTimersByTime(10_000);
    expect(toast.items).toHaveLength(0);
    expect(notifications.items).toHaveLength(2);
    notifications.setOpen(true);
    expect(notifications.unread).toBe(0);
  });

  it("Do Not Disturb still records what it keeps off screen", () => {
    notifications.doNotDisturb = true;
    toast.info("Fetched");
    toast.error("Push failed");
    expect(toast.items.map((item) => item.title)).toEqual(["Push failed"]);
    expect(notifications.items.map((item) => item.title)).toEqual(["Push failed", "Fetched"]);
  });

  it("a button runs once, from the toast or the list", () => {
    const run = vi.fn();
    toast.successWithAction("Discarded 3 lines", undefined, { label: "Undo", run });
    const toastId = toast.items[0].id;
    const notificationId = notifications.items[0].id;
    toast.runAction(toastId);
    expect(run).toHaveBeenCalledTimes(1);
    expect(toast.items).toHaveLength(0);
    toast.runNotificationAction(notificationId);
    expect(run).toHaveBeenCalledTimes(1);
    expect(notifications.actionAvailable(notifications.items[0])).toBe(false);
  });

  it("running a button from the list closes its toast", () => {
    const run = vi.fn();
    toast.successWithAction("Stashed", undefined, { label: "Undo", run });
    toast.runNotificationAction(notifications.items[0].id);
    expect(run).toHaveBeenCalledTimes(1);
    expect(toast.items).toHaveLength(0);
  });

  it("messages that arrive while the list is open are already read", () => {
    notifications.setOpen(true);
    toast.error("Pull failed");
    expect(notifications.unread).toBe(0);
  });
});
