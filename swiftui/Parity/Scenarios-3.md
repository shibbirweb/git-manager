# Parity scenarios (continued)

## memory-breakdown: Memory breakdown (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Click the memory readout at the right of the status bar.

- Memory readout and memory log (`memory`, partial): The readout in the status bar and its breakdown. Native lacks:
  the breakdown popup; the memory log and the memory marks in Settings.
- Clear Cache (`clear-cache`, missing): The brush right of the readout: the window blinks and comes back as it was.
  Native lacks: the brush is drawn but does nothing (the native app has no WebKit cache to clear).
