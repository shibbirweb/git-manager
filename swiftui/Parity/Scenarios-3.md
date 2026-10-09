# Parity scenarios (continued)

## scripts: Scripts panel (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Click the play button in the left activity bar (View > Scripts): the scripts of package.json.

- Scripts tool window (`scripts`, missing): The scripts of package.json with run buttons and the Node version.

## update-dialog: Update available (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Run a build older than the newest release on its channel and wait about 30 seconds.
2. Click Update available in the status bar: the update window.

- Updates and release channels (`updates`, missing): Update available in the status bar and the update window.

## memory-breakdown: Memory breakdown (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Click the memory readout at the right of the status bar.

- Memory readout and memory log (`memory`, partial): The readout in the status bar and its breakdown. Native lacks:
  the breakdown popup; the memory log and the memory marks in Settings.
- Clear Cache (`clear-cache`, missing): The brush right of the readout: the window blinks and comes back as it was.
  Native lacks: the brush is drawn but does nothing (the native app has no WebKit cache to clear).
