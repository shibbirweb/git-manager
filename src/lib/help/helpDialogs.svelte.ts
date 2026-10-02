// Windows opened from the Help menu.

class HelpDialogs {
  shortcutsOpen = $state(false);

  openShortcuts(): void {
    this.shortcutsOpen = true;
  }
}

export const helpDialogs = new HelpDialogs();
