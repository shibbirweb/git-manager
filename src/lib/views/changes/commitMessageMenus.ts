// The commit box's Message History and Templates menus, built from plain data so the
// tests can check them.

import { relativeTime } from "$lib/log/format";
import type { MenuItem } from "$lib/ui/menu.svelte";
import { type HistoryEntry, historyLabel } from "./commitMessages";
import type { CommitTemplate } from "./commitTemplates";

/** Recent messages, newest first; picking one puts it into the box. */
export function historyMenuItems(entries: HistoryEntry[], nowMs: number, onPick: (message: string) => void): MenuItem[] {
  if (entries.length === 0) {
    return [{ label: "No recent messages", action: () => {}, disabled: true }];
  }
  return entries.map((entry) => ({
    label: historyLabel(entry.message),
    hint: relativeTime(Math.floor(entry.time / 1000), nowMs),
    action: () => onPick(entry.message),
  }));
}

export interface TemplateMenuHandlers {
  onTemplate: (text: string) => void;
  /** The repository's `commit.template` text (comments removed). */
  onGitTemplate: (text: string) => void;
  onEdit: () => void;
}

/** The user's templates, git's commit.template when set, then Edit Templates. */
export function templateMenuItems(
  templates: CommitTemplate[],
  gitTemplate: string | null,
  handlers: TemplateMenuHandlers,
): MenuItem[] {
  const items: MenuItem[] = templates.map((template) => ({
    label: template.name,
    action: () => handlers.onTemplate(template.text),
  }));
  if (gitTemplate !== null && gitTemplate !== "") {
    if (items.length > 0) {
      items.push({ separator: true });
    }
    items.push({ label: "Git Commit Template", hint: "commit.template", action: () => handlers.onGitTemplate(gitTemplate) });
  }
  if (items.length === 0) {
    items.push({ label: "No templates yet", action: () => {}, disabled: true });
  }
  items.push({ separator: true }, { label: "Edit Templates...", action: handlers.onEdit });
  return items;
}
