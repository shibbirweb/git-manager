// Remember unsaved changes (Settings > Editor), like Sublime Text's hot exit: the text of
// Untitled tabs and of files with unsaved edits is written to ~/.gitmanager/unsaved (unsaved.rs)
// a moment after each edit, so closing the window or quitting keeps it, and the tabs come back
// with it when the workspace opens again. Saving, reverting or discarding forgets it.
//
// Writes and removals of one tab run in order, so a slow write never brings back text that
// was saved meanwhile. The editors hold the text; this store only holds which tabs have some
// kept and, for Untitled tabs, their titles.

import { api, errorMessage } from "$lib/api";
import type { UnsavedMeta } from "$lib/types";
import { toast } from "$lib/ui/toast.svelte";
import { settings } from "./settings.svelte";
import { isUntitledTab, newUntitledPath, untitledTitle } from "./untitledTabs";

/** Wait after the last edit before the text is written. */
const WRITE_DELAY_MS = 500;

interface Pending {
  timer: ReturnType<typeof setTimeout>;
  /** The editor's text now; null when it has none (it went away). */
  text: () => string | null;
}

class UnsavedTextStore {
  /** Untitled tab titles (the first line of the text), by tab path. */
  titles = $state.raw<Record<string, string>>({});
  /** The workspace whose tabs this window shows; kept text is filed under it. */
  private workspaceId: string | null = null;
  /** Tabs with text on disk, as far as this window knows. */
  private kept = new Set<string>();
  private pending = new Map<string, Pending>();
  private chains = new Map<string, Promise<void>>();
  /** An Untitled tab's text while its tab moves to the other group (its editor is replaced). */
  private parked = new Map<string, string>();
  private warned = false;

  /** A workspace opened (or closed: null): what it has kept, oldest first. */
  async open(workspaceId: string | null): Promise<UnsavedMeta[]> {
    this.workspaceId = workspaceId;
    this.kept.clear();
    if (workspaceId === null) {
      return [];
    }
    const listed = await api.unsavedList().catch(() => [] as UnsavedMeta[]);
    for (const meta of listed) {
      this.kept.add(meta.tabPath);
    }
    return listed;
  }

  /** The workspace was saved to a file and got a new id: Untitled tabs are filed under it from now on. */
  renameWorkspace(workspaceId: string, untitledText: (tabPath: string) => string | null): void {
    this.workspaceId = workspaceId;
    for (const tabPath of this.kept) {
      if (isUntitledTab(tabPath)) {
        this.schedule(tabPath, () => untitledText(tabPath));
      }
    }
  }

  /** `tabPath` has kept text on disk. */
  has(tabPath: string): boolean {
    return this.kept.has(tabPath);
  }

  async read(tabPath: string): Promise<string | null> {
    await this.chains.get(tabPath);
    const kept = await api.unsavedRead(tabPath).catch(() => null);
    return kept?.text ?? null;
  }

  /** A file with kept text is gone from disk: its text moves to a new Untitled tab, whose path this returns. */
  async moveToUntitled(filePath: string): Promise<string | null> {
    const workspaceId = this.workspaceId;
    const text = await this.read(filePath);
    if (text === null || workspaceId === null) {
      return null;
    }
    const tabPath = newUntitledPath();
    try {
      await api.unsavedWrite(tabPath, workspaceId, text);
    } catch (error) {
      this.warn(error);
      return null;
    }
    this.kept.add(tabPath);
    this.discard([filePath]);
    return tabPath;
  }

  /** The tab's text changed: it is written after a pause, when the setting is on. */
  schedule(tabPath: string, text: () => string | null): void {
    if (!settings.rememberUnsaved || this.workspaceId === null) {
      return;
    }
    clearTimeout(this.pending.get(tabPath)?.timer);
    this.pending.set(tabPath, { timer: setTimeout(() => this.writeNow(tabPath), WRITE_DELAY_MS), text });
  }

  /** Writes a waiting text now, e.g. before its editor goes away. */
  writeNow(tabPath: string): void {
    const pending = this.pending.get(tabPath);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(tabPath);
    const text = pending.text();
    const workspaceId = this.workspaceId;
    if (text === null || workspaceId === null) {
      return;
    }
    this.kept.add(tabPath);
    this.enqueue(tabPath, () => api.unsavedWrite(tabPath, workspaceId, text));
  }

  /** The text was saved, reverted or discarded: nothing of it is kept any more. */
  discard(tabPaths: string[]): void {
    const removing: string[] = [];
    for (const tabPath of tabPaths) {
      const pending = this.pending.get(tabPath);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(tabPath);
      }
      if (this.kept.delete(tabPath)) {
        removing.push(tabPath);
      }
    }
    for (const tabPath of removing) {
      this.enqueue(tabPath, () => api.unsavedRemove([tabPath]));
    }
  }

  /** Before the window closes or restarts: every waiting text is written, and every write finished. */
  async flush(): Promise<void> {
    for (const tabPath of [...this.pending.keys()]) {
      this.writeNow(tabPath);
    }
    await Promise.all(this.chains.values());
  }

  setTitle(tabPath: string, text: string): void {
    const title = untitledTitle(text);
    if (this.titles[tabPath] !== title) {
      this.titles = { ...this.titles, [tabPath]: title };
    }
  }

  title(tabPath: string): string | null {
    return this.titles[tabPath] ?? null;
  }

  /** An Untitled tab's editor goes away with `text`; the next editor of the tab starts from it. */
  park(tabPath: string, text: string): void {
    this.parked.set(tabPath, text);
  }

  takeParked(tabPath: string): string | null {
    const text = this.parked.get(tabPath) ?? null;
    this.parked.delete(tabPath);
    return text;
  }

  /** Untitled tabs closed for good: their titles and parked text go. */
  forgetTabs(tabPaths: string[]): void {
    const closing = tabPaths.filter((tabPath) => isUntitledTab(tabPath));
    if (closing.length === 0) {
      return;
    }
    for (const tabPath of closing) {
      this.parked.delete(tabPath);
    }
    if (closing.some((tabPath) => tabPath in this.titles)) {
      this.titles = Object.fromEntries(Object.entries(this.titles).filter(([tabPath]) => !closing.includes(tabPath)));
    }
  }

  private enqueue(tabPath: string, work: () => Promise<void>): void {
    const next = (this.chains.get(tabPath) ?? Promise.resolve())
      .then(work)
      .catch((error) => this.warn(error))
      .finally(() => {
        if (this.chains.get(tabPath) === next) {
          this.chains.delete(tabPath);
        }
      });
    this.chains.set(tabPath, next);
  }

  /** One toast per session: a full disk would otherwise show one on every keystroke. */
  private warn(error: unknown): void {
    if (this.warned) {
      return;
    }
    this.warned = true;
    toast.warning("Could not keep unsaved changes", errorMessage(error));
  }
}

export const unsavedText = new UnsavedTextStore();
