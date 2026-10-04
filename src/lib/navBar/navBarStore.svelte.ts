// Who answers Jump to Navigation Bar (JetBrains' Cmd+Up): the path bar of the file on screen
// (NavigationBar.svelte inside FileView), or, with no file on screen, a floating bar over the
// editor area (Workspace.svelte). The bar that has the keyboard is `active`, so the window
// shortcuts wait, a second bar (split editor) lets go, and the focus goes back where it was.

import { repoStore } from "$lib/stores/repo.svelte";

class NavBarStore {
  /** The bar that has the keyboard and shows a popup. */
  active = $state<symbol | null>(null);
  /** The floating bar shows (nothing on screen has a path bar). */
  floating = $state(false);
  /** Bumped on each jump; the `active` bar opens its popup. */
  jumpToken = $state(0);
  /** The path bar of the file on screen in the focused editor group. */
  private inline: symbol | null = null;
  private previousFocus: HTMLElement | null = null;

  get isOpen(): boolean {
    return this.active !== null || this.floating;
  }

  /** Called by the path bar of the shown tab in the focused group; the returned function gives it up. */
  claim(owner: symbol): () => void {
    this.inline = owner;
    return () => {
      if (this.inline === owner) {
        this.inline = null;
      }
    };
  }

  /** Jump to Navigation Bar: the file's path bar, or the floating bar. */
  jump(): void {
    if (repoStore.workspace === null || this.isOpen) {
      return;
    }
    this.capture();
    if (this.inline !== null) {
      this.active = this.inline;
      this.jumpToken += 1;
    } else {
      this.floating = true;
    }
  }

  /** A bar takes the keyboard (a click on a crumb, or the floating bar showing). */
  enter(owner: symbol): void {
    if (!this.isOpen) {
      this.capture();
    }
    this.active = owner;
  }

  /** Leaves the bar; `restore` gives the focus back (not after a click elsewhere or opening a file). */
  close(restore = true): void {
    this.active = null;
    this.floating = false;
    const focus = this.previousFocus;
    this.previousFocus = null;
    if (restore && focus?.isConnected) {
      focus.focus();
    }
  }

  private capture(): void {
    const focused = typeof document === "undefined" ? null : document.activeElement;
    this.previousFocus = focused instanceof HTMLElement && focused !== document.body ? focused : null;
  }
}

export const navBarStore = new NavBarStore();
