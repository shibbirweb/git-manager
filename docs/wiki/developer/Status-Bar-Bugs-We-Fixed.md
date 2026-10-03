# Status Bar Bugs We Fixed

The bugs we found in the status bar and the Help links, why they happened and how we fixed them. How the bar works is in [How the Status Bar Works](How-the-Status-Bar-Works.md); the user side is in [Status Bar and Help](../usage/Status-Bar-and-Help.md).

**The bar ignored the file on screen.**
- **The issue:** the status bar always showed the active repository, even while you read a file from another one.
- **Why it happened:** it read `repoStore.repo` directly.
- **The fix and why we chose it:** `contextRepo` follows the visible file tab or diff, like VS Code, and falls back to the active repository.

**Spaces opened the wrong Settings section.**
- **The issue:** the Spaces item says the tab size is in Settings, Editor, but clicking it opened Settings on Appearance.
- **Why it happened:** the Settings dialog always started on Appearance, and callers could only open it, not pick a section.
- **The fix and why we chose it:** `settings.openDialog(section)` records the section to show, and the dialog starts there. Spaces opens the Editor section, and every other way in still opens Appearance. One small entry point keeps all callers consistent.

**Two shortcut rows were wrong.**
- **The issue:** Bold (Cmd+B) claimed the Markdown text editor, where Cmd+B hid the sidebar, and macOS listed Ctrl+PageDown and Ctrl+PageUp for tabs, which do nothing there.
- **Why it happened:** `extraShortcuts` is hand-written, with one set of tab keys for all platforms.
- **The fix and why we chose it:** the text editor now binds Cmd+B for bold, so the row is true, and the tab rows use the Window menu's keys per platform. Tests pin both.

**Bug reports named the wrong macOS version.**
- **The issue:** Report a Bug always filled in "macOS 10.15.7", whatever macOS you ran.
- **Why it happened:** the platform came from the web view's user agent, and WebKit freezes the macOS version there at 10.15.7.
- **The fix and why we chose it:** a small backend command, `os_info`, asks the system itself (`sw_vers` on macOS, `/etc/os-release` on Linux, just "Windows" on Windows). If it fails, the link falls back to the family name from the user agent, without the frozen version. A wrong version is worse than none.

## Related

- [How the Status Bar Works](How-the-Status-Bar-Works.md)
- [Update Bugs We Fixed](Update-Bugs-We-Fixed.md)
